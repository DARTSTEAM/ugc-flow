import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, ChevronDown, ChevronUp, ChevronsUpDown,
  Eye, MessageCircle, Trash2, SlidersHorizontal, X,
  Filter, UserPlus, Instagram, Mail, MessageSquare, AlertTriangle
} from 'lucide-react';
import type { UGC, Canal, Campana } from '../data';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import {
  scoreColor, ESTADO_UGC_CONFIG,
  getInitials, avatarColor, needsInfoUpdate,
  parseFollowersNum, haTrabajadoConNGR
} from '../utils';
import UGCDrawer from './UGCDrawer';

interface Props {
  ugcs: UGC[];
  campanas: Campana[];
  onAddUGC: () => void;
  onUpdateUGC: (ugc: UGC) => void;
  onDeleteUGC: (id: string) => void;
  onGoToChat?: (ugc: UGC) => void;
  onAsignar?: (ugc: UGC, campanaId: string) => void;
}

type SortKey = 'nombre' | 'estado' | 'score' | 'ultimaActividad';
type SortDir = 'asc' | 'desc';

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
              className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-200"
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

// ─── Minimum Number Input ─────────────────────────────────────────────────────
function MinNumberInput({ value, onChange, max = Infinity, suffix, showScoreBar }: { value: number; onChange: (v: number) => void; max?: number; suffix?: string; showScoreBar?: boolean }) {
  // Draft state allows the user to clear the field and type freely.
  // On blur, if the draft is empty/invalid, it snaps back to the committed value.
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  function handleChange(val: string) {
    if (/^\d*$/.test(val)) setDraft(val);
  }

  function handleBlur() {
    const v = parseInt(draft, 10);
    if (isNaN(v) || draft.trim() === '') {
      setDraft(String(value)); // restore previous
    } else {
      const clamped = Math.max(0, Math.min(v, max));
      onChange(clamped);
      setDraft(String(clamped));
    }
  }

  const numStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-1)',
  };

  const liveValue = Math.max(0, Math.min(parseInt(draft, 10) || 0, 100));

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className={`w-full text-center px-2 py-1.5 border rounded-xl text-sm font-medium focus:outline-none transition-all duration-200 ${suffix ? 'pr-6' : ''}`}
        style={numStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; e.currentTarget.select(); }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
      />
      {suffix && (
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
          style={{ color: 'var(--color-text-3)' }}
        >
          {suffix}
        </span>
      )}
      {showScoreBar && (
        // Full-size clip matching the input's own box exactly, so the input's real
        // border-radius crops the thin bar's corners instead of a mismatched tighter one.
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div
            className="absolute left-0 right-0 bottom-0 h-1"
            style={{ backgroundColor: 'var(--color-border)' }}
          >
            <div
              className={`h-full ${scoreColor(liveValue).bar} transition-all duration-200`}
              style={{ width: `${liveValue}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Checkbox toggle button ───────────────────────────────────────────────────
function CheckboxField({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150"
      style={checked ? {
        borderColor: 'var(--color-brand)',
        backgroundColor: 'var(--color-brand-light)',
        color: 'var(--color-brand-hover)',
      } : {
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-alt)',
        color: 'var(--color-text-2)',
      }}
    >
      <span>{label}</span>
      <span
        className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-all"
        style={{
          borderColor: checked ? 'var(--color-brand)' : 'var(--color-border)',
          backgroundColor: checked ? 'var(--color-brand)' : 'transparent',
        }}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─── Filtros Modal ────────────────────────────────────────────────────────────
const DEFAULT_SCORE_MIN = 50;
const DEFAULT_SEGUIDORES_MIN = 50000;

export interface FiltrosState {
  scoreMin: number;
  seguidoresMin: number;
  trabajoNGR: boolean;
  etiquetas: string[];
}

interface FiltrosModalProps extends FiltrosState {
  availableEtiquetas: string[];
  onApply: (filtros: FiltrosState) => void;
  onClose: () => void;
}

function FiltrosModal({ scoreMin, seguidoresMin, trabajoNGR, etiquetas: filterEtiquetas, availableEtiquetas, onApply, onClose }: FiltrosModalProps) {
  const [localMin, setLocalMin] = useState(scoreMin || DEFAULT_SCORE_MIN);
  const [localSeguidoresMin, setLocalSeguidoresMin] = useState(seguidoresMin || DEFAULT_SEGUIDORES_MIN);
  const [localTrabajoNGR, setLocalTrabajoNGR] = useState(trabajoNGR);
  const [localEtiquetas, setLocalEtiquetas] = useState<string[]>(filterEtiquetas);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [freshEtiquetas, setFreshEtiquetas] = useState<string[]>(availableEtiquetas);

  useEffect(() => {
    fetch('/api/etiquetas')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Respetar el orden que envía el servidor (lista base + personalizadas);
          // sumar al final cualquier etiqueta local que no esté todavía en la respuesta.
          const extra = availableEtiquetas.filter(t => !data.includes(t));
          setFreshEtiquetas([...data, ...extra]);
        }
      })
      .catch(() => {});
  }, []);

  const hasChanges = localMin > 0 || localSeguidoresMin > 0 || localTrabajoNGR || localEtiquetas.length > 0;

  function handleApply() {
    onApply({ scoreMin: localMin, seguidoresMin: localSeguidoresMin, trabajoNGR: localTrabajoNGR, etiquetas: localEtiquetas });
    onClose();
  }

  function handleReset() {
    setLocalMin(0);
    setLocalSeguidoresMin(0);
    setLocalTrabajoNGR(false);
    setLocalEtiquetas([]);
  }

  function toggleEtiqueta(tag: string) {
    setLocalEtiquetas(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Filtrar creadores"
      subtitle="Aplicá uno o más filtros para refinar la tabla"
      icon={<Filter className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />}
    >
      <div className="px-6 py-5 flex flex-col gap-5">

        {/* Score mínimo + Mínimo de seguidores */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Field label="Score mínimo">
              <MinNumberInput value={localMin} onChange={setLocalMin} max={100} suffix="%" showScoreBar />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Mínimo de seguidores">
              <MinNumberInput value={localSeguidoresMin} onChange={setLocalSeguidoresMin} />
            </Field>
          </div>
        </div>

        {/* Ya trabajó con NGR */}
        <CheckboxField
          label="Ya trabajó con NGR"
          checked={localTrabajoNGR}
          onToggle={() => setLocalTrabajoNGR(v => !v)}
        />

        {/* Etiquetas — multi-select dropdown */}
        <Field label="Etiquetas">
            {/* Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all duration-150"
                style={{
                  borderColor: dropdownOpen ? 'var(--color-brand)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-alt)',
                  color: localEtiquetas.length > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: dropdownOpen ? '0 0 0 3px rgba(252,154,0,0.12)' : 'none',
                }}
              >
                <span>
                  {localEtiquetas.length === 0
                    ? 'Seleccionar etiquetas...'
                    : `${localEtiquetas.length} etiqueta${localEtiquetas.length !== 1 ? 's' : ''} seleccionada${localEtiquetas.length !== 1 ? 's' : ''}`}
                </span>
                <ChevronDown
                  className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--color-text-3)',
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {/* Dropdown list */}
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div
                    className="absolute left-0 right-0 z-20 mt-1 rounded-xl border shadow-lg overflow-hidden"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', maxHeight: '200px', overflowY: 'auto' }}
                  >
                    {localEtiquetas.length > 0 && (
                      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-3)' }}>
                          {localEtiquetas.length} seleccionada{localEtiquetas.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLocalEtiquetas([])}
                          className="text-[10px] underline"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                    {freshEtiquetas.map(tag => {
                      const checked = localEtiquetas.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleEtiqueta(tag)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors duration-100"
                          style={{
                            backgroundColor: checked ? 'var(--color-brand-light)' : 'transparent',
                            color: checked ? 'var(--color-brand-hover)' : 'var(--color-text-1)',
                          }}
                          onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                          onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span
                            className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-all"
                            style={{
                              borderColor: checked ? 'var(--color-brand)' : 'var(--color-border)',
                              backgroundColor: checked ? 'var(--color-brand)' : 'transparent',
                            }}
                          >
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className="font-medium">{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Selected chips */}
            {localEtiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {localEtiquetas.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleEtiqueta(tag)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
      scoreBreakdown: [],
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

// ─── Empty results state (shared by table + mobile card list) ────────────────
function EmptyResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
        <Search className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>Sin resultados</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>No se encontraron creadores con estos filtros</p>
      </div>
      <button
        onClick={onClear}
        className="text-xs font-semibold underline"
        style={{ color: 'var(--color-brand)' }}
      >
        Limpiar filtros
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UGCsTab({ ugcs, campanas, onAddUGC, onUpdateUGC, onDeleteUGC, onGoToChat, onAsignar }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const scoreMin = Number(searchParams.get('scoreMin') ?? 0);
  const seguidoresMin = Number(searchParams.get('seguidoresMin') ?? 0);
  const filterTrabajoNGR = searchParams.get('trabajoNGR') === '1';
  const etiquetasParam = searchParams.get('etiquetas');
  const filterEtiquetas = useMemo(() => etiquetasParam ? etiquetasParam.split(',').filter(Boolean) : [], [etiquetasParam]);
  const sortKey = (searchParams.get('sort') as SortKey | null) ?? 'score';
  const sortDir = (searchParams.get('dir') as SortDir | null) ?? 'desc';

  const selectedUGC = id ? ugcs.find(u => u.id === id) ?? null : null;

  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const [showNuevoCreadorModal, setShowNuevoCreadorModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /** Aplica un patch de query params; `null`/'' borra la clave. `replace` evita ensuciar el historial (ideal para texto libre). */
  function updateParams(patch: Record<string, string | null>, opts?: { replace?: boolean }) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      return next;
    }, opts);
  }

  const hasActiveFilters = scoreMin > 0 || seguidoresMin > 0 || filterTrabajoNGR || filterEtiquetas.length > 0;

  const [serverEtiquetas, setServerEtiquetas] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/etiquetas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setServerEtiquetas(data); })
      .catch(() => {});
  }, []);

  const allEtiquetas = useMemo(() => {
    const set = new Set<string>(serverEtiquetas);
    ugcs.forEach(u => u.etiquetas?.forEach(e => set.add(e)));
    return [...set].sort();
  }, [ugcs, serverEtiquetas]);

  const filtered = useMemo(() => {
    let list = ugcs.filter(u => {
      const matchSearch = u.nombre.toLowerCase().includes(search.toLowerCase());
      const matchScore = u.score >= scoreMin;
      const matchSeguidores = parseFollowersNum(u) >= seguidoresMin;
      const matchTrabajoNGR = !filterTrabajoNGR || haTrabajadoConNGR(u, campanas);
      const matchEtiqueta = filterEtiquetas.length === 0 || filterEtiquetas.some(e => u.etiquetas?.includes(e));
      return matchSearch && matchScore && matchSeguidores && matchTrabajoNGR && matchEtiqueta;
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
  }, [ugcs, campanas, search, scoreMin, seguidoresMin, filterTrabajoNGR, filterEtiquetas, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) updateParams({ sort: key, dir: sortDir === 'asc' ? 'desc' : 'asc' });
    else updateParams({ sort: key, dir: 'desc' });
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  function handleAsignar(ugc: UGC, campanaId: string) {
    const campana = campanas.find(c => c.id === campanaId);
    const updated = { ...ugc, campanasignada: campana?.nombre || null };
    onUpdateUGC(updated);
    onAsignar?.(ugc, campanaId);
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
            onChange={e => updateParams({ q: e.target.value }, { replace: true })}
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
          {scoreMin > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              Score ≥ {scoreMin}
              <button onClick={() => updateParams({ scoreMin: null })} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {seguidoresMin > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              Seguidores ≥ {seguidoresMin.toLocaleString('es-AR')}
              <button onClick={() => updateParams({ seguidoresMin: null })} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterTrabajoNGR && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              Ya trabajó con NGR
              <button onClick={() => updateParams({ trabajoNGR: null })} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filterEtiquetas.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)' }}>
              #{tag}
              <button onClick={() => updateParams({ etiquetas: filterEtiquetas.filter(t => t !== tag).join(',') || null })} className="ml-0.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table (>= sm) / Cards (< sm) */}
      <div className="flex-1 border rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="hidden sm:flex sm:flex-1 sm:flex-col sm:overflow-hidden">
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
                  <td colSpan={7}>
                    <EmptyResultsState onClear={() => updateParams({ q: null, scoreMin: null, seguidoresMin: null, trabajoNGR: null, etiquetas: null })} />
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const estadoCfg = ESTADO_UGC_CONFIG[u.estado];
                const av = avatarColor(u.id);
                return (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/ugcs/${u.id}`)}
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
                          onClick={() => navigate(`/ugcs/${u.id}`)}
                          title="Ver perfil"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => navigate(`/ugcs/${u.id}`)}
                          title="Ver conversación"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ecfdf5'; (e.currentTarget as HTMLElement).style.color = '#059669'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(u.id)}
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
        </div>

        {/* Cards (< sm) */}
        <div className="sm:hidden flex flex-col gap-2.5 p-2 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <EmptyResultsState onClear={() => updateParams({ q: null, scoreMin: null, seguidoresMin: null, trabajoNGR: null, etiquetas: null })} />
          ) : filtered.map((u) => {
            const estadoCfg = ESTADO_UGC_CONFIG[u.estado];
            const av = avatarColor(u.id);
            return (
              <div
                key={u.id}
                onClick={() => navigate(`/ugcs/${u.id}`)}
                className="cursor-pointer border rounded-xl p-3 flex flex-col gap-2.5"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                {/* Avatar + name (left) / estado badge (right) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                      {getInitials(u.nombre)}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-1)' }}>{u.nombre}</span>
                      {needsInfoUpdate(u) && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--color-brand)' }}>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Actualizar información
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 ${estadoCfg.className}`}>
                    {estadoCfg.label}
                  </span>
                </div>

                {/* Score */}
                <ScoreBar score={u.score} />

                {/* Última actividad + campaña asignada */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-3)' }}>{u.ultimaActividad}</span>
                  {u.campanasignada ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-[150px]"
                      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}>
                      {u.campanasignada}
                    </span>
                  ) : (
                    <span className="text-lg" style={{ color: 'var(--color-border)' }}>—</span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/ugcs/${u.id}`); }}
                    title="Ver perfil"
                    className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/ugcs/${u.id}`); }}
                    title="Ver conversación"
                    className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setPendingDeleteId(u.id); }}
                    title="Eliminar creador"
                    className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
          scoreMin={scoreMin}
          seguidoresMin={seguidoresMin}
          trabajoNGR={filterTrabajoNGR}
          etiquetas={filterEtiquetas}
          availableEtiquetas={allEtiquetas}
          onApply={filtros => {
            updateParams({
              scoreMin: filtros.scoreMin > 0 ? String(filtros.scoreMin) : null,
              seguidoresMin: filtros.seguidoresMin > 0 ? String(filtros.seguidoresMin) : null,
              trabajoNGR: filtros.trabajoNGR ? '1' : null,
              etiquetas: filtros.etiquetas.length ? filtros.etiquetas.join(',') : null,
            });
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
          onClose={() => navigate('/ugcs')}
          onAsignar={handleAsignar}
          onUpdateUGC={onUpdateUGC}
          onGoToChat={ugc => onGoToChat?.(ugc)}
        />
      )}

      <ConfirmDeleteModal
        open={pendingDeleteId !== null}
        itemName={ugcs.find(u => u.id === pendingDeleteId)?.nombre ?? ''}
        onConfirm={() => { if (pendingDeleteId) { onDeleteUGC(pendingDeleteId); } setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
