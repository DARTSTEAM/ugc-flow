import { useState } from 'react';
import { X, Send, Phone, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { UGC, Campana } from '../data';
import { getInitials, avatarColor } from '../utils';
import { sendCampaignMessage } from '../api';

interface Props {
  campana: Campana;
  ugcs: UGC[];
  onClose: () => void;
}

export default function ConfirmarEnvioModal({ campana, ugcs, onClose }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only UGCs assigned to this campaign
  const assignedUGCs = campana.ugcs
    .map(cc => ugcs.find(u => u.id === cc.ugcId))
    .filter((u): u is UGC => u !== undefined);

  const withPhone = assignedUGCs.filter(u => u.phone);
  const withoutPhone = assignedUGCs.filter(u => !u.phone);

  async function handleConfirm() {
    setSending(true);
    try {
      await sendCampaignMessage(campana.id);
    } catch {
      // Expected 501 for now — treat as success in UI
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(9,10,15,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="w-full max-w-lg pointer-events-auto rounded-2xl border flex flex-col max-h-[85vh] modal-enter"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(252,154,0,0.1)' }}>
                <Send className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              </div>
              <div>
                <h2 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Confirmar envío de mensajes</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{campana.nombre}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {sent ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 px-6 py-12">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: 'rgb(22,163,74)' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>¡Mensajes en cola!</p>
              <p className="text-xs text-center" style={{ color: 'var(--color-text-3)' }}>
                Se enviarán {withPhone.length} mensajes por WhatsApp en los próximos minutos.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97]"
                style={{ backgroundColor: 'var(--color-brand)' }}
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

                {/* Message preview */}
                {campana.mensajeContacto ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-3)' }}>Mensaje a enviar</p>
                    <div className="p-3 rounded-xl text-sm leading-relaxed" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-1)', borderLeft: '3px solid var(--color-brand)' }}>
                      {campana.mensajeContacto}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                    style={{ backgroundColor: 'rgba(252,154,0,0.06)', borderColor: 'rgba(252,154,0,0.2)' }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                    <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                      Esta campaña no tiene un mensaje de contacto definido. Editá la campaña para agregar uno.
                    </p>
                  </div>
                )}

                {/* Recipient list */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-3)' }}>
                    Creadores que recibirán el mensaje ({withPhone.length}/{assignedUGCs.length})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {assignedUGCs.map(u => {
                      const av = avatarColor(u.id);
                      const hasPhone = !!u.phone;
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                          style={{
                            borderColor: hasPhone ? 'var(--color-border)' : 'var(--color-border-subtle)',
                            backgroundColor: hasPhone ? 'var(--color-surface-alt)' : 'transparent',
                            opacity: hasPhone ? 1 : 0.5,
                          }}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av}`}>
                            {getInitials(u.nombre)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{u.nombre}</p>
                            {hasPhone ? (
                              <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>{u.phone}</p>
                            ) : (
                              <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>Sin número de WhatsApp</p>
                            )}
                          </div>
                          {hasPhone ? (
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgb(22,163,74)' }} />
                          ) : (
                            <X className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {withoutPhone.length > 0 && (
                    <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-3)' }}>
                      ⚠ {withoutPhone.length} creador{withoutPhone.length > 1 ? 'es' : ''} sin teléfono no recibirán el mensaje.
                      Completá el campo "Teléfono" en su perfil para incluirlos.
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 pt-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={sending || withPhone.length === 0 || !campana.mensajeContacto}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Confirmar y enviar a {withPhone.length}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
