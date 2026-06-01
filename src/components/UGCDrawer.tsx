import { useState, useEffect } from 'react';
import { X, MessageCircle, TrendingUp, Award, ChevronRight, Send, Loader2 } from 'lucide-react';
import type { UGC, Campana } from '../data';
import { scoreColor, ESTADO_UGC_CONFIG, getInitials, avatarColor } from '../utils';
import { fetchCreatorDetail } from '../api';

interface Props {
  ugc: UGC;
  campanas: Campana[];
  onClose: () => void;
  onAvanzar: (ugc: UGC) => void;
  onDescartar: (ugc: UGC) => void;
  onAsignar: (ugc: UGC, campanaId: string) => void;
}

const ESTADO_ORDER = ['Nuevo', 'Contactado', 'Respondió', 'Calificado', 'Descartado'] as const;

export default function UGCDrawer({ ugc: ugcProp, campanas, onClose, onAvanzar, onDescartar, onAsignar }: Props) {
  const [ugc, setUgc] = useState<UGC>(ugcProp);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      try {
        setLoadingDetail(true);
        const detail = await fetchCreatorDetail(ugcProp.id);
        if (!cancelled) setUgc({ ...ugcProp, ...detail });
      } catch (err) {
        console.error('Failed to load creator detail:', err);
        if (!cancelled) setUgc(ugcProp);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [ugcProp.id]);

  const av = avatarColor(ugc.id);
  const sc = scoreColor(ugc.score);
  const estadoConfig = ESTADO_UGC_CONFIG[ugc.estado];
  const totalScore = (ugc.scoreBreakdown || []).reduce((a, b) => a + b.puntos, 0);

  const currentIdx = ESTADO_ORDER.indexOf(ugc.estado as typeof ESTADO_ORDER[number]);
  const nextEstado = currentIdx >= 0 && currentIdx < ESTADO_ORDER.length - 2
    ? ESTADO_ORDER[currentIdx + 1]
    : null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-xl z-50 flex flex-col drawer-enter border-l"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-drawer)' }}
      >

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${av}`}>
                {getInitials(ugc.nombre)}
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</h2>
                <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>{ugc.bio}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${estadoConfig.className}`}>
              {estadoConfig.label}
            </span>
            {ugc.seguidores && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium border"
                style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)', borderColor: 'var(--color-border)' }}>
                {ugc.seguidores} seguidores
              </span>
            )}
          </div>

          {/* Score gauge */}
          <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>Score total</span>
              <span className={`font-mono font-bold text-lg ${sc.text}`}>{ugc.score}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
              <div
                className={`h-full ${sc.bar} rounded-full transition-all duration-700`}
                style={{ width: `${ugc.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--color-text-3)' }}>Cargando detalle...</span>
            </div>
          ) : (
            <>
              {/* Score Breakdown */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                  <TrendingUp className="w-3 h-3" />
                  Desglose del Score
                </h3>
                <div className="space-y-2.5">
                  {ugc.scoreBreakdown.map((s, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>{s.criterio}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {s.puntos}<span style={{ color: 'var(--color-text-3)' }}>/{s.maximo}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
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
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                    <Award className="w-3 h-3" />
                    Respuestas de Calificación
                  </h3>
                  <div className="space-y-3">
                    {ugc.calificacion.map((q, i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
                        <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-3)' }}>{q.pregunta}</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-1)' }}>{q.respuesta}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                  <MessageCircle className="w-3 h-3" />
                  Historial de conversación
                </h3>
                {ugc.conversacion.length === 0 ? (
                  <div className="py-6 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>
                    Sin mensajes aún
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ugc.conversacion.map((m) => (
                      <div key={m.id} className={`flex ${m.tipo === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
                          style={m.tipo === 'saliente' ? {
                            backgroundColor: 'var(--color-brand)',
                            color: '#fff',
                            borderTopRightRadius: '4px',
                          } : {
                            backgroundColor: 'var(--color-surface-alt)',
                            color: 'var(--color-text-1)',
                            borderTopLeftRadius: '4px',
                          }}
                        >
                          <p>{m.texto}</p>
                          <p className="text-[10px] mt-1" style={{ color: m.tipo === 'saliente' ? 'rgba(255,255,255,0.65)' : 'var(--color-text-3)' }}>
                            {m.fecha}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Assign to campaign */}
          {ugc.estado !== 'Descartado' && (
            <div className="px-6 py-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-3)' }}>
                Asignar a campaña
              </h3>
              <div className="space-y-2">
                {campanas.filter(c => c.estado !== 'Cerrada').map(c => (
                  <button
                    key={c.id}
                    onClick={() => onAsignar(ugc, c.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all duration-200"
                    style={ugc.campanasignada === c.nombre ? {
                      borderColor: 'var(--color-brand-border)',
                      backgroundColor: 'var(--color-brand-light)',
                      color: 'var(--color-brand-hover)',
                    } : {
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface-alt)',
                      color: 'var(--color-text-2)',
                    }}
                    onMouseEnter={e => {
                      if (ugc.campanasignada !== c.nombre) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-border)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (ugc.campanasignada !== c.nombre) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)';
                      }
                    }}
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
        <div className="px-6 py-4 border-t flex-shrink-0 flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            onClick={() => onAvanzar(ugc)}
            disabled={!nextEstado}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: nextEstado ? 'var(--shadow-btn-brand)' : 'none' }}
            onMouseEnter={e => { if (nextEstado) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
            onMouseLeave={e => { if (nextEstado) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'; }}
          >
            <Send className="w-4 h-4" />
            {nextEstado ? `Avanzar a ${nextEstado}` : 'Etapa final'}
          </button>
          <button
            onClick={() => onDescartar(ugc)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-all duration-200 font-semibold text-sm"
          >
            Descartar
          </button>
        </div>
      </div>
    </>
  );
}
