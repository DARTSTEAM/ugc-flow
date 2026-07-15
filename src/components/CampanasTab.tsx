import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Rocket, ChevronDown, ArrowUpRight } from 'lucide-react';
import type { Campana, EstadoCampana, UGC } from '../data';
import { ESTADO_CAMPANA_CONFIG } from '../utils';

interface Props {
  campanas: Campana[];
  ugcs: UGC[];           // kept for API compatibility; not used internally
  onSelectCampana: (c: Campana) => void;
  onTogglePause: (c: Campana) => void;
  onLanzar: (c: Campana) => void;
  onAddCampana: () => void;
}

const PAGE_SIZE = 20;

const CAMPANA_CARD_COLORS: Record<EstadoCampana, { cardBg: string; cardBorder: string }> = {
  'Activa':   { cardBg: '#dcfce7', cardBorder: '#86efac' },
  'Pausada':  { cardBg: '#fef9c3', cardBorder: '#fde047' },
  'Borrador': { cardBg: '#ffedd5', cardBorder: '#fdba74' },
  'Cerrada':  { cardBg: '#f1f5f9', cardBorder: '#cbd5e1' },
};

type FilterCampana = 'Todas' | 'Activas' | 'Borradores' | 'Cerradas';

const FILTER_PILL_COLORS: Record<Exclude<FilterCampana, 'Todas'>, {
  pillBg: string; pillText: string; pillBorder: string;
  pillActiveBg: string; pillActiveText: string; pillActiveBorder: string;
}> = {
  'Activas':    { pillBg: '#dcfce7', pillText: '#166534', pillBorder: '#86efac', pillActiveBg: '#bbf7d0', pillActiveText: '#14532d', pillActiveBorder: '#4ade80' },
  'Borradores': { pillBg: '#ffedd5', pillText: '#9a3412', pillBorder: '#fdba74', pillActiveBg: '#fed7aa', pillActiveText: '#7c2d12', pillActiveBorder: '#fb923c' },
  'Cerradas':   { pillBg: '#f1f5f9', pillText: '#475569', pillBorder: '#cbd5e1', pillActiveBg: '#e2e8f0', pillActiveText: '#334155', pillActiveBorder: '#94a3b8' },
};

