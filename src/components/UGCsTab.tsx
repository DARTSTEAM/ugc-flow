import { useState, useMemo } from 'react';
import {
  Search, Plus, ChevronDown, ChevronUp, ChevronsUpDown,
  Eye, MessageCircle, Trash2, SlidersHorizontal
} from 'lucide-react';
import type { UGC, EstadoUGC, Campana } from '../data';
import {
  scoreColor, ESTADO_UGC_CONFIG,
  getInitials, avatarColor
} from '../utils';
import UGCDrawer from './UGCDrawer';

interface Props {
  ugcs: UGC[];
  campanas: Campana[];
  onAddUGC: () => void;
  onUpdateUGC: (ugc: UGC) => void;
  onDeleteUGC: (id: string) => void;
}

type SortKey = 'nombre' | 'estado' | 'score' | 'ultimaActividad';
type SortDir = 'asc' | 'desc';

const ESTADOS: EstadoUGC[] = ['Nuevo', 'Contactado', 'Respondió', 'Calificado', 'Descartado'];

function ScoreBar({ score }: { score: number }) {
  const sc = scoreColor(score);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${sc.text}`}>{score}</span>
    </div>
  );
}

export default function UGCsTab({ ugcs, campanas, onAddUGC, onUpdateUGC, onDeleteUGC }: Props) {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoUGC | ''>('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedUGC, setSelectedUGC] = useState<UGC | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [newNombre, setNewNombre] = useState('');

  const filtered = useMemo(() => {
    let list = ugcs
      .filter(u => {
        const matchSearch = u.nombre.toLowerCase().includes(search.toLowerCase());
        const matchEstado = !filterEstado || u.estado === filterEstado;
        const matchScore = u.score >= scoreMin && u.score <= scoreMax;
        return matchSearch && matchEstado && matchScore;
      });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
      else if (sortKey === 'score') cmp = a.score - b.score;
      else if (sortKey === 'estado') cmp = a.estado.localeCompare(b.estado);
      else cmp = a.ultimaActividad.localeCompare(b.ultimaActividad);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [ugcs, search, filterEstado, scoreMin, scoreMax, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newNombre.trim()) return;
    const newUGC: UGC = {
      id: `ugc-${Date.now()}`,
      nombre: newNombre.trim(),
      canal: 'WhatsApp',
      estado: 'Nuevo',
      score: 0,
      ultimaActividad: 'ahora mismo',
      campanasignada: null,
      conversacion: [],
      calificacion: [],
      scoreBreakdown: [
        { criterio: 'Velocidad de respuesta', puntos: 0, maximo: 25 },
        { criterio: 'Interés declarado', puntos: 0, maximo: 25 },
        { criterio: 'Calidad de respuesta', puntos: 0, maximo: 25 },
        { criterio: 'Perfil del canal', puntos: 0, maximo: 25 },
      ],
    };
    onUpdateUGC(newUGC);
    setNewNombre('');
    setShowAddForm(false);
  }

  const ESTADO_ORDER: EstadoUGC[] = ['Nuevo', 'Contactado', 'Respondió', 'Calificado', 'Descartado'];

  function handleAvanzar(ugc: UGC) {
    const idx = ESTADO_ORDER.indexOf(ugc.estado);
    if (idx < ESTADO_ORDER.length - 2) {
      onUpdateUGC({ ...ugc, estado: ESTADO_ORDER[idx + 1] });
      setSelectedUGC({ ...ugc, estado: ESTADO_ORDER[idx + 1] });
    }
  }

  function handleDescartar(ugc: UGC) {
    onUpdateUGC({ ...ugc, estado: 'Descartado' });
    setSelectedUGC({ ...ugc, estado: 'Descartado' });
  }

  function handleAsignar(ugc: UGC, campanaId: string) {
    const campana = campanas.find(c => c.id === campanaId);
    const updated = { ...ugc, campanasignada: campana?.nombre || null };
    onUpdateUGC(updated);
    setSelectedUGC(updated);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar creador..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all ${showFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {(filterEstado || scoreMin > 0 || scoreMax < 100) && (
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </button>

          <button
            onClick={() => setShowAddForm(f => !f)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Agregar UGC
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-white border border-slate-100 rounded-xl">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</label>
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value as EstadoUGC | '')}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score mín: <span className="text-slate-600 font-mono">{scoreMin}</span></label>
            <input type="range" min={0} max={100} value={scoreMin} onChange={e => setScoreMin(+e.target.value)}
              className="w-32 accent-indigo-600" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score máx: <span className="text-slate-600 font-mono">{scoreMax}</span></label>
            <input type="range" min={0} max={100} value={scoreMax} onChange={e => setScoreMax(+e.target.value)}
              className="w-32 accent-indigo-600" />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilterEstado(''); setScoreMin(0); setScoreMax(100); }}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors underline"
            >Limpiar filtros</button>
          </div>
        </div>
      )}

      {/* Add form panel */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-4 bg-white border border-indigo-100 rounded-xl flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre</label>
            <input
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              placeholder="Nombre del creador"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-200"
              autoFocus
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Crear
          </button>
          <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        </form>
      )}

      {/* Table */}
      <div className="flex-1 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[720px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                {[
                  { key: 'nombre', label: 'Nombre' },
                  { key: 'estado', label: 'Estado' },
                  { key: 'score', label: 'Score' },
                  { key: 'ultimaActividad', label: 'Última actividad' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as SortKey)}
                    className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100 cursor-pointer hover:text-slate-700 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key as SortKey} />
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Campaña</th>
                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <Search className="w-8 h-8 text-slate-200" />
                      <p className="text-slate-400 text-sm">No se encontraron creadores con estos filtros</p>
                      <button onClick={() => { setSearch(''); setFilterEstado(''); setScoreMin(0); setScoreMax(100); }}
                        className="text-indigo-500 text-xs underline hover:text-indigo-700">Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const estadoCfg = ESTADO_UGC_CONFIG[u.estado];
                const av = avatarColor(u.id);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUGC(u)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 border-b border-slate-50">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                          {getInitials(u.nombre)}
                        </div>
                        <span className="font-semibold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">{u.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 border-b border-slate-50">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 border-b border-slate-50">
                      <ScoreBar score={u.score} />
                    </td>
                    <td className="py-3.5 px-4 border-b border-slate-50 text-sm text-slate-400 font-mono">{u.ultimaActividad}</td>
                    <td className="py-3.5 px-4 border-b border-slate-50">
                      {u.campanasignada ? (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium truncate max-w-[130px] block">
                          {u.campanasignada}
                        </span>
                      ) : (
                        <span className="text-slate-200 text-lg">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 border-b border-slate-50" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedUGC(u)}
                          title="Ver perfil"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedUGC(u)}
                          title="Enviar mensaje"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteUGC(u.id)}
                          title="Eliminar"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-4 py-2.5 border-t border-slate-50 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-400 font-mono">{filtered.length} de {ugcs.length} creadores</span>
          <div className="flex gap-3">
            {['Calificado', 'Respondió', 'Contactado'].map(e => {
              const count = ugcs.filter(u => u.estado === e).length;
              return (
                <span key={e} className="text-[10px] text-slate-400">
                  <span className="font-mono font-bold text-slate-600">{count}</span> {e.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedUGC && (
        <UGCDrawer
          ugc={selectedUGC}
          campanas={campanas}
          onClose={() => setSelectedUGC(null)}
          onAvanzar={handleAvanzar}
          onDescartar={handleDescartar}
          onAsignar={handleAsignar}
        />
      )}
    </div>
  );
}
