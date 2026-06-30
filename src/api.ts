import type { UGC, Campana, EvaluacionOrganica, EvaluacionPauta, EvaluacionPerfil, EvaluacionPerfilTiktok, ContenidoCampana, CampaignContentResponse, MetricasCampana } from './data';

const BASE = '/api';

async function json<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Creators ───────────────────────────────────────────────────────

export async function fetchCreators(): Promise<UGC[]> {
  return json<UGC[]>('/creators');
}

export async function fetchCreatorDetail(id: string): Promise<UGC> {
  return json<UGC>(`/creators/${id}`);
}

export async function updateCreator(ugc: UGC): Promise<void> {
  await json(`/creators/${ugc.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      nombre: ugc.nombre,
      canal: ugc.canal,
      estado: ugc.estado,
      score: ugc.score,
      bio: ugc.bio,
      campanasignada: ugc.campanasignada,
      seguidores: ugc.seguidores,
      username: ugc.username,
      etiquetas: ugc.etiquetas,
      usernameTiktok: ugc.usernameTiktok,
    }),
  });
}

export async function deleteCreator(id: string): Promise<void> {
  await json(`/creators/${id}`, { method: 'DELETE' });
}

export async function updateEtiquetas(id: string, etiquetas: string[]): Promise<void> {
  await json(`/creators/${id}/etiquetas`, {
    method: 'PATCH',
    body: JSON.stringify({ etiquetas }),
  });
}

export async function updateEvaluacionOrganica(
  id: string,
  data: Omit<EvaluacionOrganica, 'completado'>
): Promise<void> {
  await json(`/creators/${id}/evaluacion-organica`, {
    method: 'PATCH',
    body: JSON.stringify({ ...data, completado: true }),
  });
}

export async function updateEvaluacionPauta(
  id: string,
  data: Omit<EvaluacionPauta, 'completado'>
): Promise<{ ok: boolean; total?: number; breakdown?: { criterio: string; puntos: number; maximo: number }[] }> {
  return json(`/creators/${id}/evaluacion-pauta`, {
    method: 'PATCH',
    body: JSON.stringify({ ...data, completado: true }),
  });
}

// ─── Campaigns ──────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campana[]> {
  return json<Campana[]>('/campaigns');
}

export async function deleteCampaign(id: string): Promise<void> {
  await json(`/campaigns/${id}`, { method: 'DELETE' });
}

export async function updateCampaignStatus(id: string, estado: string): Promise<void> {
  await json(`/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });
}

export async function createCampaign(campana: Campana): Promise<void> {
  await json('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      id: campana.id,
      nombre: campana.nombre,
      marca: campana.marca,
      descripcion: campana.descripcion,
      fechaInicio: campana.fechaInicio,
      fechaFin: campana.fechaFin,
      objetivo: campana.objetivo,
      mensajeContacto: campana.mensajeContacto,
    }),
  });
}

export async function updateCampaignMensaje(id: string, mensajeContacto: string): Promise<void> {
  await json(`/campaigns/${id}/mensaje`, {
    method: 'PATCH',
    body: JSON.stringify({ mensajeContacto }),
  });
}

export async function assignCreatorToCampaign(campaignId: string, creatorId: string): Promise<void> {
  await json(`/campaigns/${campaignId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ creatorId }),
  });
}

export async function removeCreatorFromCampaign(campaignId: string, creatorId: string): Promise<void> {
  await json(`/campaigns/${campaignId}/creators/${creatorId}`, { method: 'DELETE' });
}

export async function sendCreatorMessage(creatorId: string, tipo: 'saliente' | 'entrante', texto: string, fecha?: string): Promise<void> {
  await json(`/creators/${creatorId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ tipo, texto, fecha }),
  });
}

/** Placeholder — will trigger n8n/Evolution API in Sprint 2 */
export async function sendCampaignMessage(id: string): Promise<void> {
  await json(`/campaigns/${id}/send-message`, { method: 'POST' });
}

// ─── Kernel Scraping ────────────────────────────────────────────────

export async function scrapeCreator(
  id: string
): Promise<{ ok: boolean; evaluacionPerfil: EvaluacionPerfil | null; updatedScore?: number; durationMs: number }> {
  return json(`/creators/${id}/scrape`, { method: 'POST' });
}

export async function scrapeCreatorsByCampaign(
  campaignId: string
): Promise<{ ok: boolean; success: string[]; failed: Array<{ id: string; reason: string }>; durationMs: number }> {
  return json(`/campaigns/${campaignId}/scrape-creators`, { method: 'POST' });
}

export async function scrapeTikTokCreator(
  id: string
): Promise<{ ok: boolean; evaluacionPerfilTiktok: EvaluacionPerfilTiktok | null; updatedScore?: number; durationMs: number }> {
  return json(`/creators/${id}/scrape-tiktok`, { method: 'POST' });
}

// ─── Campaign content (posteos de campaña) ──────────────────────────

export async function fetchCampaignContent(campaignId: string): Promise<CampaignContentResponse> {
  return json<CampaignContentResponse>(`/campaigns/${campaignId}/content`);
}

export async function addCampaignContent(
  campaignId: string, creatorId: string, url: string
): Promise<{ ok: boolean; duplicated?: boolean; content: ContenidoCampana }> {
  return json(`/campaigns/${campaignId}/content`, {
    method: 'POST',
    body: JSON.stringify({ creatorId, url }),
  });
}

export async function deleteCampaignContent(campaignId: string, contentId: string): Promise<void> {
  await json(`/campaigns/${campaignId}/content/${contentId}`, { method: 'DELETE' });
}

export async function scrapeCampaignContent(
  campaignId: string
): Promise<{ ok: boolean; success: string[]; failed: Array<{ id: string; reason: string }>; content: ContenidoCampana[]; metricas: MetricasCampana | null; durationMs: number }> {
  return json(`/campaigns/${campaignId}/scrape-content`, { method: 'POST' });
}

export async function fetchCreatorContent(creatorId: string): Promise<ContenidoCampana[]> {
  return json<ContenidoCampana[]>(`/creators/${creatorId}/content`);
}
