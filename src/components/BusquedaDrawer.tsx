import { useState } from 'react';
import { X, MapPin, Users, TrendingUp, Hash, Calendar, Clock, FileText, Download, Trash2 } from 'lucide-react';
import { getInitials, avatarColor } from '../utils';
import ConfirmDeleteModal from './ConfirmDeleteModal';

// ── Types ──────────────────────────────────────────────────────────────────
export type EstadoBusqueda = 'En progreso' | 'Completada' | 'Borrador';

export interface Busqueda {
  id: string;
  nombre: string;
  plataformas: string[];
  nichos: string[];
  seguidoresMin: number;
  seguidoresMax: number;
  engagementMin: number;
  ubicacion: string;
  hashtags: string[];
  estado: EstadoBusqueda;
  fecha: string;
  resultados: number;
  descripcion?: string;
}

// ── Static config ───────────────────────────────────────────────────────────
const ESTADO_CFG: Record<EstadoBusqueda, { badge: string; dot: string }> = {
  'En progreso': { badge: 'bg-blue-50 text-blue-700 border border-blue-100',         dot: 'bg-blue-500' },
  'Completada':  { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  'Borrador':    { badge: 'bg-stone-100 text-stone-600 border border-stone-200',      dot: 'bg-stone-400' },
};

const PLATAFORMA_BADGE: Record<string, string> = {
  Instagram: 'bg-purple-50 text-purple-700 border border-purple-200',
  TikTok:    'bg-zinc-800 text-white border border-zinc-700',
  YouTube:   'bg-red-50 text-red-700 border border-red-200',
};

// ── Mock results ────────────────────────────────────────────────────────────
interface ResultadoMock {
  id: string;
  nombre: string;
  plataforma: string;
  seguidores: string;
  engagement: string;
  nicho: string;
}

const MOCK_RESULTADOS: Record<string, ResultadoMock[]> = {
  'b-001': [
    { id: 'r1', nombre: 'Valentina Torres',  plataforma: 'Instagram', seguidores: '24.5K', engagement: '4.2%', nicho: 'Gastronomía' },
    { id: 'r2', nombre: 'Lucas Méndez',       plataforma: 'TikTok',    seguidores: '31.2K', engagement: '6.8%', nicho: 'Foodie'       },
    { id: 'r3', nombre: 'Camila Ruiz',        plataforma: 'Instagram', seguidores: '18.7K', engagement: '5.1%', nicho: 'Lifestyle'    },
    { id: 'r4', nombre: 'Rodrigo Solís',      plataforma: 'TikTok',    seguidores: '42.1K', engagement: '3.9%', nicho: 'Gastronomía' },
    { id: 'r5', nombre: 'Florencia Acosta',   plataforma: 'Instagram', seguidores: '12.3K', engagement: '7.2%', nicho: 'Foodie'       },
  ],
  'b-002': [
    { id: 'r1', nombre: 'Sofía Ramírez',   plataforma: 'Instagram', seguidores: '45.2K', engagement: '5.8%', nicho: 'Skincare' },
    { id: 'r2', nombre: 'Martina López',    plataforma: 'Instagram', seguidores: '28.9K', engagement: '6.1%', nicho: 'Belleza'  },
    { id: 'r3', nombre: 'Julia Fernández', plataforma: 'Instagram', seguidores: '19.3K', engagement: '8.4%', nicho: 'Wellness' },
    { id: 'r4', nombre: 'Carla Méndez',    plataforma: 'Instagram', seguidores: '36.4K', engagement: '4.7%', nicho: 'Skincare' },
  ],
  'b-004': [
    { id: 'r1', nombre: 'Pablo Guerrero', plataforma: 'Instagram', seguidores: '52.1K', engagement: '6.2%', nicho: 'Fitness'    },
    { id: 'r2', nombre: 'Diego Herrera',  plataforma: 'TikTok',    seguidores: '38.7K', engagement: '8.1%', nicho: 'Wellness'   },
    { id: 'r3', nombre: 'Ana Castillo',   plataforma: 'YouTube',   seguidores: '71.3K', engagement: '4.5%', nicho: 'Nutrición'  },
    { id: 'r4', nombre: 'Marcos Vega',    plataforma: 'Instagram', seguidores: '24.8K', engagement: '7.3%', nicho: 'Fitness'    },
    { id: 'r5', nombre: 'Elena Torres',   plataforma: 'TikTok',    seguidores: '16.2K', engagement: '9.1%', nicho: 'Wellness'   },
    { id: 'r6', nombre: 'Joaquín Ruiz',   plataforma: 'Instagram', seguidores: '33.5K', engagement: '5.6%', nicho: 'Fitness'    },
  ],
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ── Component ───────────────────────────────────────────────────────────────
interface Props {
  busqueda: Busqueda;
  onClose: () => void;
  onDelete?: () => void;
}

export default function BusquedaDrawer({ busqueda, onClose, onDelete }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const ecfg = ESTADO_CFG[busqueda.estado];
  const resultados = MOCK_RESULTADOS[busqueda.id] || [];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end overlay-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:w-[580px] h-dvh flex flex-col drawer-enter"
        style={{ backgroundColor: 'var(--color-bg-app)', boxShadow: 'var(--shadow-drawer)' }}
      >
        {/* ── Drawer header ──────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="flex-1 min-w-0 mr-4">
            {/* badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-lg ${ecfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ecfg.dot}`} />
                {busqueda.estado}
              </span>
              {busqueda.plataformas.map(p => (
                <span key={p} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${PLATAFORMA_BADGE[p] ?? 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
                  {p}
                </span>
              ))}
            </div>
            <h2 className="text-lg font-black leading-tight" style={{ color: 'var(--color-text-1)' }}>
              {busqueda.nombre}
            </h2>
            {busqueda.descripcion && (
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
                {busqueda.descripcion}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Eliminar búsqueda"
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.92]"
                style={{ color: '#e11d48', backgroundColor: '#fff1f2' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ffe4e6')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff1f2')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.92]"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-alt)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Parámetros */}
          <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-3)' }}>
              Parámetros de búsqueda
            </p>

            {/* 3 stat mini-cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { icon: Users,     label: 'Seguidores',  value: `${fmtNum(busqueda.seguidoresMin)} – ${fmtNum(busqueda.seguidoresMax)}` },
                { icon: TrendingUp,label: 'Engagement',  value: `≥ ${busqueda.engagementMin}%` },
                { icon: Calendar,  label: 'Fecha',       value: busqueda.fecha },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center border"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
                >
                  <Icon className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: 'var(--color-text-3)' }} />
                  <p className="text-xs font-bold leading-tight" style={{ color: 'var(--color-text-1)' }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 mb-3.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>{busqueda.ubicacion}</span>
            </div>

            {/* Nichos */}
            <div className="mb-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-3)' }}>Nichos</p>
              <div className="flex flex-wrap gap-1.5">
                {busqueda.nichos.map(n => (
                  <span
                    key={n}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>

            {/* Hashtags */}
            {busqueda.hashtags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-3)' }}>Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {busqueda.hashtags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                    >
                      <Hash className="w-2.5 h-2.5" />
                      {tag.replace('#', '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resultados */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>
                Resultados
              </p>
              {busqueda.resultados > 0 && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  {busqueda.resultados} encontrados
                </span>
              )}
            </div>

            {busqueda.estado === 'Borrador' ? (
              /* Empty state – not started */
              <div
                className="rounded-2xl p-8 text-center border-2 border-dashed"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'var(--color-surface-alt)' }}
                >
                  <FileText className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-2)' }}>
                  Búsqueda en borrador
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                  Iniciá la búsqueda para ver creadores encontrados
                </p>
              </div>
            ) : resultados.length === 0 ? (
              /* In progress with no mock data yet */
              <div
                className="rounded-2xl p-8 text-center border"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-3)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  Procesando resultados...
                </p>
              </div>
            ) : (
              /* Creators list */
              <div className="space-y-2">
                {resultados.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px var(--color-brand-border)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(r.id)}`}>
                      {getInitials(r.nombre)}
                    </div>
                    {/* Name + niche */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{r.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{r.nicho}</p>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold font-mono" style={{ color: 'var(--color-text-1)' }}>{r.seguidores}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>seguidores</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono text-emerald-600">{r.engagement}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>engage</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${PLATAFORMA_BADGE[r.plataforma] ?? 'bg-stone-100 text-stone-600'}`}>
                        {r.plataforma}
                      </span>
                    </div>
                  </div>
                ))}
                {busqueda.resultados > resultados.length && (
                  <p className="text-xs text-center pt-2 pb-1" style={{ color: 'var(--color-text-3)' }}>
                    +{busqueda.resultados - resultados.length} más resultados disponibles
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Drawer footer ───────────────────────────────────── */}
        {busqueda.estado !== 'Borrador' && busqueda.resultados > 0 && (
          <div
            className="px-6 py-4 border-t flex items-center gap-2 flex-shrink-0"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
          >
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-alt)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface)')}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
            >
              <Users className="w-4 h-4" />
              Agregar a UGCs
            </button>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        itemName={busqueda.nombre}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete?.(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
