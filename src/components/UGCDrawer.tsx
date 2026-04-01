import { X, MessageCircle, TrendingUp, Award, ChevronRight, Send } from 'lucide-react';
import type { UGC, Campana } from '../data';
import { scoreColor, ESTADO_UGC_CONFIG, getInitials, avatarColor } from '../utils';

interface Props {
  ugc: UGC;
  campanas: Campana[];
  onClose: () => void;
  onAvanzar: (ugc: UGC) => void;
  onDescartar: (ugc: UGC) => void;
  onAsignar: (ugc: UGC, campanaId: string) => void;
}

export default function UGCDrawer({ ugc, campanas, onClose, onAvanzar, onDescartar, onAsignar }: Props) {
  const av = avatarColor(ugc.id);
  const sc = scoreColor(ugc.score);
  const estadoConfig = ESTADO_UGC_CONFIG[ugc.estado];
  const totalScore = ugc.scoreBreakdown.reduce((a, b) => a + b.puntos, 0);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40 overlay-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col drawer-enter border-l border-slate-100">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${av}`}>
                {getInitials(ugc.nombre)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{ugc.nombre}</h2>
                <p className="text-sm text-slate-400">{ugc.bio}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${estadoConfig.className}`}>
              {estadoConfig.label}
            </span>
            {ugc.seguidores && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-50 text-slate-500 border border-slate-100">
                {ugc.seguidores} seguidores
              </span>
            )}
          </div>

          {/* Score gauge */}
          <div className="mt-4 p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score total</span>
              <span className={`font-mono font-bold text-lg ${sc.text}`}>{ugc.score}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${sc.bar} rounded-full transition-all duration-700`}
                style={{ width: `${ugc.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Score Breakdown */}
          <div className="px-6 py-4 border-b border-slate-50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Desglose del Score
            </h3>
            <div className="space-y-2.5">
              {ugc.scoreBreakdown.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-600">{s.criterio}</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{s.puntos}<span className="text-slate-300">/{s.maximo}</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${scoreColor(totalScore).bar} rounded-full transition-all duration-500`}
                      style={{ width: `${(s.puntos / s.maximo) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Qualification Q&A */}
          {ugc.calificacion.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                <Award className="w-3 h-3" />
                Respuestas de Calificación
              </h3>
              <div className="space-y-3">
                {ugc.calificacion.map((q, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">{q.pregunta}</p>
                    <p className="text-sm text-slate-700">{q.respuesta}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          <div className="px-6 py-4 border-b border-slate-50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" />
              Historial de conversación
            </h3>
            {ugc.conversacion.length === 0 ? (
              <div className="py-6 text-center text-slate-300 text-sm italic">
                Sin mensajes aún
              </div>
            ) : (
              <div className="space-y-3">
                {ugc.conversacion.map((m) => (
                  <div key={m.id} className={`flex ${m.tipo === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      m.tipo === 'saliente'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                    }`}>
                      <p>{m.texto}</p>
                      <p className={`text-[10px] mt-1 ${m.tipo === 'saliente' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {m.fecha}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign to campaign */}
          {ugc.estado !== 'Descartado' && (
            <div className="px-6 py-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Asignar a campaña</h3>
              <div className="space-y-2">
                {campanas.filter(c => c.estado !== 'Cerrada').map(c => (
                  <button
                    key={c.id}
                    onClick={() => onAsignar(ugc, c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      ugc.campanasignada === c.nombre
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-medium">{c.nombre}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => onAvanzar(ugc)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-sm"
          >
            <Send className="w-4 h-4" />
            Avanzar etapa
          </button>
          <button
            onClick={() => onDescartar(ugc)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors font-semibold text-sm"
          >
            Descartar
          </button>
        </div>
      </div>
    </>
  );
}
