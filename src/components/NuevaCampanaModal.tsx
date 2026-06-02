import { useState } from 'react';
import {
  X, Rocket, Calendar, FileText, Target, Tag,
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

const MARCAS = ['Popeyes', 'Dunkin', 'Papa Johns', 'Bembos', 'Chinawok'];

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

export default function NuevaCampanaModal({ onClose, onCrear, ugcs }: Props) {
  // Step
  const [step, setStep] = useState(1);

  // Step 1: basic data
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('Popeyes');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [objetivo, setObjetivo] = useState(10);
  const [estado, setEstado] = useState<EstadoCampana>('Borrador');
  const [mensajeContacto, setMensajeContacto] = useState('');
  const [error, setError] = useState('');

  // Step 2: UGC selection
  const [selectedUGCIds, setSelectedUGCIds] = useState<string[]>([]);
  const [ugcSearch, setUGCSearch] = useState('');

  // Step 3: questions
  const [questions, setQuestions] = useState<string[]>(() =>
    DEFAULT_QUESTIONS.map(q => q.replace('[Marca]', 'Popeyes'))
  );
  const [newQuestion, setNewQuestion] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // ── Step 1 handlers ────────────────────────────────────────────────────────

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

  // ── Step 2 handlers ────────────────────────────────────────────────────────

  function toggleUGC(id: string) {
    setSelectedUGCIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const filteredUGCs = ugcs.filter(u =>
    u.nombre.toLowerCase().includes(ugcSearch.toLowerCase())
  );

  // ── Step 3 handlers ────────────────────────────────────────────────────────

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

  // ── Submit ─────────────────────────────────────────────────────────────────

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
      objetivo,
      estado,
      ugcs: ugcEntries,
      mensajeContacto: mensajeContacto.trim() || undefined,
    };
    onCrear(nueva);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    setStep(s => s + 1);
  }

  function handleBack() {
    setError('');
    setStep(s => s - 1);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 overlay-enter" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto modal-enter flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Nueva campaña</h2>
                  <p className="text-xs text-slate-400">Paso {step} de {STEPS.length}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
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
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : isDone
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-slate-400 bg-slate-50'
                    }`}>
                      {isDone
                        ? <Check className="w-3 h-3" />
                        : <Icon className="w-3 h-3" />
                      }
                      <span className="hidden sm:block">{s.label}</span>
                      <span className="sm:hidden">{s.id}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`h-px flex-1 mx-1 ${step > s.id ? 'bg-emerald-300' : 'bg-slate-100'}`} />
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

                {/* Nombre */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Nombre de la campaña
                  </label>
                  <input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="ej: Lanzamiento Popeyes Verano 2025"
                    autoFocus
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                </div>

                {/* Marca + Estado */}
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Marca
                    </label>
                    <select
                      value={marca}
                      onChange={e => handleMarcaChange(e.target.value)}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    >
                      {MARCAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Estado inicial</label>
                    <select
                      value={estado}
                      onChange={e => setEstado(e.target.value as EstadoCampana)}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    >
                      <option value="Borrador">Borrador</option>
                      <option value="Activa">Activa</option>
                    </select>
                  </div>
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Descripción</label>
                  <textarea
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Descripción de la campaña, brief, objetivos..."
                    rows={3}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all resize-none"
                  />
                </div>

                {/* Fechas */}
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Inicio
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Fin
                    </label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                    />
                  </div>
                </div>

                {/* Objetivo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                    <Target className="w-3 h-3" /> Objetivo de UGCs: <span className="text-slate-700 font-mono ml-1">{objetivo}</span>
                  </label>
                  <input
                    type="range" min={1} max={50} value={objetivo}
                    onChange={e => setObjetivo(+e.target.value)}
                    className="accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-300 font-mono">
                    <span>1</span><span>50</span>
                  </div>
                </div>

                {/* Mensaje de contacto */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Mensaje de contacto
                  </label>
                  <textarea
                    value={mensajeContacto}
                    onChange={e => setMensajeContacto(e.target.value)}
                    placeholder={`Ej: ¡Hola! Te escribimos de NGR porque nos encanta tu contenido. Estamos buscando creadores para una campaña de ${marca}. ¿Tenés un momento para contarnos más?`}
                    rows={3}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all resize-none"
                  />
                  <p className="text-[10px] text-slate-400">Este mensaje se enviará por WhatsApp a los creadores seleccionados al iniciar la campaña.</p>
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
                    <h3 className="text-sm font-bold text-slate-800">Seleccioná los UGCs</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedUGCIds.length === 0
                        ? 'Ninguno seleccionado · podés agregar luego'
                        : `${selectedUGCIds.length} UGC${selectedUGCIds.length !== 1 ? 's' : ''} seleccionado${selectedUGCIds.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  {selectedUGCIds.length > 0 && (
                    <button
                      onClick={() => setSelectedUGCIds([])}
                      className="text-xs text-slate-400 hover:text-rose-500 transition-colors underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    value={ugcSearch}
                    onChange={e => setUGCSearch(e.target.value)}
                    placeholder="Buscar creador..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                </div>

                {/* UGC list */}
                <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                  {filteredUGCs.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-10">No se encontraron creadores</p>
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
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50 shadow-sm shadow-indigo-100'
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                          {getInitials(u.nombre)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 truncate">{u.nombre}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${estadoCfg.className}`}>
                              {estadoCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">{u.canal}</span>
                            {u.seguidores && <span className="text-[10px] text-slate-400">· {u.seguidores} seguidores</span>}
                          </div>
                        </div>

                        {/* Score */}
                        <div className={`text-xs font-mono font-bold flex-shrink-0 ${sc.text}`}>
                          {u.score}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected chips */}
                {selectedUGCIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Seleccionados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUGCIds.map(id => {
                        const u = ugcs.find(x => x.id === id);
                        if (!u) return null;
                        return (
                          <span key={id} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium">
                            {u.nombre}
                            <button onClick={(e) => { e.stopPropagation(); toggleUGC(id); }} className="hover:text-rose-500 transition-colors">
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
                  <h3 className="text-sm font-bold text-slate-800">Preguntas de calificación</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Estas preguntas se enviarán a los {selectedUGCIds.length > 0 ? selectedUGCIds.length : 'todos los'} UGCs seleccionados. Podés editarlas, reordenarlas o agregar nuevas.
                  </p>
                </div>

                {/* Questions list */}
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="group flex items-start gap-2 px-3 py-2.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-all"
                    >
                      {/* Drag handle */}
                      <GripVertical className="w-4 h-4 text-slate-200 mt-0.5 flex-shrink-0 cursor-grab" />

                      {/* Number */}
                      <span className="text-[10px] font-mono font-bold text-slate-300 mt-0.5 flex-shrink-0 w-4 text-right">
                        {idx + 1}
                      </span>

                      {/* Question text / edit */}
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
                            className="w-full text-sm text-slate-800 bg-transparent border-b border-indigo-300 focus:outline-none pb-0.5"
                          />
                        ) : (
                          <p
                            className="text-sm text-slate-700 cursor-text hover:text-slate-900"
                            onClick={() => startEdit(idx)}
                            title="Click para editar"
                          >
                            {q}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => startEdit(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 transition-colors"
                          title="Editar"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new question */}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                    placeholder="Agregar nueva pregunta..."
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                  <button
                    onClick={handleAddQuestion}
                    disabled={!newQuestion.trim()}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                {/* Summary */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                  <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>
                    Se enviarán <strong className="text-slate-700">{questions.length} preguntas</strong> a{' '}
                    <strong className="text-slate-700">
                      {selectedUGCIds.length > 0 ? `${selectedUGCIds.length} UGC${selectedUGCIds.length !== 1 ? 's' : ''}` : 'los UGCs que agregues luego'}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-slate-50 flex-shrink-0 flex gap-2">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            )}

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
            >
              Cancelar
            </button>

            {step < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm shadow-sm shadow-indigo-200"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm shadow-sm shadow-indigo-200"
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
