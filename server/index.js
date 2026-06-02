import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';

const app = express();
app.use(cors());
app.use(express.json());

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
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
               ultima_actividad, campana_asignada, seguidores_display, bio, brand_id
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

    res.json({
      id: c.creator_id,
      nombre: c.full_name,
      canal: c.canal || 'Instagram',
      estado: c.estado || 'Nuevo',
      score: c.score || 0,
      ultimaActividad: c.ultima_actividad || '',
      campanasignada: c.campana_asignada || null,
      seguidores: c.seguidores_display || '',
      bio: c.bio || '',
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
    const { nombre, canal, estado, score, bio, campanasignada, seguidores } = req.body;

    await q(`
      UPDATE ${DATASET}.creators SET
        full_name = @nombre, canal = @canal, estado = @estado,
        score = @score, bio = @bio, campana_asignada = @campanasignada,
        seguidores_display = @seguidores, updated_at = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `, { id, nombre, canal, estado, score: score || 0, bio: bio || '', campanasignada: campanasignada || '', seguidores: seguidores || '' });

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

// Export the app for use as Vite middleware
export { app };

// Standalone mode: only listen when run directly (node server/index.js)
const isMain = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
