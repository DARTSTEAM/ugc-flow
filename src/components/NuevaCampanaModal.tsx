import { useState } from 'react';
import {
  X, Rocket, Calendar, FileText, Tag,
  ChevronRight, ChevronLeft, Users, MessageSquare,
  Check, Search, Plus, Trash2, GripVertical,
} from 'lucide-react';
import type { Campana, EstadoCampana, UGC } from '../data';
import { getInitials, avatarColor, scoreColor, ESTADO_UGC_CONFIG } from '../utils';

interface Props {
  onClose: () => void;
  onCrear: (campana: Campana) => void;
  ugcs: UGC[];
}

const MARCAS = ['Popeyes', "Dunkin'", "Papa John's", 'Bembos', 'Chinawok', 'Don Belisario'];

const DEFAULT_QUESTIONS = [
  '¿Cuál es tu edad?',
  '¿Eres creador de contenido o UGC?',
  '¿Cuántos seguidores tienes en Instagram?',
  '¿Cuántos seguidores tienes en TikTok?',
  '¿Has trabajado con marcas anteriormente?',
  '¿Con qué equipos grabas tus videos?',
  '¿Eres consumidor/a de [Marca]?',
  '¿Cuántas veces has consumido [Marca] en los últimos 3 meses?',
  '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?',
  '¿Tienes disponibilidad para las próximas semanas?',
];

const STEPS = [
  { id: 1, label: 'Datos básicos', icon: FileText },
  { id: 2, label: 'Selección de UGCs', icon: Users },
  { id: 3, label: 'Preguntas', icon: MessageSquare },
];

const inputBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-1)',
};

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--color-brand)';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)';
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--color-border)';
  e.currentTarget.style.boxShadow = '';
}

