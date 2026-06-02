import { useState } from 'react';
import { Plus, MapPin, Users, TrendingUp, Calendar, ArrowRight, Search, Clock, CheckCircle2, FileText } from 'lucide-react';
import type { Busqueda, EstadoBusqueda } from './BusquedaDrawer';
import BusquedaDrawer from './BusquedaDrawer';
import NuevaBusquedaModal from './NuevaBusquedaModal';

// ── Mock data ───────────────────────────────────────────────────────────────
const BUSQUEDAS_MOCK: Busqueda[] = [
  {
    id: 'b-001',
    nombre: 'Food Lovers CABA',
    plataformas: ['Instagram', 'TikTok'],
    nichos: ['Gastronomía', 'Lifestyle'],
    seguidoresMin: 5_000,
    seguidoresMax: 50_000,
    engagementMin: 3,
    ubicacion: 'Buenos Aires, Argentina',
    hashtags: ['#foodie', '#bsas', '#comida'],
    estado: 'Completada',
    fecha: '28 may. 2026',
    resultados: 47,
    descripcion: 'Búsqueda de creadores de contenido gastronómico en CABA para campaña de verano de Popeyes.',
  },
  {
    id: 'b-002',
    nombre: 'Skincare & Belleza',
    plataformas: ['Instagram'],
    nichos: ['Belleza', 'Skincare', 'Wellness'],
    seguidoresMin: 10_000,
    seguidoresMax: 100_000,
    engagementMin: 4,
    ubicacion: 'Argentina',
    hashtags: ['#skincare', '#belleza', '#beauty'],
    estado: 'En progreso',
    fecha: '1 jun. 2026',
    resultados: 23,
    descripcion: 'Identificación de micro-influencers de belleza para línea de productos premium.',
  },
  {
    id: 'b-003',
    nombre: 'Tech Reviewers Latam',
    plataformas: ['YouTube', 'TikTok'],
    nichos: ['Tecnología', 'Reviews'],
    seguidoresMin: 20_000,
    seguidoresMax: 200_000,
    engagementMin: 2,
    ubicacion: 'Latinoamérica',
    hashtags: ['#tech', '#review', '#tecnologia'],
    estado: 'Borrador',
    fecha: '2 jun. 2026',
    resultados: 0,
    descripcion: 'Exploración de reviewers de tecnología con audiencia latinoamericana.',
  },
  {
    id: 'b-004',
    nombre: 'Fitness & Wellness Q3',
    plataformas: ['Instagram', 'TikTok', 'YouTube'],
    nichos: ['Fitness', 'Wellness', 'Nutrición'],
    seguidoresMin: 8_000,
    seguidoresMax: 80_000,
    engagementMin: 5,
    ubicacion: 'Argentina',
    hashtags: ['#fitness', '#wellness', '#gym'],
    estado: 'Completada',
    fecha: '15 may. 2026',
    resultados: 62,
    descripcion: 'Búsqueda masiva para campaña Q3 de marca de suplementos y bienestar.',
  },
];

// ── Static config ───────────────────────────────────────────────────────────
type FilterOpt = EstadoBusqueda | 'Todas';

const ESTADO_CFG: Record<EstadoBusqueda, { badge: string; dot: string; icon: typeof Clock }> = {
  'En progreso': { badge: 'bg-blue-50 text-blue-700 border border-blue-100',          dot: 'bg-blue-500',    icon: Clock },
  'Completada':  { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',  dot: 'bg-emerald-500', icon: CheckCircle2 },
  'Borrador':    { badge: 'bg-slate-100 text-slate-600 border border-slate-200',        dot: 'bg-slate-400',   icon: FileText },
};

const PLATAFORMA_BADGE: Record<string, string> = {
  Instagram: 'bg-purple-50 text-purple-700 border border-purple-200',
  TikTok:    'bg-slate-100 text-slate-700 border border-slate-300',
  YouTube:   'bg-red-50 text-red-700 border border-red-200',
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ProspeccionTab() {
  const [busquedas] = useState<Busqueda[]>(BUSQUEDAS_MOCK);
  const [selected, setSelected] = useState<Busqueda | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<FilterOpt>('Todas');

  const completadas = busquedas.filter(b => b.estado === 'Completada').length;
  const enProgreso  = busquedas.filter(b => b.estado === 'En progreso').length;
  const borradores  = busquedas.filter(b => b.estado === 'Borrador').length;
  const totalResults = busquedas.reduce((s, b) => s + b.resultados, 0);

  const visible = filter === 'Todas' ? busquedas : busquedas.filter(b => b.estado === filter);

  return (
    <div className="h-full flex flex-col gap-5">

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total búsquedas', value: busquedas.length, color: 'var(--color-text-1)',  sub: 'registradas' },
          { label: 'En progreso',     value: enProgreso,        color: '#3b82f6',              sub: 'activas ahora' },
          { label: 'Completadas',     value: completadas,       color: '#10b981',              sub: 'finalizadas' },
          { label: 'Creadores hallados', value: totalResults,   color: 'var(--color-brand)',   sub: 'en total' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl px-5 py-4 border"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-card)' }}
          >
            <p className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-text-2)' }}>{stat.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {(['Todas', 'En progreso', 'Completada', 'Borrador'] as FilterOpt[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.97]"
              style={filter === f
                ? { backgroundColor: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-btn-brand)' }
                : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border-subtle)' }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97]"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
        >
          <Plus className="w-4 h-4" />
          Nueva búsqueda
        </button>
      </div>

      {/* ── Cards grid ────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--color-surface-alt)' }}
            >
              <Search className="w-8 h-8" style={{ color: 'var(--color-text-3)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-2)' }}>Sin búsquedas</p>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              Iniciá una nueva búsqueda para encontrar creadores ideales
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 pb-4">
          {visible.map(b => {
            const ecfg = ESTADO_CFG[b.estado];
            const EstadoIcon = ecfg.icon;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] group"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
              >
                {/* Card header – platforms + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {b.plataformas.map(p => (
                      <span
                        key={p}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${PLATAFORMA_BADGE[p] ?? 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-lg flex-shrink-0 ${ecfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ecfg.dot}`} />
                    {b.estado}
                  </span>
                </div>

                {/* Name */}
                <h3
                  className="text-base font-black leading-tight mb-1.5 transition-colors duration-200 group-hover:text-[var(--color-brand)]"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  {b.nombre}
                </h3>

                {/* Description */}
                {b.descripcion && (
                  <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--color-text-3)' }}>
                    {b.descripcion}
                  </p>
                )}

                {/* Nicho chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {b.nichos.map(n => (
                    <span
                      key={n}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-lg"
                      style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' }}
                    >
                      {n}
                    </span>
                  ))}
                </div>

                {/* Divider */}
                <div className="h-px mb-4" style={{ backgroundColor: 'var(--color-border-subtle)' }} />

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" style={{ color: 'var(--color-text-3)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>
                      {fmtNum(b.seguidoresMin)} – {fmtNum(b.seguidoresMax)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-text-3)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>
                      ≥ {b.engagementMin}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-2)' }}>
                      {b.ubicacion}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" style={{ color: 'var(--color-text-3)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>{b.fecha}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.resultados > 0 && (
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--color-brand)' }}>
                        {b.resultados} creadores
                      </span>
                    )}
                    <div
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                    >
                      Ver detalle
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────────── */}
      {selected && (
        <BusquedaDrawer busqueda={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <NuevaBusquedaModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
