import { useState } from 'react';
import {
  ArrowLeft, Rocket, Pause, Play, TrendingUp, TrendingDown,
  BarChart3, Users, Mail, CheckCircle, ChevronDown, ChevronUp, ChevronsUpDown, Award
} from 'lucide-react';
import type { Campana, UGC, EstadoEnCampana } from '../data';
import {
  scoreColor, ESTADO_EN_CAMPANA_CONFIG, ESTADO_CAMPANA_CONFIG,
  getInitials, avatarColor
} from '../utils';

interface Props {
  campana: Campana;
  ugcs: UGC[];
  onBack: () => void;
  onTogglePause: (campana: Campana) => void;
  onLanzar: (campana: Campana) => void;
}

type SortKey2 = 'nombre' | 'estado' | 'score' | 'fechaEnvio';
type SortDir = 'asc' | 'desc';

const ESTADOS_EN: EstadoEnCampana[] = ['Enviado', 'Respondió', 'Pendiente', 'Calificado', 'No aplica'];

function KPICard({
  icon, label, value, note, trend
}: { icon: React.ReactNode; label: string; value: number | string; note?: string; trend?: 'up' | 'down' }) {
  return (
    <div className="flex-1 min-w-[130px] p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-300">{icon}</span>
        {trend && (
          <span className={trend === 'up' ? 'text-emerald-500' : 'text-rose-400'}>
            {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900 font-mono">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
      {note && <p className="text-[10px] text-slate-300 mt-0.5 font-mono">{note}</p>}
    </div>
  );
}

export default function CampanaDetail({ campana, ugcs, onBack, onTogglePause, onLanzar }: Props) {
  const [filterEstado, setFilterEstado] = useState<EstadoEnCampana | ''>('');
  const [sortKey, setSortKey] = useState<SortKey2>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showLanzarModal, setShowLanzarModal] = useState(false);

  const estadoCfg = ESTADO_CAMPANA_CONFIG[campana.estado];

  // Compute stats
  const enviados = campana.ugcs.filter(u => u.estado !== 'No aplica').length;
  const respondidos = campana.ugcs.filter(u => ['Respondió', 'Calificado'].includes(u.estado)).length;
  const pendientes = campana.ugcs.filter(u => u.estado === 'Pendiente' || u.estado === 'Enviado').length;
  const calificados = campana.ugcs.filter(u => u.estado === 'Calificado').length;
  const progreso = Math.round((enviados / campana.objetivo) * 100);

  function handleSort(k: SortKey2) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }
  function SortIcon({ col }: { col: SortKey2 }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  // Build UGC rows
  const rows = campana.ugcs
    .filter(uc => !filterEstado || uc.estado === filterEstado)
    .map(uc => {
      const ugc = ugcs.find(u => u.id === uc.ugcId);
      return { uc, ugc };
    })
    .filter(x => x.ugc)
    .sort((a, b) => {
      const ua = a.ugc!;
      const ub = b.ugc!;
      let cmp = 0;
      if (sortKey === 'nombre') cmp = ua.nombre.localeCompare(ub.nombre);
      else if (sortKey === 'score') cmp = ua.score - ub.score;
      else if (sortKey === 'estado') cmp = a.uc.estado.localeCompare(b.uc.estado);
      else cmp = a.uc.fechaEnvio.localeCompare(b.uc.fechaEnvio);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // Ranking: top calificados by score
  const ranking = campana.ugcs
    .filter(uc => uc.estado === 'Calificado')
    .map(uc => ugcs.find(u => u.id === uc.ugcId))
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as UGC[];

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black text-slate-900">{campana.nombre}</h2>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>{estadoCfg.label}</span>
            </div>
            <p className="text-sm text-slate-400">{campana.descripcion}</p>
            <p className="text-xs text-slate-300 font-mono mt-1">{campana.fechaInicio} → {campana.fechaFin}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {campana.estado !== 'Cerrada' && campana.estado !== 'Borrador' && (
            <button
              onClick={() => onTogglePause(campana)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {campana.estado === 'Pausada' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {campana.estado === 'Pausada' ? 'Reanudar' : 'Pausar'}
            </button>
          )}
          {campana.estado !== 'Cerrada' && (
            <button
              onClick={() => setShowLanzarModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              <Rocket className="w-3.5 h-3.5" />
              Lanzar envío
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">Progreso de campaña</span>
          <span className="text-xs font-mono font-bold text-slate-700">{enviados}/{campana.objetivo} UGCs</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(progreso, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 font-mono mt-1">{progreso}% completado</p>
      </div>

      {/* KPI Strip */}
      <div className="flex gap-3 flex-wrap">
        <KPICard icon={<Mail className="w-5 h-5" />} label="Enviados" value={enviados}
          note={`de ${campana.objetivo} objetivo`} trend="up" />
        <KPICard icon={<BarChart3 className="w-5 h-5" />} label="Respondidos" value={respondidos}
          note={enviados > 0 ? `${Math.round((respondidos / enviados) * 100)}% del total` : '—'} trend="up" />
        <KPICard icon={<Users className="w-5 h-5" />} label="Pendientes" value={pendientes}
          note="sin respuesta" />
        <KPICard icon={<CheckCircle className="w-5 h-5" />} label="Calificados" value={calificados}
          note={respondidos > 0 ? `${Math.round((calificados / respondidos) * 100)}% de respondidos` : '—'} trend="up" />
      </div>

      {/* UGC Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="px-4 pt-3 pb-2 border-b border-slate-50 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Creadores en esta campaña</h3>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value as EstadoEnCampana | '')}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-200"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_EN.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[600px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                {[
                  { key: 'nombre', label: 'Creador' },
                  { key: 'estado', label: 'Estado' },
                  { key: 'score', label: 'Score' },
                  { key: 'fechaEnvio', label: 'Fecha envío' },
                ].map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key as SortKey2)}
                    className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 cursor-pointer hover:text-slate-700 transition-colors select-none whitespace-nowrap">
                    <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key as SortKey2} /></div>
                  </th>
                ))}
                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Fecha respuesta</th>
                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-300 text-sm italic">No hay creadores con este filtro</td></tr>
              ) : rows.map(({ uc, ugc }) => {
                const sc = scoreColor(ugc!.score);
                const estadoCfg = ESTADO_EN_CAMPANA_CONFIG[uc.estado];
                const av = avatarColor(ugc!.id);
                return (
                  <tr key={uc.ugcId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${av}`}>
                          {getInitials(ugc!.nombre)}
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{ugc!.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-b border-slate-50">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>{estadoCfg.label}</span>
                    </td>
                    <td className="py-3 px-4 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${ugc!.score}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-bold ${sc.text}`}>{ugc!.score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-b border-slate-50 text-xs font-mono text-slate-400">{uc.fechaEnvio}</td>
                    <td className="py-3 px-4 border-b border-slate-50 text-xs font-mono text-slate-400">
                      {uc.fechaRespuesta ?? <span className="text-slate-200">—</span>}
                    </td>
                    <td className="py-3 px-4 border-b border-slate-50">
                      <div className="flex items-center gap-1">
                        <button className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-500 transition-colors">Ver conv.</button>
                        <button className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-500 transition-colors">Score</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking panel */}
      {ranking.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            Ranking de candidatos
          </h3>
          <div className="space-y-2">
            {ranking.map((ugc, i) => {
              const sc = scoreColor(ugc.score);
              const av = avatarColor(ugc.id);
              return (
                <div key={ugc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-black text-slate-300 font-mono w-4 text-center">#{i + 1}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${av}`}>
                    {getInitials(ugc.nombre)}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{ugc.nombre}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${ugc.score}%` }} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${sc.text} w-6`}>{ugc.score}</span>
                  </div>
                  <button className="px-3 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                    Seleccionar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lanzar Modal */}
      {showLanzarModal && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 overlay-enter" onClick={() => setShowLanzarModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 pointer-events-auto modal-enter">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Confirmar lanzamiento</h3>
              <p className="text-sm text-slate-500 mb-5">
                Estás por lanzar el envío de <span className="font-semibold text-slate-700">"{campana.nombre}"</span>. 
                Se contactarán automáticamente todos los UGCs asignados.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onLanzar(campana); setShowLanzarModal(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm"
                >
                  <Rocket className="w-4 h-4" />
                  Lanzar ahora
                </button>
                <button
                  onClick={() => setShowLanzarModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
