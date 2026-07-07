import 'dotenv/config'; // loads .env in dev; no-op in Cloud Run where vars are already injected
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';
import { scrapeCreatorProfiles, scrapeTikTokProfiles, scrapeCampaignContent } from './kernel/index.js';
import { detectPlatform } from './kernel/scrapers/content-post.js';
import { recalcularScore } from './score-service.js';
import { computeCampaignMetrics } from './metrics-service.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' })); // la foto de perfil viaja como data URL en el body

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

function q(sql, params, types) {
  return bq.query({ query: sql, params, types, location: 'US' }).then(([rows]) => rows);
}

// No hay autenticación todavía (ver UserProfileMenu.tsx), así que /api/profile
// siempre lee/escribe este único usuario sembrado por sql/create-users-table.js.
const CURRENT_USER_ID = 'user-001';

/** content_id determinístico = hash(campaign_id|url) → re-cargar la misma URL es idempotente. */
function contentIdFor(campaignId, url) {
  const str = `${campaignId}|${(url || '').trim()}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `cnt_${(h >>> 0).toString(36)}`;
}

// ─── ETIQUETAS BASE ─────────────────────────────────────────────────
// Opciones predefinidas para calificar UGCs. Se pueden seguir agregando
// nuevas desde la UI (quedan persistidas en los creadores y se suman a esta lista).
const DEFAULT_ETIQUETAS = [
  'Foodie',
  'Lifestyle',
  'Familia',
  'Mamás/Papás',
  'Aesthetic',
  'Moda',
  'Humor',
  'Entretenimiento',
  'Fitness',
  'Deportes',
  'Fútbol',
  'Viajes',
  'Gaming',
  'Universitarios',
  'Jóvenes adultos',
  'Lima',
  'UGC Creator',
  'Microinfluencer',
  'Mid Influencer',
  'Macro Influencer',
  'Embajador de marca',
];

// ─── STATUS MAP ─────────────────────────────────────────────────────
const STATUS_TO_ES = { active: 'Activa', draft: 'Borrador', completed: 'Cerrada', paused: 'Pausada' };
const STATUS_TO_EN = { Activa: 'active', Borrador: 'draft', Cerrada: 'completed', Pausada: 'paused' };

// ─── GET /api/creators ──────────────────────────────────────────────
app.get('/api/creators', async (req, res) => {
  try {
    const [creators, allMessages] = await Promise.all([
      q(`
        SELECT creator_id, full_name, username, platform, canal, estado, score,
               ultima_actividad, campana_asignada, seguidores_display, bio, brand_id,
               etiquetas, username_tiktok
        FROM ${DATASET}.creators
        ORDER BY score DESC NULLS LAST, full_name ASC
      `),
      q(`
        SELECT creator_id, message_id, tipo, texto, fecha, orden
        FROM ${DATASET}.messages
        ORDER BY creator_id, orden
      `)
    ]);

    const messagesMap = {};
    allMessages.forEach(m => {
      if (!messagesMap[m.creator_id]) messagesMap[m.creator_id] = [];
      messagesMap[m.creator_id].push({
        id: m.message_id,
        tipo: m.tipo,
        texto: m.texto,
        fecha: m.fecha,
      });
    });

    const result = creators.map(c => ({
      id: c.creator_id,
      nombre: c.full_name || c.username || c.creator_id,
      canal: c.canal || c.platform || 'TikTok',
      estado: c.estado || 'Nuevo',
      score: c.score || 0,
      ultimaActividad: c.ultima_actividad || '',
      campanasignada: c.campana_asignada || null,
      seguidores: c.seguidores_display || '',
      bio: c.bio || '',
      conversacion: messagesMap[c.creator_id] || [],
      calificacion: [],
      scoreBreakdown: [],
      etiquetas: (() => { try { return JSON.parse(c.etiquetas || '[]'); } catch { return []; } })(),
      usernameTiktok: c.username_tiktok || undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/creators error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creators/:id ──────────────────────────────────────────
app.get('/api/creators/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [creators, messages, quals, scores] = await Promise.all([
      q(`SELECT * FROM ${DATASET}.creators WHERE creator_id = @id`, { id }),
      q(`SELECT * FROM ${DATASET}.messages WHERE creator_id = @id ORDER BY orden`, { id }),
      q(`SELECT * FROM ${DATASET}.qualifications WHERE creator_id = @id ORDER BY orden`, { id }),
      q(`SELECT * FROM ${DATASET}.creator_scores WHERE creator_id = @id ORDER BY orden`, { id }).catch(() => []),
    ]);

    if (!creators.length) return res.status(404).json({ error: 'Not found' });
    const c = creators[0];

    const evalPerfil = c.eval_perfil_seguidores != null ? {
      nombre: c.eval_perfil_nombre ?? '',
      perfil: c.eval_perfil_handle ?? c.username ?? '',
      seguidores: Number(c.eval_perfil_seguidores),
      engagementRateCuenta: c.eval_perfil_engagement_rate_cuenta != null ? Number(c.eval_perfil_engagement_rate_cuenta) : null,
      promedioVistaVideos: c.eval_perfil_promedio_vistas != null ? Number(c.eval_perfil_promedio_vistas) : null,
      categoria: c.eval_perfil_categoria ?? '',
      rangoEdadSeguidores: c.eval_perfil_rango_edad_seguidores ?? '',
      frecuenciaSemanal: c.eval_perfil_frecuencia_semanal != null ? Number(c.eval_perfil_frecuencia_semanal) : null,
      videosVirales: c.eval_perfil_videos_virales != null ? Number(c.eval_perfil_videos_virales) : null,
      lastScrapedAt: c.eval_perfil_last_scraped_at?.value ?? c.eval_perfil_last_scraped_at ?? '',
    } : undefined;

    const evalPerfilTiktok = c.tiktok_eval_seguidores != null ? {
      handle: c.username_tiktok ?? '',
      seguidores: Number(c.tiktok_eval_seguidores),
      engagementRate: c.tiktok_eval_engagement_rate != null ? Number(c.tiktok_eval_engagement_rate) : null,
      promedioVistas: c.tiktok_eval_promedio_vistas != null ? Number(c.tiktok_eval_promedio_vistas) : null,
      frecuenciaSemanal: c.tiktok_eval_frecuencia_semanal != null ? Number(c.tiktok_eval_frecuencia_semanal) : null,
      videosVirales: c.tiktok_eval_videos_virales != null ? Number(c.tiktok_eval_videos_virales) : null,
      lastScrapedAt: c.tiktok_eval_last_scraped_at?.value ?? c.tiktok_eval_last_scraped_at ?? '',
    } : undefined;

    const evalOrganica = c.eval_organica_completado ? {
      views: c.eval_organica_views != null ? Number(c.eval_organica_views) : undefined,
      shares: c.eval_organica_shares != null ? Number(c.eval_organica_shares) : undefined,
      engagementRate: c.eval_organica_engagement_rate != null ? Number(c.eval_organica_engagement_rate) : undefined,
      hookNatural: c.eval_organica_hook_natural != null ? Number(c.eval_organica_hook_natural) : undefined,
      completado: true,
    } : undefined;

    const evalPauta = c.eval_pauta_completado ? {
      impresiones: c.eval_pauta_impresiones != null ? Number(c.eval_pauta_impresiones) : undefined,
      alcance: c.eval_pauta_alcance != null ? Number(c.eval_pauta_alcance) : undefined,
      cpm: c.eval_pauta_cpm != null ? Number(c.eval_pauta_cpm) : undefined,
      frecuencia: c.eval_pauta_frecuencia != null ? Number(c.eval_pauta_frecuencia) : undefined,
      ctr: c.eval_pauta_ctr != null ? Number(c.eval_pauta_ctr) : undefined,
      vtr: c.eval_pauta_vtr != null ? Number(c.eval_pauta_vtr) : undefined,
      vistas: c.eval_pauta_vistas != null ? Number(c.eval_pauta_vistas) : undefined,
      er: c.eval_pauta_er != null ? Number(c.eval_pauta_er) : undefined,
      completado: true,
    } : undefined;

    res.json({
      id: c.creator_id,
      nombre: c.full_name,
      username: c.username ?? null,
      canal: c.canal || 'Instagram',
      estado: c.estado || 'Nuevo',
      score: c.score || 0,
      ultimaActividad: c.ultima_actividad || '',
      campanasignada: c.campana_asignada || null,
      seguidores: c.seguidores_display || '',
      bio: c.bio || '',
      phone: c.phone || '',
      conversacion: messages.map(m => ({
        id: m.message_id,
        tipo: m.tipo,
        texto: m.texto,
        fecha: m.fecha,
      })),
      calificacion: quals.map(q => ({
        pregunta: q.pregunta,
        respuesta: q.respuesta,
      })),
      scoreBreakdown: scores.map(s => ({
        criterio: s.criterio,
        puntos: s.puntos,
        maximo: s.maximo,
      })),
      evaluacionPerfil: evalPerfil,
      evaluacionPerfilTiktok: evalPerfilTiktok,
      evaluacionOrganica: evalOrganica,
      evaluacionPauta: evalPauta,
      etiquetas: (() => { try { return JSON.parse(c.etiquetas || '[]'); } catch { return []; } })(),
      usernameTiktok: c.username_tiktok || undefined,
    });
  } catch (err) {
    console.error('GET /api/creators/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/creators/:id ──────────────────────────────────────────
app.put('/api/creators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, canal, estado, score, bio, campanasignada, seguidores, username, etiquetas, usernameTiktok } = req.body;

    await q(`
      UPDATE ${DATASET}.creators SET
        full_name = @nombre, canal = @canal, estado = @estado,
        score = @score, bio = @bio, campana_asignada = @campanasignada,
        seguidores_display = @seguidores, username = @username,
        etiquetas = @etiquetas, username_tiktok = @usernameTiktok
      WHERE creator_id = @id
    `, { id, nombre, canal, estado, score: score || 0, bio: bio || '', campanasignada: campanasignada || '', seguidores: seguidores || '', username: username || null, etiquetas: JSON.stringify(etiquetas || []), usernameTiktok: usernameTiktok || null });

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/creators/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/creators/:id ───────────────────────────────────────
app.delete('/api/creators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      q(`DELETE FROM ${DATASET}.creators WHERE creator_id = @id`, { id }),
      q(`DELETE FROM ${DATASET}.messages WHERE creator_id = @id`, { id }),
      q(`DELETE FROM ${DATASET}.qualifications WHERE creator_id = @id`, { id }),
      q(`DELETE FROM ${DATASET}.creator_scores WHERE creator_id = @id`, { id }),
      q(`DELETE FROM ${DATASET}.campaign_creators WHERE creator_id = @id`, { id }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/creators/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/creators/:id/etiquetas ──────────────────────────────
app.patch('/api/creators/:id/etiquetas', async (req, res) => {
  try {
    const { id } = req.params;
    const { etiquetas } = req.body;
    await q(`
      UPDATE ${DATASET}.creators SET
        etiquetas = @etiquetas,
        updated_at = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `, { id, etiquetas: JSON.stringify(etiquetas || []) });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/creators/:id/etiquetas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/profile ───────────────────────────────────────────────
app.get('/api/profile', async (req, res) => {
  try {
    const rows = await q(`
      SELECT user_id, nombre, area, email, foto_url
      FROM ${DATASET}.users
      WHERE user_id = @id
    `, { id: CURRENT_USER_ID });

    if (rows.length === 0) return res.status(404).json({ error: 'Perfil no encontrado' });

    const u = rows[0];
    res.json({ id: u.user_id, nombre: u.nombre, area: u.area, email: u.email, fotoUrl: u.foto_url });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/profile ───────────────────────────────────────────────
app.put('/api/profile', async (req, res) => {
  try {
    const { nombre, area, email, fotoUrl } = req.body;

    await q(`
      UPDATE ${DATASET}.users SET
        nombre = @nombre, area = @area, email = @email, foto_url = @fotoUrl,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @id
    `, {
      id: CURRENT_USER_ID, nombre: nombre || '', area: area || '', email: email || null, fotoUrl: fotoUrl || null,
    }, {
      email: 'STRING', fotoUrl: 'STRING',
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/etiquetas ─────────────────────────────────────────────
app.get('/api/etiquetas', async (req, res) => {
  try {
    const rows = await q(`SELECT etiquetas FROM ${DATASET}.creators WHERE etiquetas IS NOT NULL AND etiquetas != '[]'`);
    const extra = new Set();
    rows.forEach(row => {
      try { JSON.parse(row.etiquetas).forEach(t => { if (!DEFAULT_ETIQUETAS.includes(t)) extra.add(t); }); } catch {}
    });
    // Lista base (en orden definido) + etiquetas personalizadas creadas desde la UI (ordenadas)
    res.json([...DEFAULT_ETIQUETAS, ...[...extra].sort()]);
  } catch (err) {
    console.error('GET /api/etiquetas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/campaigns ─────────────────────────────────────────────
app.get('/api/campaigns', async (req, res) => {
  try {
    const [campaigns, ccRows] = await Promise.all([
      q(`SELECT c.*, b.name as brand_name
         FROM ${DATASET}.campaigns c
         LEFT JOIN ${DATASET}.brands b ON c.brand_id = b.brand_id
         ORDER BY c.start_date DESC NULLS LAST`),  
      q(`SELECT * FROM ${DATASET}.campaign_creators ORDER BY fecha_envio`),
    ]);

    const result = campaigns.map(c => ({
      id: c.campaign_id,
      nombre: c.name,
      marca: c.brand_name || c.brand_id,
      estado: STATUS_TO_ES[c.status] || c.status,
      descripcion: c.description || '',
      fechaInicio: c.start_date?.value || c.start_date || '',
      fechaFin: c.end_date?.value || c.end_date || '',
      objetivo: 10,
      ugcs: ccRows
        .filter(cc => cc.campaign_id === c.campaign_id)
        .map(cc => ({
          ugcId: cc.creator_id,
          estado: cc.estado,
          fechaEnvio: cc.fecha_envio?.value || cc.fecha_envio || '',
          fechaRespuesta: cc.fecha_respuesta?.value || cc.fecha_respuesta || null,
        })),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/campaigns/:id ─────────────────────────────────────────
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const status = STATUS_TO_EN[estado] || estado;
    await q(`UPDATE ${DATASET}.campaigns SET status = @status WHERE campaign_id = @id`, { id, status });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/campaigns/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/campaigns ────────────────────────────────────────────
app.post('/api/campaigns', async (req, res) => {
  try {
    const { id, nombre, marca, descripcion, fechaInicio, fechaFin, objetivo, mensajeContacto } = req.body;
    const brandId = marca?.toLowerCase().replace(/\s+/g, '') || 'popeyes';
    await q(`
      INSERT INTO ${DATASET}.campaigns (campaign_id, brand_id, name, slug, start_date, end_date, status, description, mensaje_contacto, created_at)
      VALUES (@id, @brandId, @nombre, @slug, @startDate, @endDate, 'draft', @descripcion, @mensajeContacto, CURRENT_TIMESTAMP())
    `, {
      id, brandId, nombre,
      slug: nombre.toLowerCase().replace(/\s+/g, '-'),
      startDate: fechaInicio || null,
      endDate: fechaFin || null,
      descripcion: descripcion || '',
      mensajeContacto: mensajeContacto || '',
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/campaigns/:id/mensaje ───────────────────────────────
app.patch('/api/campaigns/:id/mensaje', async (req, res) => {
  try {
    const { id } = req.params;
    const { mensajeContacto } = req.body;
    await q(
      `UPDATE ${DATASET}.campaigns SET mensaje_contacto = @mensajeContacto WHERE campaign_id = @id`,
      { id, mensajeContacto: mensajeContacto || '' }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/campaigns/:id/mensaje error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/campaigns/:id/send-message ───────────────────────────
// Placeholder — will trigger n8n/Evolution API in Sprint 2
app.post('/api/campaigns/:id/send-message', (_req, res) => {
  res.status(501).json({ error: 'Not implemented — Evolution API integration pending (Sprint 2)' });
});

// ─── PATCH /api/creators/:id/evaluacion-organica ────────────────────
app.patch('/api/creators/:id/evaluacion-organica', async (req, res) => {
  try {
    const { id } = req.params;
    const { views, shares, engagementRate, completado } = req.body;
    await q(`
      UPDATE ${DATASET}.creators SET
        eval_organica_views           = @views,
        eval_organica_shares          = @shares,
        eval_organica_engagement_rate = @engagementRate,
        eval_organica_completado      = @completado,
        updated_at                    = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `, {
      id,
      views: views ?? null,
      shares: shares ?? null,
      engagementRate: engagementRate ?? null,
      completado: completado ?? false,
    }, {
      views: 'FLOAT64',
      shares: 'FLOAT64',
      engagementRate: 'FLOAT64',
      completado: 'BOOL',
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/creators/:id/evaluacion-organica error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/creators/:id/evaluacion-pauta ───────────────────────
app.patch('/api/creators/:id/evaluacion-pauta', async (req, res) => {
  try {
    const { id } = req.params;
    const { impresiones, alcance, cpm, frecuencia, ctr, vtr, vistas, er, completado } = req.body;
    await q(`
      UPDATE ${DATASET}.creators SET
        eval_pauta_impresiones = @impresiones,
        eval_pauta_alcance     = @alcance,
        eval_pauta_cpm         = @cpm,
        eval_pauta_frecuencia  = @frecuencia,
        eval_pauta_ctr         = @ctr,
        eval_pauta_vtr         = @vtr,
        eval_pauta_vistas      = @vistas,
        eval_pauta_er          = @er,
        eval_pauta_completado  = @completado,
        updated_at             = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `, {
      id,
      impresiones: impresiones ?? null,
      alcance: alcance ?? null,
      cpm: cpm ?? null,
      frecuencia: frecuencia ?? null,
      ctr: ctr ?? null,
      vtr: vtr ?? null,
      vistas: vistas ?? null,
      er: er ?? null,
      completado: completado ?? false,
    }, {
      impresiones: 'INT64',
      alcance: 'INT64',
      cpm: 'FLOAT64',
      frecuencia: 'FLOAT64',
      ctr: 'FLOAT64',
      vtr: 'FLOAT64',
      vistas: 'INT64',
      er: 'FLOAT64',
      completado: 'BOOL',
    });

    const scoreResult = await recalcularScore(id).catch(() => null);
    res.json({ ok: true, ...(scoreResult ?? {}) });
  } catch (err) {
    console.error('PATCH /api/creators/:id/evaluacion-pauta error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creators/:id/scrape ──────────────────────────────────
// Triggers a Kernel scrape for a single creator and returns updated eval_perfil data.
app.post('/api/creators/:id/scrape', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await scrapeCreatorProfiles([id]);

    if (result.failed.length) {
      return res.status(422).json({ ok: false, error: result.failed[0]?.reason, durationMs: result.durationMs });
    }

    // Re-fetch updated eval_perfil fields to return fresh data
    const [rows] = await bq.query({
      query: `
        SELECT eval_perfil_nombre, eval_perfil_handle, eval_perfil_seguidores,
               eval_perfil_engagement_rate_cuenta, eval_perfil_promedio_vistas,
               eval_perfil_categoria, eval_perfil_rango_edad_seguidores,
               eval_perfil_frecuencia_semanal, eval_perfil_videos_virales,
               eval_perfil_last_scraped_at
        FROM ${DATASET}.creators WHERE creator_id = @id
      `,
      params: { id },
      location: 'US',
    });

    const c = rows[0] ?? {};
    const evaluacionPerfil = c.eval_perfil_seguidores != null ? {
      nombre: c.eval_perfil_nombre ?? '',
      perfil: c.eval_perfil_handle ?? '',
      seguidores: Number(c.eval_perfil_seguidores),
      engagementRateCuenta: c.eval_perfil_engagement_rate_cuenta != null ? Number(c.eval_perfil_engagement_rate_cuenta) : null,
      promedioVistaVideos: c.eval_perfil_promedio_vistas != null ? Number(c.eval_perfil_promedio_vistas) : null,
      categoria: c.eval_perfil_categoria ?? '',
      rangoEdadSeguidores: c.eval_perfil_rango_edad_seguidores ?? '',
      frecuenciaSemanal: c.eval_perfil_frecuencia_semanal != null ? Number(c.eval_perfil_frecuencia_semanal) : null,
      videosVirales: c.eval_perfil_videos_virales != null ? Number(c.eval_perfil_videos_virales) : null,
      lastScrapedAt: c.eval_perfil_last_scraped_at?.value ?? c.eval_perfil_last_scraped_at ?? '',
    } : null;

    // Score already recalculated by kernel/index.js — fetch updated value
    const [scoreRows] = await bq.query({
      query: `SELECT score FROM ${DATASET}.creators WHERE creator_id = @id`,
      params: { id }, location: 'US',
    });
    const updatedScore = scoreRows[0]?.score != null ? Number(scoreRows[0].score) : undefined;

    res.json({ ok: true, evaluacionPerfil, updatedScore, durationMs: result.durationMs });
  } catch (err) {
    console.error('POST /api/creators/:id/scrape error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/creators/:id/scrape-tiktok ───────────────────────────
// Triggers a Kernel TikTok scrape for a single creator and returns updated tiktok_eval_* data.
app.post('/api/creators/:id/scrape-tiktok', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await scrapeTikTokProfiles([id]);

    if (result.failed.length) {
      return res.status(422).json({ ok: false, error: result.failed[0]?.reason, durationMs: result.durationMs });
    }

    if (!result.success.length) {
      return res.status(422).json({ ok: false, error: 'no_username_tiktok', durationMs: result.durationMs });
    }

    // Re-fetch updated tiktok_eval fields to return fresh data
    const [rows] = await bq.query({
      query: `
        SELECT tiktok_eval_seguidores, tiktok_eval_engagement_rate,
               tiktok_eval_promedio_vistas, tiktok_eval_frecuencia_semanal,
               tiktok_eval_videos_virales, tiktok_eval_last_scraped_at, username_tiktok
        FROM ${DATASET}.creators WHERE creator_id = @id
      `,
      params: { id },
      location: 'US',
    });

    const c = rows[0] ?? {};
    const evaluacionPerfilTiktok = c.tiktok_eval_seguidores != null ? {
      handle: c.username_tiktok ?? '',
      seguidores: Number(c.tiktok_eval_seguidores),
      engagementRate: c.tiktok_eval_engagement_rate != null ? Number(c.tiktok_eval_engagement_rate) : null,
      promedioVistas: c.tiktok_eval_promedio_vistas != null ? Number(c.tiktok_eval_promedio_vistas) : null,
      frecuenciaSemanal: c.tiktok_eval_frecuencia_semanal != null ? Number(c.tiktok_eval_frecuencia_semanal) : null,
      videosVirales: c.tiktok_eval_videos_virales != null ? Number(c.tiktok_eval_videos_virales) : null,
      lastScrapedAt: c.tiktok_eval_last_scraped_at?.value ?? c.tiktok_eval_last_scraped_at ?? '',
    } : null;

    // Score already recalculated by kernel/index.js — fetch updated value
    const [scoreRows] = await bq.query({
      query: `SELECT score FROM ${DATASET}.creators WHERE creator_id = @id`,
      params: { id }, location: 'US',
    });
    const updatedScore = scoreRows[0]?.score != null ? Number(scoreRows[0].score) : undefined;

    res.json({ ok: true, evaluacionPerfilTiktok, updatedScore, durationMs: result.durationMs });
  } catch (err) {
    console.error('POST /api/creators/:id/scrape-tiktok error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/campaigns/:id/assign ─────────────────────────────────
// Assigns a creator to a campaign (inserts into campaign_creators if not already there).
app.post('/api/campaigns/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorId } = req.body;
    if (!creatorId) return res.status(400).json({ error: 'creatorId required' });

    const campaigns = await q(`SELECT brand_id FROM ${DATASET}.campaigns WHERE campaign_id = @id`, { id });
    if (!campaigns.length) return res.status(404).json({ error: 'Campaign not found' });
    const brandId = campaigns[0].brand_id;

    const rowId = `${id}_${creatorId}`;
    const today = new Date().toISOString().split('T')[0];

    const existing = await q(`SELECT 1 FROM ${DATASET}.campaign_creators WHERE id = @rowId LIMIT 1`, { rowId });
    if (!existing.length) {
      await q(`
        INSERT INTO ${DATASET}.campaign_creators (id, campaign_id, creator_id, brand_id, estado, fecha_envio)
        VALUES (@rowId, @id, @creatorId, @brandId, 'Pendiente', @today)
      `, { rowId, id, creatorId, brandId, today });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/campaigns/:id/assign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/campaigns/:id/creators/:creatorId ──────────────────
app.delete('/api/campaigns/:id/creators/:creatorId', async (req, res) => {
  try {
    const { id, creatorId } = req.params;
    await q(`DELETE FROM ${DATASET}.campaign_creators WHERE campaign_id = @id AND creator_id = @creatorId`, { id, creatorId });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/campaigns/:id/creators/:creatorId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creators/:id/messages ────────────────────────────────
app.post('/api/creators/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, texto, fecha } = req.body;
    if (!tipo || !texto) return res.status(400).json({ error: 'tipo and texto required' });

    const creators = await q(`SELECT brand_id FROM ${DATASET}.creators WHERE creator_id = @id`, { id });
    const brandId = creators[0]?.brand_id || 'unknown';

    const ordenRows = await q(`SELECT COALESCE(MAX(orden), 0) + 1 AS next_orden FROM ${DATASET}.messages WHERE creator_id = @id`, { id });
    const nextOrden = Number(ordenRows[0]?.next_orden ?? 1);

    const messageId = `msg-${Date.now()}`;
    await bq.dataset(DATASET).table('messages').insert([{
      message_id: messageId,
      creator_id: id,
      brand_id: brandId,
      tipo,
      texto,
      fecha: fecha || new Date().toLocaleDateString('es-AR'),
      orden: nextOrden,
    }]);

    res.json({ ok: true, message_id: messageId });
  } catch (err) {
    console.error('POST /api/creators/:id/messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/campaigns/:id/scrape-creators ────────────────────────
// Triggers a Kernel batch scrape for all creators assigned to a campaign.
app.post('/api/campaigns/:id/scrape-creators', async (req, res) => {
  try {
    const { id } = req.params;

    const [ccRows] = await bq.query({
      query: `SELECT DISTINCT creator_id FROM ${DATASET}.campaign_creators WHERE campaign_id = @id`,
      params: { id },
      location: 'US',
    });

    const creatorIds = ccRows.map(r => r.creator_id).filter(Boolean);
    if (!creatorIds.length) {
      return res.json({ ok: true, success: [], failed: [], durationMs: 0 });
    }

    const result = await scrapeCreatorProfiles(creatorIds);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/campaigns/:id/scrape-creators error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Campaign content (posteos de campaña) ──────────────────────────
// Mapea una fila de BQ al shape ContenidoCampana del frontend.
function mapContentRow(r) {
  return {
    id: r.content_id,
    campaignId: r.campaign_id,
    creatorId: r.creator_id,
    creatorNombre: r.creator_nombre || r.creator_id,
    platform: r.platform || 'desconocida',
    url: r.content_url,
    views: r.org_views != null ? Number(r.org_views) : null,
    likes: r.org_likes != null ? Number(r.org_likes) : null,
    comments: r.org_comments != null ? Number(r.org_comments) : null,
    shares: r.org_shares != null ? Number(r.org_shares) : null,
    saves: r.org_saves != null ? Number(r.org_saves) : null,
    engagementRate: r.org_engagement_rate != null ? Number(r.org_engagement_rate) : null,
    lastScrapedAt: r.org_last_scraped_at?.value ?? r.org_last_scraped_at ?? null,
    scrapeError: r.scrape_error || null,
  };
}

/** Mapea el resultado en memoria de analyzeSentiment() (server/sentiment-service.js) al shape del frontend. */
function mapSentiment(s) {
  if (!s) return null;
  return {
    positivo: s.positive,
    neutral: s.neutral,
    negativo: s.negative,
    muestras: s.sampleSize,
    actualizadoEn: new Date().toISOString(),
  };
}

/** Mapea una fila de `campaigns` (columnas sentiment_*) al shape del frontend. */
function mapSentimentRow(r) {
  if (!r?.sentiment_updated_at) return null;
  return {
    positivo: Number(r.sentiment_positive ?? 0),
    neutral: Number(r.sentiment_neutral ?? 0),
    negativo: Number(r.sentiment_negative ?? 0),
    muestras: Number(r.sentiment_sample_size ?? 0),
    actualizadoEn: r.sentiment_updated_at?.value ?? r.sentiment_updated_at,
  };
}

// ─── GET /api/campaigns/:id/content ─────────────────────────────────
// Devuelve { content, metricas, creadoresSinPosteos }.
app.get('/api/campaigns/:id/content', async (req, res) => {
  try {
    const { id } = req.params;

    const [contentRows, assigned, sentimentRows] = await Promise.all([
      q(`
        SELECT cc.*, c.full_name AS creator_nombre, c.eval_perfil_categoria AS creator_categoria
        FROM ${DATASET}.campaign_content cc
        LEFT JOIN ${DATASET}.creators c ON cc.creator_id = c.creator_id
        WHERE cc.campaign_id = @id
        ORDER BY cc.created_at
      `, { id }),
      q(`
        SELECT cc.creator_id, c.full_name AS nombre
        FROM ${DATASET}.campaign_creators cc
        LEFT JOIN ${DATASET}.creators c ON cc.creator_id = c.creator_id
        WHERE cc.campaign_id = @id
      `, { id }),
      q(`
        SELECT sentiment_positive, sentiment_neutral, sentiment_negative, sentiment_sample_size, sentiment_updated_at
        FROM ${DATASET}.campaigns WHERE campaign_id = @id
      `, { id }),
    ]);

    const content = contentRows.map(mapContentRow);
    const metricas = computeCampaignMetrics(contentRows);
    const sentimiento = mapSentimentRow(sentimentRows[0]);

    // Creadores asignados a la campaña que aún no tienen NINGÚN posteo cargado
    const conPosteos = new Set(contentRows.map(r => r.creator_id));
    const seen = new Set();
    const creadoresSinPosteos = assigned
      .filter(a => !conPosteos.has(a.creator_id))
      .filter(a => (seen.has(a.creator_id) ? false : (seen.add(a.creator_id), true)))
      .map(a => ({ id: a.creator_id, nombre: a.nombre || a.creator_id }));

    res.json({ content, metricas, creadoresSinPosteos, sentimiento });
  } catch (err) {
    console.error('GET /api/campaigns/:id/content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/campaigns/:id/content ────────────────────────────────
// Body: { creatorId, url }. Inserta una pieza (idempotente por URL).
app.post('/api/campaigns/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorId, url } = req.body;
    if (!creatorId || !url) return res.status(400).json({ error: 'creatorId and url required' });

    const contentId = contentIdFor(id, url);
    const platform = detectPlatform(url) || 'desconocida';

    const existing = await q(`SELECT 1 FROM ${DATASET}.campaign_content WHERE content_id = @contentId LIMIT 1`, { contentId });
    if (existing.length) {
      return res.json({ ok: true, duplicated: true, content: { id: contentId } });
    }

    await q(`
      INSERT INTO ${DATASET}.campaign_content
        (content_id, campaign_id, creator_id, platform, content_url, created_at, updated_at)
      VALUES (@contentId, @id, @creatorId, @platform, @url, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `, { contentId, id, creatorId, platform, url });

    res.json({
      ok: true,
      content: {
        id: contentId, campaignId: id, creatorId, platform, url,
        views: null, likes: null, comments: null, shares: null, saves: null,
        engagementRate: null, lastScrapedAt: null, scrapeError: null,
      },
    });
  } catch (err) {
    console.error('POST /api/campaigns/:id/content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/campaigns/:id/content/:contentId ───────────────────
app.delete('/api/campaigns/:id/content/:contentId', async (req, res) => {
  try {
    const { id, contentId } = req.params;
    await q(`DELETE FROM ${DATASET}.campaign_content WHERE campaign_id = @id AND content_id = @contentId`, { id, contentId });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/campaigns/:id/content/:contentId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/campaigns/:id/scrape-content ─────────────────────────
// Dispara Kernel sobre todas las piezas cargadas y devuelve content + métricas frescas.
app.post('/api/campaigns/:id/scrape-content', async (req, res) => {
  try {
    const { id } = req.params;
    const { sentiment, ...result } = await scrapeCampaignContent(id);

    const contentRows = await q(`
      SELECT cc.*, c.full_name AS creator_nombre, c.eval_perfil_categoria AS creator_categoria
      FROM ${DATASET}.campaign_content cc
      LEFT JOIN ${DATASET}.creators c ON cc.creator_id = c.creator_id
      WHERE cc.campaign_id = @id
      ORDER BY cc.created_at
    `, { id });

    res.json({
      ok: true,
      ...result,
      content: contentRows.map(mapContentRow),
      metricas: computeCampaignMetrics(contentRows),
      sentimiento: mapSentiment(sentiment),
    });
  } catch (err) {
    console.error('POST /api/campaigns/:id/scrape-content error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/creators/:id/content ──────────────────────────────────
// Posteos de un creador en todas sus campañas (para el drawer del UGC).
app.get('/api/creators/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await q(`
      SELECT * FROM ${DATASET}.campaign_content WHERE creator_id = @id ORDER BY created_at
    `, { id });
    res.json(rows.map(mapContentRow));
  } catch (err) {
    console.error('GET /api/creators/:id/content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── TEST AGENT ──────────────────────────────────────────────────────

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_AUTH_VALUE  = process.env.N8N_AUTH_VALUE;

if (!N8N_WEBHOOK_URL || !N8N_AUTH_VALUE) {
  console.warn('⚠️  Test Agent: N8N_WEBHOOK_URL o N8N_AUTH_VALUE no están en .env — el chat con el agente no funcionará hasta que reinicies el servidor.');
}

// SSE: una entrada por conversación activa { conversationId → Express res }
const sseClients = new Map();

// Conversaciones que ya enviaron su primer mensaje a n8n (para el flag new_chat)
const conversationsStarted = new Set();

const NOMBRES_PE = [
  'Valeria', 'Camila', 'Diego', 'Sofía', 'Andrés',
  'Luciana', 'Carlos', 'Fernanda', 'Miguel', 'Daniela',
  'Sebastián', 'Nicole', 'Luis', 'Gabriela', 'Rodrigo',
];

const GREETING_TEMPLATE =
`¡Hola, [Nombre]! 😊 ¿Cómo estás?
Te escribimos desde el equipo de Influencer Marketing de NGR, grupo que reúne marcas como Bembos, Chinawok, Don Belisario, Papa Johns, Dunkin, Popeyes y otras.
Hemos estado siguiendo tu contenido y creemos que tu estilo podría conectar muy bien con futuras campañas de nuestras marcas. Nos gustaría conocerte mejor y tenerte en cuenta para próximas colaboraciones.
Si te interesa, cuéntanos por este medio o compártenos tu correo para enviarte más información cuando surjan oportunidades.
¡Esperamos poder trabajar contigo pronto! 🙌`;

function genAgentId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Llama al webhook de n8n y extrae el texto de la respuesta del agente.
// n8n responde de forma síncrona; esperamos hasta 55 s antes de abortar.
async function callN8N(sessionId, message, userName, newChat) {
  if (!N8N_WEBHOOK_URL || !N8N_AUTH_VALUE) {
    throw new Error('N8N_WEBHOOK_URL o N8N_AUTH_VALUE no configurados en .env');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'nrg-ugc-auth': N8N_AUTH_VALUE,
      },
      body: JSON.stringify({ sessionId, chatInput: message, user_name: userName, new_chat: newChat }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`n8n error ${res.status}: ${text}`);
    }

    const data = await res.json();

    // n8n puede devolver varios formatos según el nodo de respuesta configurado
    if (typeof data === 'string') return data;
    const item = Array.isArray(data) ? data[0] : data;
    return (
      item?.output   ??
      item?.text     ??
      item?.reply    ??
      item?.message  ??
      item?.response ??
      JSON.stringify(item)
    );
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/agent/conversations
// Genera un sessionId único, registra la conversación en BQ y devuelve el saludo hardcodeado
// con un nombre peruano aleatorio para hacer el roleplay más realista.
app.post('/api/agent/conversations', async (req, res) => {
  try {
    const conversationId = genAgentId('conv');
    const nombre = NOMBRES_PE[Math.floor(Math.random() * NOMBRES_PE.length)];
    const greeting = GREETING_TEMPLATE.replace('[Nombre]', nombre);

    await q(
      `INSERT INTO ${DATASET}.agent_conversations (conversation_id, started_at) VALUES (@conversationId, CURRENT_TIMESTAMP())`,
      { conversationId }
    );
    const msgId = genAgentId('msg');
    await q(
      `INSERT INTO ${DATASET}.agent_messages (message_id, conversation_id, role, content, created_at) VALUES (@msgId, @conversationId, 'assistant', @greeting, CURRENT_TIMESTAMP())`,
      { msgId, conversationId, greeting }
    );

    res.json({ conversationId, greeting, userName: nombre });
  } catch (err) {
    console.error('POST /api/agent/conversations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/conversations/:id/messages
// Reenvía el mensaje del usuario a n8n (con el sessionId para que mantenga el contexto)
// y devuelve la respuesta del agente al frontend.
app.post('/api/agent/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, userName } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content requerido' });

    const isNewChat = !conversationsStarted.has(id);
    conversationsStarted.add(id);

    const reply = await callN8N(id, content.trim(), userName, isNewChat);

    // Auditoría en BQ
    const msgIdUser = genAgentId('msg');
    await q(
      `INSERT INTO ${DATASET}.agent_messages (message_id, conversation_id, role, content, created_at) VALUES (@msgIdUser, @id, 'user', @content, CURRENT_TIMESTAMP())`,
      { msgIdUser, id, content: content.trim() }
    );
    const msgIdAI = genAgentId('msg');
    await q(
      `INSERT INTO ${DATASET}.agent_messages (message_id, conversation_id, role, content, created_at) VALUES (@msgIdAI, @id, 'assistant', @reply, CURRENT_TIMESTAMP())`,
      { msgIdAI, id, reply }
    );

    res.json({ reply });
  } catch (err) {
    console.error('POST /api/agent/conversations/:id/messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/conversations/:id/feedback — guarda el feedback del cliente sobre el chat
app.post('/api/agent/conversations/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;
    if (!feedback?.trim()) return res.status(400).json({ error: 'feedback requerido' });

    await q(
      `UPDATE ${DATASET}.agent_conversations SET feedback = @feedback, feedback_at = CURRENT_TIMESTAMP() WHERE conversation_id = @id`,
      { id, feedback: feedback.trim() }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/agent/conversations/:id/feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE ─────────────────────────────────────────────────────────────
// GET /api/agent/conversations/:id/events
// El browser se conecta aquí al iniciar un chat. Mantiene el canal abierto
// para recibir eventos push (ugc_update) en tiempo real.
app.get('/api/agent/conversations/:id/events', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // evita buffering en nginx/proxies
  if (res.socket) res.socket.setNoDelay(true);
  res.flushHeaders();

  sseClients.set(id, res);

  // Heartbeat cada 25 s para mantener viva la conexión
  const heartbeat = setInterval(() => res.write(':ping\n\n'), 25_000);

  req.on('close', () => {
    sseClients.delete(id);
    clearInterval(heartbeat);
  });
});

// POST /api/agent/conversations/:id/update-ugc
// n8n llama a este endpoint como tool. El servidor pushea los campos al browser
// vía SSE. Requiere el mismo header de auth que el webhook.
app.post('/api/agent/conversations/:id/update-ugc', (req, res) => {
  const { id } = req.params;

  if (req.headers['nrg-ugc-auth'] !== N8N_AUTH_VALUE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fields = req.body; // objeto arbitrario { campo: valor, ... }
  const timestamp = new Date().toISOString();

  const client = sseClients.get(id);
  if (client) {
    client.write(`data: ${JSON.stringify({ type: 'ugc_update', fields, timestamp })}\n\n`);
  }

  console.log(`[Test Agent] update-ugc conv=${id} notified=${!!client}`, fields);
  res.json({ ok: true, notified: !!client });
});

// POST /api/agent/conversations/:id/human-handoff
// n8n llama a este endpoint cuando el agente decide derivar a un humano.
// Pushea un evento SSE de tipo 'human_handoff' al browser.
app.post('/api/agent/conversations/:id/human-handoff', (req, res) => {
  const { id } = req.params;

  if (req.headers['nrg-ugc-auth'] !== N8N_AUTH_VALUE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fields = req.body;
  const timestamp = new Date().toISOString();

  const client = sseClients.get(id);
  if (client) {
    client.write(`data: ${JSON.stringify({ type: 'human_handoff', fields, timestamp })}\n\n`);
  }

  console.log(`[Test Agent] human-handoff conv=${id} notified=${!!client}`, fields);
  res.json({ ok: true, notified: !!client });
});

// Export the app for use as Vite middleware
export { app };

// Standalone mode: only listen when run directly (node server/index.js)
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
