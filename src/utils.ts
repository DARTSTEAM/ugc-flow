import type { Canal, EstadoUGC, EstadoCampana, EstadoEnCampana, UGC, Campana } from './data';

// ─── Score helpers ──────────────────────────────────────────────────────────

export function scoreColor(score: number) {
  if (score >= 70) return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg:  'bg-emerald-50 dark:bg-emerald-300/10',
  };
  if (score >= 40) return {
    bar: 'bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    bg:  'bg-amber-50 dark:bg-amber-300/10',
  };
  return {
    bar: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
    bg:  'bg-rose-50 dark:bg-rose-300/10',
  };
}

// ─── Badge configs ──────────────────────────────────────────────────────────

export const ESTADO_UGC_CONFIG: Record<EstadoUGC, { label: string; className: string }> = {
  Pendiente:        { label: 'Pendiente',       className: 'bg-stone-100 dark:bg-stone-300/10 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-300/20' },
  'En Negociación': { label: 'En Negociación',  className: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20' },
  Activo:           { label: 'Activo',          className: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-300/20' },
  Descartado:       { label: 'Descartado',      className: 'bg-rose-50 dark:bg-rose-300/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-300/20' },
  Inactivo:         { label: 'Inactivo',        className: 'bg-slate-100 dark:bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-400/20' },
};

export const CANAL_CONFIG: Record<Canal, { label: string; className: string; dot: string }> = {
  WhatsApp:  { label: 'WhatsApp',  className: 'bg-green-50 dark:bg-green-300/10 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-300/20',   dot: 'bg-green-500' },
  Instagram: { label: 'Instagram', className: 'bg-purple-50 dark:bg-purple-300/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-300/20', dot: 'bg-purple-500' },
};

export const ESTADO_CAMPANA_CONFIG: Record<EstadoCampana, { label: string; className: string }> = {
  Borrador: { label: 'Borrador', className: 'bg-stone-100 dark:bg-stone-300/10 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-300/20' },
  Activa:   { label: 'Activa',   className: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-300/20' },
  Pausada:  { label: 'Pausada',  className: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20' },
  Cerrada:  { label: 'Cerrada',  className: 'bg-stone-100 dark:bg-stone-300/8 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-300/15' },
};

export const ESTADO_EN_CAMPANA_CONFIG: Record<EstadoEnCampana, { label: string; className: string }> = {
  Pendiente:         { label: 'Pendiente',        className: 'bg-stone-100 dark:bg-stone-300/10 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-300/20' },
  'En Negociación':  { label: 'En Negociación',   className: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20' },
  Activo:            { label: 'Activo',           className: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-300/20' },
  Descartado:        { label: 'Descartado',       className: 'bg-rose-50 dark:bg-rose-300/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-300/20' },
};

// ─── Avatar initials ────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export const AVATAR_COLORS = [
  'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300',
  'bg-sky-100 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300',
  'bg-emerald-100 dark:bg-emerald-300/10 text-emerald-700 dark:text-emerald-300',
  'bg-amber-100 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300',
  'bg-pink-100 dark:bg-pink-300/10 text-pink-700 dark:text-pink-300',
  'bg-indigo-100 dark:bg-indigo-300/10 text-indigo-700 dark:text-indigo-300',
  'bg-teal-100 dark:bg-teal-300/10 text-teal-700 dark:text-teal-300',
  'bg-rose-100 dark:bg-rose-300/10 text-rose-700 dark:text-rose-300',
];

export function avatarColor(id: string) {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Evaluation helpers ─────────────────────────────────────────────────────

/** Returns true if the UGC is missing organic content OR pauta evaluation */
export function needsInfoUpdate(ugc: UGC): boolean {
  return !ugc.evaluacionOrganica?.completado || !ugc.evaluacionPauta?.completado;
}

/** Formats an ISO timestamp as a human-readable date in Spanish */
export function formatLastScraped(isoString: string | undefined): string {
  if (!isoString) return 'Sin datos';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Followers helpers ──────────────────────────────────────────────────────

/** Resolves a UGC's follower count as a number, preferring the exact scraped Instagram value. */
export function parseFollowersNum(ugc: UGC): number {
  const exact = ugc.evaluacionPerfil?.seguidores;
  if (exact) return exact;
  const s = ugc.seguidores;
  if (!s) return 0;
  const lower = s.toLowerCase().replace(',', '.');
  if (lower.endsWith('k')) return parseFloat(lower) * 1000;
  if (lower.endsWith('m')) return parseFloat(lower) * 1000000;
  return parseInt(lower, 10) || 0;
}

// ─── Campaign history helpers ───────────────────────────────────────────────

/** True if the creator was Activo in at least one Cerrada campaign — i.e., already worked with NGR. */
export function haTrabajadoConNGR(ugc: UGC, campanas: Campana[]): boolean {
  return campanas.some(c =>
    c.estado === 'Cerrada' && c.ugcs.some(cu => cu.ugcId === ugc.id && cu.estado === 'Activo')
  );
}