function CampanaCard({ campana, cardBg, cardBorder, onSelect }: {
  campana: Campana;
  cardBg: string;
  cardBorder: string;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const estadoCfg = ESTADO_CAMPANA_CONFIG[campana.estado];
  const pendientes    = campana.ugcs.filter(u => u.estado === 'Pendiente').length;
  const activos        = campana.ugcs.filter(u => u.estado === 'Activo').length;
  const enNegociacion  = campana.ugcs.filter(u => u.estado === 'En Negociación').length;
  const disponibles    = campana.ugcs.filter(u => u.estado === 'Disponible').length;
  const descartados    = campana.ugcs.filter(u => u.estado === 'Descartado').length;

  return (
    <div
      onClick={onSelect}
      className="@container border rounded-2xl p-5 flex flex-col gap-4 cursor-pointer select-none"
      style={{
        backgroundColor: cardBg,
        borderColor: hovered ? 'var(--color-brand)' : cardBorder,
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-snug" style={{ color: '#111827' }}>
            {campana.nombre}
          </h3>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6b7280' }}>{campana.descripcion}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Arrow indicator — visible on hover */}
          <div style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0) scale(1)' : 'translateX(4px) scale(0.8)',
            transition: 'opacity 150ms, transform 150ms',
          }}>
            <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${estadoCfg.className}`}>
            {estadoCfg.label}
          </span>
        </div>
      </div>

      {/* Stats — 5 en una fila si el ancho real de la card lo permite (container query),
          si no, 2-3 por fila para que nunca se corten ni se salgan del borde. */}
      <div className="grid grid-cols-2 @md:grid-cols-5 gap-2">
        {[
          { label: 'Pendientes',       value: pendientes },
          { label: 'En Negociación',   value: enNegociacion },
          { label: 'Disponibles',      value: disponibles },
          { label: 'Activos',          value: activos },
          { label: 'Descartados',      value: descartados },
        ].map(s => (
          <div key={s.label} className="min-w-0 p-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
            <p className="text-base font-black font-mono truncate" style={{ color: '#111827' }}>{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: '#6b7280' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Date range */}
      <p className="text-[10px] font-mono" style={{ color: '#6b7280' }}>{campana.fechaInicio} → {campana.fechaFin}</p>

    </div>
  );
}

export default function CampanasTab({ campanas, onSelectCampana, onAddCampana }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('estado') as FilterCampana | null) ?? 'Todas';
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered =
    filter === 'Todas'      ? campanas :
    filter === 'Activas'    ? campanas.filter(c => c.estado === 'Activa' || c.estado === 'Pausada') :
    filter === 'Borradores' ? campanas.filter(c => c.estado === 'Borrador') :
                              campanas.filter(c => c.estado === 'Cerrada');

  const paged   = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const totalActivas    = campanas.filter(c => c.estado === 'Activa' || c.estado === 'Pausada').length;
  const totalCreadores  = campanas.flatMap(c => c.ugcs).length;
  const totalActivosCreadores = campanas.flatMap(c => c.ugcs).filter(u => u.estado === 'Activo').length;

  function handleFilterChange(f: FilterCampana) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (f === 'Todas') next.delete('estado');
      else next.set('estado', f);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }

  if (campanas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
          <Rocket className="w-8 h-8" style={{ color: 'var(--color-brand)' }} />
        </div>
        <div className="text-center">
          <h3 className="font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>No hay campañas aún</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Creá tu primera campaña para empezar a gestionar tus UGCs</p>
        </div>
        <button
          onClick={onAddCampana}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
        >
          <Plus className="w-4 h-4" />
          Nueva campaña
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total campañas',        value: campanas.length,          color: 'var(--color-text-1)', sub: 'registradas' },
          { label: 'Activas',               value: totalActivas,             color: '#10b981',             sub: 'en curso ahora' },
          { label: 'Creadores en campaña',  value: totalCreadores,           color: 'var(--color-brand)',  sub: 'en total' },
          { label: 'Activos',               value: totalActivosCreadores,    color: '#3b82f6',             sub: 'trabajando ahora' },
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

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['Todas', 'Activas', 'Borradores', 'Cerradas'] as FilterCampana[]).map(f => {
            const isActive = filter === f;
            const cfg = f !== 'Todas' ? FILTER_PILL_COLORS[f] : null;
            const pillStyle: React.CSSProperties = cfg
              ? isActive
                ? { backgroundColor: cfg.pillActiveBg, color: cfg.pillActiveText, border: `1.5px solid ${cfg.pillActiveBorder}`, boxShadow: `0 0 0 1px ${cfg.pillActiveBorder}` }
                : { backgroundColor: cfg.pillBg, color: cfg.pillText, border: `1px solid ${cfg.pillBorder}` }
              : isActive
                ? { backgroundColor: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-btn-brand)' }
                : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border-subtle)' };
            return (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.97]"
                style={pillStyle}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Count + CTA */}
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {filtered.length} campaña{filtered.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onAddCampana}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
          >
            <Plus className="w-4 h-4" />
            Nueva campaña
          </button>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────── */}
      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <Rocket className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>Sin campañas en esta categoría</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paged.map(c => {
              const colors = CAMPANA_CARD_COLORS[c.estado];
              return (
                <CampanaCard
                  key={c.id}
                  campana={c}
                  cardBg={colors.cardBg}
                  cardBorder={colors.cardBorder}
                  onSelect={() => onSelectCampana(c)}
                />
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="flex items-center gap-2 px-5 py-2.5 border rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
              >
                <ChevronDown className="w-4 h-4" />
                Ver más ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
