import { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, ChevronDown, ChevronUp, ChevronsUpDown,
  Eye, MessageCircle, Trash2, SlidersHorizontal, X,
  Filter, UserPlus, Instagram, Mail, MessageSquare, AlertTriangle
} from 'lucide-react';
import type { UGC, EstadoUGC, Canal, Campana } from '../data';
import {
  scoreColor, ESTADO_UGC_CONFIG,
  getInitials, avatarColor, needsInfoUpdate
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
const CANALES: Canal[] = ['WhatsApp', 'Instagram', 'Email'];

// ─── Overlay helper ──────────────────────────────────────────────────────────
function Overlay({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 overlay-enter"
      style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClick}
    />
  );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────
function ModalShell({ children, onClose, title, subtitle, icon }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <>
      <Overlay onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="w-full max-w-md pointer-events-auto modal-enter rounded-2xl border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                {icon}
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>{title}</h3>
                {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-1)',
};

function useInputFocus() {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-brand)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-border)';
      e.currentTarget.style.boxShadow = '';
    },
  };
}

// ─── Dual Range Slider ────────────────────────────────────────────────────────
function DualRangeSlider({
  min = 0, max = 100, valueMin, valueMax, onChangeMin, onChangeMax,
}: {
  min?: number; max?: number;
  valueMin: number; valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  // Draft states allow the user to clear the field and type freely.
  // On blur, if the draft is empty/invalid, it snaps back to the committed value.
  const [draftMin, setDraftMin] = useState(String(valueMin));
  const [draftMax, setDraftMax] = useState(String(valueMax));

  // Keep drafts in sync when external values change (e.g., slider drag)
  useEffect(() => setDraftMin(String(valueMin)), [valueMin]);
  useEffect(() => setDraftMax(String(valueMax)), [valueMax]);

  const clampMin = (v: number) => Math.max(min, Math.min(v, valueMax));
  const clampMax = (v: number) => Math.min(max, Math.max(v, valueMin));

  const pctMin = ((valueMin - min) / (max - min)) * 100;
  const pctMax = ((valueMax - min) / (max - min)) * 100;

  const handleInputChangeMin = (val: string) => {
    if (/^\d*$/.test(val)) {
      setDraftMin(val);
    }
  };

  const handleInputChangeMax = (val: string) => {
    if (/^\d*$/.test(val)) {
      setDraftMax(val);
    }
  };

  function handleBlurMin() {
    const v = parseInt(draftMin, 10);
    if (isNaN(v) || draftMin.trim() === '') {
      setDraftMin(String(valueMin)); // restore previous
    } else {
      const valBetween0And100 = Math.max(0, Math.min(v, 100));
      const finalVal = Math.min(valBetween0And100, valueMax);
      onChangeMin(finalVal);
      setDraftMin(String(finalVal));
    }
  }

  function handleBlurMax() {
    const v = parseInt(draftMax, 10);
    if (isNaN(v) || draftMax.trim() === '') {
      setDraftMax(String(valueMax)); // restore previous
    } else {
      const valBetween0And100 = Math.max(0, Math.min(v, 100));
      const finalVal = Math.max(valBetween0And100, valueMin);
      onChangeMax(finalVal);
      setDraftMax(String(finalVal));
    }
  }

  const numStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-1)',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Number inputs */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Mínimo</label>
          <input
            type="text"
            inputMode="numeric"
            value={draftMin}
            onChange={e => handleInputChangeMin(e.target.value)}
            onBlur={handleBlurMin}
            onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="w-full text-center px-2 py-1.5 border rounded-xl text-sm font-medium focus:outline-none transition-all duration-200"
            style={numStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; e.currentTarget.select(); }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
          />
        </div>
        <div className="w-6 h-px mt-4 flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
        <div className="flex flex-col items-center gap-1 flex-1">
          <label className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Máximo</label>
          <input
            type="text"
            inputMode="numeric"
            value={draftMax}
            onChange={e => handleInputChangeMax(e.target.value)}
            onBlur={handleBlurMax}
            onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="w-full text-center px-2 py-1.5 border rounded-xl text-sm font-medium focus:outline-none transition-all duration-200"
            style={numStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; e.currentTarget.select(); }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
          />
        </div>
      </div>

      {/* Single-track dual slider */}
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
        {/* Active fill */}
        <div
          className="absolute h-1 rounded-full pointer-events-none"
          style={{
            left: `${pctMin}%`,
            right: `${100 - pctMax}%`,
            backgroundColor: 'var(--color-brand)',
          }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={min} max={max}
          value={valueMin}
          onChange={e => onChangeMin(clampMin(+e.target.value))}
          className="dual-range-thumb"
          style={{ zIndex: valueMin >= valueMax - 10 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={min} max={max}
          value={valueMax}
          onChange={e => onChangeMax(clampMax(+e.target.value))}
          className="dual-range-thumb"
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}

// ─── Filtros Modal ────────────────────────────────────────────────────────────
interface FiltrosModalProps {
  filterEstado: EstadoUGC | '';
  scoreMin: number;
  scoreMax: number;
  onApply: (estado: EstadoUGC | '', min: number, max: number) => void;
  onClose: () => void;
}

function FiltrosModal({ filterEstado, scoreMin, scoreMax, onApply, onClose }: FiltrosModalProps) {
  const [localEstado, setLocalEstado] = useState<EstadoUGC | ''>(filterEstado);
  const [localMin, setLocalMin] = useState(scoreMin);
  const [localMax, setLocalMax] = useState(scoreMax);
  const focusHandlers = useInputFocus();

  const hasChanges = localEstado !== '' || localMin > 0 || localMax < 100;

  function handleApply() {
    onApply(localEstado, localMin, localMax);
    onClose();
  }

  function handleReset() {
    setLocalEstado('');
    setLocalMin(0);
    setLocalMax(100);
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Filtrar creadores"
      subtitle="Aplicá uno o más filtros para refinar la tabla"
      icon={<Filter className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />}
    >
      <div className="px-6 py-5 flex flex-col gap-5">

        {/* Estado */}
        <Field label="Estado">
          <div className="grid grid-cols-3 gap-2">
            {ESTADOS.map(e => {
              const cfg = ESTADO_UGC_CONFIG[e];
              const isSelected = localEstado === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setLocalEstado(isSelected ? '' : e)}
                  className="px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150"
                  style={isSelected ? {
                    borderColor: 'var(--color-brand)',
                    backgroundColor: 'var(--color-brand-light)',
                    color: 'var(--color-brand-hover)',
                    boxShadow: '0 0 0 1px var(--color-brand)',
                  } : {
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface-alt)',
                    color: 'var(--color-text-2)',
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Score range */}
        <Field label="Rango de Score">
          <DualRangeSlider
            valueMin={localMin}
            valueMax={localMax}
            onChangeMin={v => setLocalMin(v)}
            onChangeMax={v => setLocalMax(v)}
          />
        </Field>

      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs underline transition-colors duration-200"
          style={{ color: 'var(--color-text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
        >
          Limpiar filtros
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
          >
            Aplicar{hasChanges ? ` filtros` : ''}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Nuevo Creador Modal ──────────────────────────────────────────────────────
interface NuevoCreadorModalProps {
  onCrear: (ugc: UGC) => void;
  onClose: () => void;
}

const CANAL_ICONS: Record<Canal, React.ReactNode> = {
  WhatsApp: <MessageSquare className="w-4 h-4" />,
  Instagram: <Instagram className="w-4 h-4" />,
  Email: <Mail className="w-4 h-4" />,
};

const CANAL_COLORS: Record<Canal, { active: string; bg: string; border: string }> = {
  WhatsApp:  { active: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Instagram: { active: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  Email:     { active: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
};

function NuevoCreadorModal({ onCrear, onClose }: NuevoCreadorModalProps) {
  const [nombre, setNombre] = useState('');
  const [canal, setCanal] = useState<Canal>('Instagram');
  const [seguidores, setSeguidores] = useState('');
  const [bio, setBio] = useState('');
  const focusHandlers = useInputFocus();

  const canSubmit = nombre.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const newUGC: UGC = {
      id: `ugc-${Date.now()}`,
      nombre: nombre.trim(),
      canal,
      estado: 'Nuevo',
      score: 0,
      ultimaActividad: 'ahora mismo',
      campanasignada: null,
      conversacion: [],
      calificacion: [],
      seguidores: seguidores.trim() || undefined,
      bio: bio.trim() || undefined,
      scoreBreakdown: [
        { criterio: 'Velocidad de respuesta', puntos: 0, maximo: 25 },
        { criterio: 'Interés declarado',      puntos: 0, maximo: 25 },
        { criterio: 'Calidad de respuesta',   puntos: 0, maximo: 25 },
        { criterio: 'Perfil del canal',        puntos: 0, maximo: 25 },
      ],
    };
    onCrear(newUGC);
    onClose();
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Nuevo creador"
      subtitle="Completá los datos del creador UGC"
      icon={<UserPlus className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />}
    >
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Nombre */}
          <Field label="Nombre completo *">
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Valentina Torres"
              autoFocus
              required
              className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
              style={inputStyle}
              {...focusHandlers}
            />
          </Field>

          {/* Canal */}
          <Field label="Canal de contacto">
            <div className="grid grid-cols-3 gap-2">
              {CANALES.map(c => {
                const isSelected = canal === c;
                const colors = CANAL_COLORS[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150"
                    style={isSelected ? {
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                      color: colors.active,
                      boxShadow: `0 0 0 1px ${colors.border}`,
                    } : {
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface-alt)',
                      color: 'var(--color-text-2)',
                    }}
                  >
                    {CANAL_ICONS[c]}
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Seguidores */}
          <Field label="Seguidores (opcional)">
            <input
              value={seguidores}
              onChange={e => setSeguidores(e.target.value)}
              placeholder="Ej: 24.5k"
              className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
              style={inputStyle}
              {...focusHandlers}
            />
          </Field>

          {/* Bio */}
          <Field label="Bio / Descripción (opcional)">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Ej: Lifestyle & food | Buenos Aires 🍔"
              rows={3}
              className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200 resize-none"
              style={inputStyle}
              {...focusHandlers}
            />
          </Field>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: canSubmit ? 'var(--shadow-btn-brand)' : 'none' }}
            onMouseEnter={e => { if (canSubmit) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
            onMouseLeave={e => { if (canSubmit) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'; }}
          >
            <UserPlus className="w-4 h-4" />
            Agregar creador
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const sc = scoreColor(score);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${sc.text}`}>{score}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UGCsTab({ ugcs, campanas, onAddUGC, onUpdateUGC, onDeleteUGC }: Props) {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoUGC | ''>('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedUGC, setSelectedUGC] = useState<UGC | null>(null);
  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const [showNuevoCreadorModal, setShowNuevoCreadorModal] = useState(false);

  const hasActiveFilters = filterEstado !== '' || scoreMin > 0 || scoreMax < 100;

  const filtered = useMemo(() => {
    let list = ugcs.filter(u => {
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

  function handleCrearUGC(ugc: UGC) {
    onUpdateUGC(ugc);
  }

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar creador..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-200 focus:outline-none"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filtros button */}
          <button
            onClick={() => setShowFiltrosModal(true)}
            className="relative flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all duration-200"
            style={hasActiveFilters ? {
              borderColor: 'var(--color-brand-border)',
              backgroundColor: 'var(--color-brand-light)',
              color: 'var(--color-brand-hover)',
            } : {
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-2)',
            }}
            onMouseEnter={e => { if (!hasActiveFilters) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; } }}
            onMouseLeave={e => { if (!hasActiveFilters) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'; } }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
            )}
          </button>

          {/* Nuevo creador button */}
          <button
            onClick={() => setShowNuevoCreadorModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
          >
            <Plus className="w-4 h-4" />
            Nuevo creador
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Filtros activos:</span>
          {filterEstado && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              {filterEstado}
              <button onClick={() => setFilterEstado('')} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(scoreMin > 0 || scoreMax < 100) && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              Score {scoreMin}–{scoreMax}
              <button onClick={() => { setScoreMin(0); setScoreMax(100); }} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 border rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[720px]">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-surface)' }}>
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
                    className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b cursor-pointer select-none whitespace-nowrap transition-colors duration-200"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key as SortKey} />
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}>Campaña</th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
                        <Search className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>Sin resultados</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>No se encontraron creadores con estos filtros</p>
                      </div>
                      <button
                        onClick={() => { setSearch(''); setFilterEstado(''); setScoreMin(0); setScoreMax(100); }}
                        className="text-xs font-semibold underline"
                        style={{ color: 'var(--color-brand)' }}
                      >
                        Limpiar filtros
                      </button>
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
                    className="cursor-pointer group transition-colors duration-150"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                  >
                    <td className="py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                          {getInitials(u.nombre)}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm" style={{ color: 'var(--color-text-1)' }}>{u.nombre}</span>
                          {needsInfoUpdate(u) && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--color-brand)' }}>
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Actualizar información
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <ScoreBar score={u.score} />
                    </td>
                    <td className="py-3.5 px-4 border-b font-mono text-sm" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-3)' }}>
                      {u.ultimaActividad}
                    </td>
                    <td className="py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      {u.campanasignada ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-[130px] block"
                          style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}>
                          {u.campanasignada}
                        </span>
                      ) : (
                        <span className="text-lg" style={{ color: 'var(--color-border)' }}>—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedUGC(u)}
                          title="Ver perfil"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedUGC(u)}
                          title="Ver conversación"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ecfdf5'; (e.currentTarget as HTMLElement).style.color = '#059669'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteUGC(u.id)}
                          title="Eliminar creador"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff1f2'; (e.currentTarget as HTMLElement).style.color = '#e11d48'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
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
        <div className="px-4 py-2.5 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-alt)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-3)' }}>{filtered.length} de {ugcs.length} creadores</span>
          <div className="flex gap-3">
            {['Calificado', 'Respondió', 'Contactado'].map(e => {
              const count = ugcs.filter(u => u.estado === e).length;
              return (
                <span key={e} className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                  <span className="font-mono font-bold" style={{ color: 'var(--color-text-2)' }}>{count}</span> {e.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showFiltrosModal && (
        <FiltrosModal
          filterEstado={filterEstado}
          scoreMin={scoreMin}
          scoreMax={scoreMax}
          onApply={(estado, min, max) => {
            setFilterEstado(estado);
            setScoreMin(min);
            setScoreMax(max);
          }}
          onClose={() => setShowFiltrosModal(false)}
        />
      )}

      {showNuevoCreadorModal && (
        <NuevoCreadorModal
          onCrear={handleCrearUGC}
          onClose={() => setShowNuevoCreadorModal(false)}
        />
      )}

      {/* ── Drawer ─────────────────────────────────────────────────────── */}
      {selectedUGC && (
        <UGCDrawer
          ugc={selectedUGC}
          campanas={campanas}
          onClose={() => setSelectedUGC(null)}
          onAvanzar={handleAvanzar}
          onDescartar={handleDescartar}
          onAsignar={handleAsignar}
          onUpdateUGC={onUpdateUGC}
        />
      )}
    </div>
  );
}
