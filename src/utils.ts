import type { Canal, EstadoUGC, EstadoCampana, EstadoEnCampana } from './data';

// ─── Score helpers ──────────────────────────────────────────────────────────

export function scoreColor(score: number) {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (score >= 40) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' };
}

// ─── Badge configs ──────────────────────────────────────────────────────────

export const ESTADO_UGC_CONFIG: Record<EstadoUGC, { label: string; className: string }> = {
  Nuevo:      { label: 'Nuevo',      className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  Contactado: { label: 'Contactado', className: 'bg-blue-50 text-blue-700 border border-blue-100' },
  Respondió:  { label: 'Respondió',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Calificado: { label: 'Calificado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Descartado: { label: 'Descartado', className: 'bg-rose-50 text-rose-700 border border-rose-200' },
};

export const CANAL_CONFIG: Record<Canal, { label: string; className: string; dot: string }> = {
  WhatsApp:  { label: 'WhatsApp',  className: 'bg-green-50 text-green-700 border border-green-200',  dot: 'bg-green-500' },
  Instagram: { label: 'Instagram', className: 'bg-purple-50 text-purple-700 border border-purple-200', dot: 'bg-purple-500' },
  Email:     { label: 'Email',     className: 'bg-sky-50 text-sky-700 border border-sky-200',         dot: 'bg-sky-500' },
};

export const ESTADO_CAMPANA_CONFIG: Record<EstadoCampana, { label: string; className: string }> = {
  Borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  Activa:   { label: 'Activa',   className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Pausada:  { label: 'Pausada',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Cerrada:  { label: 'Cerrada',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

export const ESTADO_EN_CAMPANA_CONFIG: Record<EstadoEnCampana, { label: string; className: string }> = {
  Enviado:    { label: 'Enviado',    className: 'bg-blue-50 text-blue-700 border border-blue-100' },
  Respondió:  { label: 'Respondió',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Pendiente:  { label: 'Pendiente',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  Calificado: { label: 'Calificado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'No aplica':{ label: 'No aplica',  className: 'bg-rose-50 text-rose-600 border border-rose-100' },
};

// ─── Avatar initials ────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
];

export function avatarColor(id: string) {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
