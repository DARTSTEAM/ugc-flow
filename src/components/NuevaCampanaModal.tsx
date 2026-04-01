import { useState } from 'react';
import { X, Rocket, Calendar, FileText, Target, Tag } from 'lucide-react';
import type { Campana, EstadoCampana } from '../data';

interface Props {
  onClose: () => void;
  onCrear: (campana: Campana) => void;
}

const MARCAS = ['Popeyes', 'Burger King', 'KFC', 'McDonald\'s', 'Wendy\'s', 'Otra'];

export default function NuevaCampanaModal({ onClose, onCrear }: Props) {
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('Popeyes');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [objetivo, setObjetivo] = useState(10);
  const [estado, setEstado] = useState<EstadoCampana>('Borrador');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (!fechaInicio || !fechaFin) { setError('Las fechas son requeridas.'); return; }
    if (fechaFin < fechaInicio) { setError('La fecha de fin debe ser posterior al inicio.'); return; }

    const nueva: Campana = {
      id: `camp-${Date.now()}`,
      nombre: nombre.trim(),
      marca,
      descripcion: descripcion.trim(),
      fechaInicio,
      fechaFin,
      objetivo,
      estado,
      ugcs: [],
    };
    onCrear(nueva);
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 overlay-enter" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto modal-enter flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Rocket className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Nueva campaña</h2>
                <p className="text-xs text-slate-400">Completá los datos para crear la campaña</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            
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
                  onChange={e => setMarca(e.target.value)}
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
                type="range"
                min={1}
                max={50}
                value={objetivo}
                onChange={e => setObjetivo(+e.target.value)}
                className="accent-indigo-600"
              />
              <div className="flex justify-between text-[9px] text-slate-300 font-mono">
                <span>1</span><span>50</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-slate-50 flex-shrink-0 flex gap-2">
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm shadow-sm shadow-indigo-200"
            >
              <Rocket className="w-4 h-4" />
              Crear campaña
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
