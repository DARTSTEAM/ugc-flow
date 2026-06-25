import 'dotenv/config'; // loads .env in dev; no-op in Cloud Run where vars are already injected
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';
import { scrapeCreatorProfiles, scrapeTikTokProfiles } from './kernel/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const bq = new BigQuery({ projectId: 'bigquery-388915' });
const DATASET = 'ngr_ugc';

function q(sql, params) {
  return bq.query({ query: sql, params, location: 'US' }).then(([rows]) => rows);
}

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
      q(`SELECT * FROM ${DATASET}.creator_scores WHERE creator_id = @id`, { id }),
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
      lastScrapedAt: c.eval_perfil_last_scraped_at?.value ?? c.eval_perfil_last_scraped_at ?? '',
    } : undefined;

    const evalPerfilTiktok = c.tiktok_eval_seguidores != null ? {
      handle: c.username_tiktok ?? '',
      seguidores: Number(c.tiktok_eval_seguidores),
      engagementRate: c.tiktok_eval_engagement_rate != null ? Number(c.tiktok_eval_engagement_rate) : null,
      promedioVistas: c.tiktok_eval_promedio_vistas != null ? Number(c.tiktok_eval_promedio_vistas) : null,
      lastScrapedAt: c.tiktok_eval_last_scraped_at?.value ?? c.tiktok_eval_last_scraped_at ?? '',
    } : undefined;

    const evalOrganica = c.eval_organica_completado ? {
      views: c.eval_organica_views ?? undefined,
      shares: c.eval_organica_shares ?? undefined,
      engagementRate: c.eval_organica_engagement_rate ?? undefined,
      hookNatural: c.eval_organica_hook_natural ?? undefined,
      completado: true,
    } : undefined;

    const evalPauta = c.eval_pauta_completado ? {
      impresiones: c.eval_pauta_impresiones ?? undefined,
      alcance: c.eval_pauta_alcance ?? undefined,
      cpm: c.eval_pauta_cpm ?? undefined,
      frecuencia: c.eval_pauta_frecuencia ?? undefined,
      ctr: c.eval_pauta_ctr ?? undefined,
      vtr: c.eval_pauta_vtr ?? undefined,
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

// ─── GET /api/etiquetas ─────────────────────────────────────────────
app.get('/api/etiquetas', async (req, res) => {
  try {
    const rows = await q(`SELECT etiquetas FROM ${DATASET}.creators WHERE etiquetas IS NOT NULL AND etiquetas != '[]'`);
    const tagSet = new Set();
    rows.forEach(row => {
      try { JSON.parse(row.etiquetas).forEach(t => tagSet.add(t)); } catch {}
    });
    res.json([...tagSet].sort());
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
    const { views, shares, engagementRate, hookNatural, completado } = req.body;
    await q(`
      UPDATE ${DATASET}.creators SET
        eval_organica_views           = @views,
        eval_organica_shares          = @shares,
        eval_organica_engagement_rate = @engagementRate,
        eval_organica_hook_natural    = @hookNatural,
        eval_organica_completado      = @completado,
        updated_at                    = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `, {
      id,
      views: views ?? null,
      shares: shares ?? null,
      engagementRate: engagementRate ?? null,
      hookNatural: hookNatural ?? null,
      completado: completado ?? false,
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
    const { impresiones, alcance, cpm, frecuencia, ctr, vtr, completado } = req.body;
    await q(`
      UPDATE ${DATASET}.creators SET
        eval_pauta_impresiones = @impresiones,
        eval_pauta_alcance     = @alcance,
        eval_pauta_cpm         = @cpm,
        eval_pauta_frecuencia  = @frecuencia,
        eval_pauta_ctr         = @ctr,
        eval_pauta_vtr         = @vtr,
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
      completado: completado ?? false,
    });
    res.json({ ok: true });
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
               eval_perfil_categoria, eval_perfil_rango_edad_seguidores, eval_perfil_last_scraped_at
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
      lastScrapedAt: c.eval_perfil_last_scraped_at?.value ?? c.eval_perfil_last_scraped_at ?? '',
    } : null;

    res.json({ ok: true, evaluacionPerfil, durationMs: result.durationMs });
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
               tiktok_eval_promedio_vistas, tiktok_eval_last_scraped_at, username_tiktok
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
      lastScrapedAt: c.tiktok_eval_last_scraped_at?.value ?? c.tiktok_eval_last_scraped_at ?? '',
    } : null;

    res.json({ ok: true, evaluacionPerfilTiktok, durationMs: result.durationMs });
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

// Export the app for use as Vite middleware
export { app };

// Standalone mode: only listen when run directly (node server/index.js)
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
