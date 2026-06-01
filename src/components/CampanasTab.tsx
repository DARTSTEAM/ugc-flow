import { Plus, Pause, Play, Eye, Rocket } from 'lucide-react';
import type { Campana, UGC } from '../data';
import { ESTADO_CAMPANA_CONFIG } from '../utils';

interface Props {
  campanas: Campana[];
  ugcs: UGC[];
  onSelectCampana: (c: Campana) => void;
  onTogglePause: (c: Campana) => void;
  onLanzar: (c: Campana) => void;
  onAddCampana: () => void;
}

function CampanaCard({ campana, ugcs, onSelect, onTogglePause, onLanzar }: {
  campana: Campana;
  ugcs: UGC[];
  onSelect: () => void;
  onTogglePause: () => void;
  onLanzar: () => void;
}) {
  const estadoCfg = ESTADO_CAMPANA_CONFIG[campana.estado];
  const enviados = campana.ugcs.filter(u => u.estado !== 'No aplica').length;
  const respondidos = campana.ugcs.filter(u => ['Respondió', 'Calificado'].includes(u.estado)).length;
  const calificados = campana.ugcs.filter(u => u.estado === 'Calificado').length;
  const progreso = Math.min(Math.round((enviados / campana.objetivo) * 100), 100);

  const progressColor = campana.estado === 'Cerrada'
    ? '#CBD5E1'
    : campana.estado === 'Pausada'
    ? '#FBBF24'
    : 'var(--color-brand)';

  return (
    <div
      className="border rounded-2xl p-5 flex flex-col gap-4 group cursor-pointer transition-all duration-200"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand-border)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3
            onClick={onSelect}
            className="font-bold text-sm cursor-pointer transition-colors duration-200"
            style={{ color: 'var(--color-text-1)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
          >
            {campana.nombre}
          </h3>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-3)' }}>{campana.descripcion}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${estadoCfg.className}`}>
          {estadoCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>{enviados}/{campana.objetivo} UGCs</span>
          <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--color-text-2)' }}>{progreso}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progreso}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        {[
          { label: 'Enviados', value: enviados },
          { label: 'Respondidos', value: respondidos },
          { label: 'Calificados', value: calificados },
        ].map(s => (
          <div key={s.label} className="flex-1 p-2 rounded-xl text-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <p className="text-base font-black font-mono" style={{ color: 'var(--color-text-1)' }}>{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Date range */}
      <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>{campana.fechaInicio} → {campana.fechaFin}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <button
          onClick={onSelect}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border rounded-xl transition-all duration-200"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-2)'; }}
        >
          <Eye className="w-3.5 h-3.5" />Ver detalle
        </button>
        {campana.estado !== 'Cerrada' && campana.estado !== 'Borrador' && (
          <button
            onClick={onTogglePause}
            className="flex items-center justify-center gap-1 p-2 border rounded-xl transition-all duration-200"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
            title={campana.estado === 'Pausada' ? 'Reanudar campaña' : 'Pausar campaña'}
          >
            {campana.estado === 'Pausada' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}
        {campana.estado !== 'Cerrada' && (
          <button
            onClick={onLanzar}
            className="flex items-center justify-center gap-1 p-2 text-white rounded-xl transition-all duration-200 active:scale-[0.95]"
            style={{ backgroundColor: 'var(--color-brand)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
            title="Lanzar envío"
          >
            <Rocket className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CampanasTab({ campanas, ugcs, onSelectCampana, onTogglePause, onLanzar, onAddCampana }: Props) {
  const activas = campanas.filter(c => c.estado === 'Activa');
  const borradores = campanas.filter(c => c.estado === 'Borrador');
  const cerradas = campanas.filter(c => c.estado === 'Cerrada' || c.estado === 'Pausada');

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

  function Section({ title, items }: { title: string; items: Campana[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-3)' }}>{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(c => (
            <CampanaCard
              key={c.id}
              campana={c}
              ugcs={ugcs}
              onSelect={() => onSelectCampana(c)}
              onTogglePause={() => onTogglePause(c)}
              onLanzar={() => onLanzar(c)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          {campanas.length} campañas en total · {activas.length} activas
        </p>
        <button
          onClick={onAddCampana}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
        >
          <Plus className="w-4 h-4" />
          Nueva campaña
        </button>
      </div>

      <Section title="Activas" items={activas} />
      <Section title="Borradores" items={borradores} />
      <Section title="Pausadas / Cerradas" items={cerradas} />
    </div>
  );
}