export default function NuevaCampanaModal({ onClose, onCrear, ugcs }: Props) {
  const [step, setStep] = useState(1);

  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('Popeyes');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estado, setEstado] = useState<EstadoCampana>('Borrador');
  const [mensajeContacto, setMensajeContacto] = useState('');
  const [error, setError] = useState('');

  const [selectedUGCIds, setSelectedUGCIds] = useState<string[]>([]);
  const [ugcSearch, setUGCSearch] = useState('');

  const [questions, setQuestions] = useState<string[]>(() =>
    DEFAULT_QUESTIONS.map(q => q.replace('[Marca]', 'Popeyes'))
  );
  const [newQuestion, setNewQuestion] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  function validateStep1() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return false; }
    if (!fechaInicio || !fechaFin) { setError('Las fechas son requeridas.'); return false; }
    if (fechaFin < fechaInicio) { setError('La fecha de fin debe ser posterior al inicio.'); return false; }
    setError('');
    return true;
  }

  function handleMarcaChange(m: string) {
    setMarca(m);
    setQuestions(prev =>
      prev.map(q => q.replace(/consumidor\/a de .+\?/, `consumidor/a de ${m}?`)
                    .replace(/consumido .+ en los últimos/, `consumido ${m} en los últimos`))
    );
  }

  function toggleUGC(id: string) {
    setSelectedUGCIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const filteredUGCs = ugcs.filter(u =>
    u.nombre.toLowerCase().includes(ugcSearch.toLowerCase())
  );

  function handleAddQuestion() {
    if (!newQuestion.trim()) return;
    setQuestions(prev => [...prev, newQuestion.trim()]);
    setNewQuestion('');
  }

  function handleDeleteQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditingText(questions[idx]);
  }

  function saveEdit(idx: number) {
    if (!editingText.trim()) return;
    setQuestions(prev => prev.map((q, i) => i === idx ? editingText.trim() : q));
    setEditingIdx(null);
  }

  function handleSubmit() {
    const ugcEntries = selectedUGCIds.map(id => ({
      ugcId: id,
      estado: 'Pendiente' as const,
      fechaEnvio: new Date().toISOString().split('T')[0],
      fechaRespuesta: null,
    }));
    const nueva: Campana = {
      id: `camp-${Date.now()}`,
      nombre: nombre.trim(),
      marca,
      descripcion: descripcion.trim(),
      fechaInicio,
      fechaFin,
      estado,
      ugcs: ugcEntries,
      mensajeContacto: mensajeContacto.trim() || undefined,
    };
    onCrear(nueva);
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  }

  function handleBack() {
    setError('');
    setStep(s => s - 1);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="rounded-2xl border w-full max-w-2xl pointer-events-auto modal-enter flex flex-col max-h-[92vh]"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-brand-light)' }}>
                  <Rocket className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
                </div>
                <div>
                  <h2 className="text-base font-black" style={{ color: 'var(--color-text-1)' }}>Nueva campaña</h2>
                  <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Paso {step} de {STEPS.length}</p>
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

            {/* Step indicators */}
            <div className="flex items-center gap-0">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={isActive ? {
                        backgroundColor: 'var(--color-brand)',
                        color: '#fff',
                        boxShadow: 'var(--shadow-btn-brand)',
                      } : isDone ? {
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                      } : {
                        backgroundColor: 'var(--color-surface-alt)',
                        color: 'var(--color-text-3)',
                      }}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                      <span className="hidden sm:block">{s.label}</span>
                      <span className="sm:hidden">{s.id}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className="h-px flex-1 mx-1"
                        style={{ backgroundColor: step > s.id ? '#86efac' : 'var(--color-border-subtle)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── STEP 1: Datos básicos ─────────────────────────────────── */}
            {step === 1 && (
              <div className="px-6 py-5 flex flex-col gap-4">

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1"
                    style={{ color: 'var(--color-text-3)' }}>
                    <FileText className="w-3 h-3" /> Nombre de la campaña
                  </label>
                  <input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="ej: Lanzamiento Popeyes Verano 2025"
                    autoFocus
                    className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                    style={inputBase}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1"
                      style={{ color: 'var(--color-text-3)' }}>
                      <Tag className="w-3 h-3" /> Marca
                    </label>
                    <select
                      value={marca}
                      onChange={e => handleMarcaChange(e.target.value)}
                      className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                      style={inputBase}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    >
                      {MARCAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em]"
                      style={{ color: 'var(--color-text-3)' }}>Estado inicial</label>
                    <select
                      value={estado}
                      onChange={e => setEstado(e.target.value as EstadoCampana)}
                      className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                      style={inputBase}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    >
                      <option value="Borrador">Borrador</option>
                      <option value="Activa">Activa</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em]"
                    style={{ color: 'var(--color-text-3)' }}>Descripción</label>
                  <textarea
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Descripción de la campaña, brief, objetivos..."
                    rows={3}
                    className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all resize-none"
                    style={inputBase}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1"
                      style={{ color: 'var(--color-text-3)' }}>
                      <Calendar className="w-3 h-3" /> Inicio
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                      className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                      style={inputBase}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1"
                      style={{ color: 'var(--color-text-3)' }}>
                      <Calendar className="w-3 h-3" /> Fin
                    </label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                      style={inputBase}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1"
                    style={{ color: 'var(--color-text-3)' }}>
                    <MessageSquare className="w-3 h-3" /> Mensaje de contacto
                  </label>
                  <textarea
                    value={mensajeContacto}
                    onChange={e => setMensajeContacto(e.target.value)}
                    placeholder={`Ej: ¡Hola! Te escribimos de NGR porque nos encanta tu contenido. Estamos buscando creadores para una campaña de ${marca}. ¿Tenés un momento para contarnos más?`}
                    rows={3}
                    className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all resize-none"
                    style={inputBase}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                    Este mensaje se enviará por WhatsApp a los creadores seleccionados al iniciar la campaña.
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>
            )}

            {/* ── STEP 2: Selección de UGCs ─────────────────────────────── */}
            {step === 2 && (
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Seleccioná los UGCs</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                      {selectedUGCIds.length === 0
                        ? 'Ninguno seleccionado · podés agregar luego'
                        : `${selectedUGCIds.length} UGC${selectedUGCIds.length !== 1 ? 's' : ''} seleccionado${selectedUGCIds.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  {selectedUGCIds.length > 0 && (
                    <button
                      onClick={() => setSelectedUGCIds([])}
                      className="text-xs underline transition-colors duration-200"
                      style={{ color: 'var(--color-text-3)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-3)' }} />
                  <input
                    value={ugcSearch}
                    onChange={e => setUGCSearch(e.target.value)}
                    placeholder="Buscar creador..."
                    className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                    style={inputBase}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                  {filteredUGCs.length === 0 && (
                    <p className="text-center text-sm py-10" style={{ color: 'var(--color-text-3)' }}>
                      No se encontraron creadores
                    </p>
                  )}
                  {filteredUGCs.map(u => {
                    const isSelected = selectedUGCIds.includes(u.id);
                    const av = avatarColor(u.id);
                    const sc = scoreColor(u.score);
                    const estadoCfg = ESTADO_UGC_CONFIG[u.estado];
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUGC(u.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150"
                        style={isSelected ? {
                          backgroundColor: 'var(--color-brand-light)',
                          borderColor: 'var(--color-brand-border)',
                          boxShadow: '0 0 0 1px var(--color-brand-border)',
                        } : {
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border-subtle)',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'; }}
                      >
                        <div
                          className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                          style={isSelected ? {
                            backgroundColor: 'var(--color-brand)',
                            borderColor: 'var(--color-brand)',
                          } : {
                            borderColor: 'var(--color-border)',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                          {getInitials(u.nombre)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{u.nombre}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${estadoCfg.className}`}>
                              {estadoCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>{u.canal}</span>
                            {u.seguidores && <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>· {u.seguidores} seguidores</span>}
                          </div>
                        </div>
                        <div className={`text-xs font-mono font-bold flex-shrink-0 ${sc.text}`}>
                          {u.score}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedUGCIds.length > 0 && (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-3)' }}>
                      Seleccionados
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUGCIds.map(id => {
                        const u = ugcs.find(x => x.id === id);
                        if (!u) return null;
                        return (
                          <span
                            key={id}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border"
                            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', borderColor: 'var(--color-brand-border)' }}
                          >
                            {u.nombre}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleUGC(id); }}
                              className="hover:opacity-70 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Preguntas ─────────────────────────────────────── */}
            {step === 3 && (
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                    Preguntas de calificación
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                    Estas preguntas se enviarán a los {selectedUGCIds.length > 0 ? selectedUGCIds.length : 'todos los'} UGCs seleccionados. Podés editarlas, reordenarlas o agregar nuevas.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="group flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150"
                      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)'}
                    >
                      <GripVertical className="w-4 h-4 mt-0.5 flex-shrink-0 cursor-grab"
                        style={{ color: 'var(--color-border)' }} />
                      <span className="text-[10px] font-mono font-bold mt-0.5 flex-shrink-0 w-4 text-right"
                        style={{ color: 'var(--color-text-3)' }}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {editingIdx === idx ? (
                          <input
                            autoFocus
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            onBlur={() => saveEdit(idx)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(idx);
                              if (e.key === 'Escape') setEditingIdx(null);
                            }}
                            className="w-full text-sm bg-transparent border-b focus:outline-none pb-0.5"
                            style={{ color: 'var(--color-text-1)', borderColor: 'var(--color-brand)' }}
                          />
                        ) : (
                          <p
                            className="text-sm cursor-text transition-colors duration-150"
                            style={{ color: 'var(--color-text-2)' }}
                            onClick={() => startEdit(idx)}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-2)'}
                            title="Click para editar"
                          >
                            {q}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => startEdit(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                          title="Editar"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150"
                          style={{ color: 'var(--color-text-3)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff1f2'; (e.currentTarget as HTMLElement).style.color = '#e11d48'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                    placeholder="Agregar nueva pregunta..."
                    className="flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
                    style={inputBase}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <button
                    onClick={handleAddQuestion}
                    disabled={!newQuestion.trim()}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-brand)', boxShadow: newQuestion.trim() ? 'var(--shadow-btn-brand)' : 'none' }}
                    onMouseEnter={e => { if (newQuestion.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
                    onMouseLeave={e => { if (newQuestion.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'; }}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                <div
                  className="p-3 rounded-xl border flex items-center gap-3 text-xs"
                  style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                  <span>
                    Se enviarán{' '}
                    <strong style={{ color: 'var(--color-text-1)' }}>{questions.length} preguntas</strong> a{' '}
                    <strong style={{ color: 'var(--color-text-1)' }}>
                      {selectedUGCIds.length > 0 ? `${selectedUGCIds.length} UGC${selectedUGCIds.length !== 1 ? 's' : ''}` : 'los UGCs que agregues luego'}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-6 pb-6 pt-4 border-t flex-shrink-0 flex gap-2"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2.5 border rounded-xl font-semibold text-sm transition-all duration-200"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="px-4 py-2.5 border rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
            >
              Cancelar
            </button>

            {step < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
                style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
                style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
              >
                <Rocket className="w-4 h-4" />
                Crear campaña
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
