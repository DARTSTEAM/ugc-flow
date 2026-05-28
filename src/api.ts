import type { UGC, Campana } from './data';

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
    }),
  });
}

export async function deleteCreator(id: string): Promise<void> {
  await json(`/creators/${id}`, { method: 'DELETE' });
}

// ─── Campaigns ──────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campana[]> {
  return json<Campana[]>('/campaigns');
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
    }),
  });
}
