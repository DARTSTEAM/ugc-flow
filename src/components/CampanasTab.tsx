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
    ? 'bg-slate-300'
    : campana.estado === 'Pausada'
    ? 'bg-amber-400'
    : 'bg-indigo-500';

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col gap-4 group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3
            onClick={onSelect}
            className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors cursor-pointer truncate"
          >
            {campana.nombre}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{campana.descripcion}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${estadoCfg.className}`}>
          {estadoCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-400 font-mono">{enviados}/{campana.objetivo} UGCs</span>
          <span className="text-[10px] font-bold font-mono text-slate-500">{progreso}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${progressColor} rounded-full transition-all duration-700`} style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        {[
          { label: 'Enviados', value: enviados },
          { label: 'Respondidos', value: respondidos },
          { label: 'Calificados', value: calificados },
        ].map(s => (
          <div key={s.label} className="flex-1 p-2 bg-slate-50 rounded-lg text-center">
            <p className="text-base font-black text-slate-900 font-mono">{s.value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Date range */}
      <p className="text-[10px] font-mono text-slate-300">{campana.fechaInicio} → {campana.fechaFin}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
        <button
          onClick={onSelect}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />Ver detalle
        </button>
        {campana.estado !== 'Cerrada' && campana.estado !== 'Borrador' && (
          <button
            onClick={onTogglePause}
            className="flex items-center justify-center gap-1 p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors"
            title={campana.estado === 'Pausada' ? 'Reanudar' : 'Pausar'}
          >
            {campana.estado === 'Pausada' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}
        {campana.estado !== 'Cerrada' && (
          <button
            onClick={onLanzar}
            className="flex items-center justify-center gap-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <Rocket className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-slate-700 mb-1">No hay campañas aún</h3>
          <p className="text-sm text-slate-400">Creá tu primera campaña para empezar a gestionar tus UGCs</p>
        </div>
        <button onClick={onAddCampana} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
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
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{title}</h3>
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
        <div>
          <p className="text-xs text-slate-400">{campanas.length} campañas en total · {activas.length} activas</p>
        </div>
        <button
          onClick={onAddCampana}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
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
