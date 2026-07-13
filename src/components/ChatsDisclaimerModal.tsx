import { Instagram, Sparkles, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onTestAgent: () => void;
}

export default function ChatsDisclaimerModal({ onClose, onTestAgent }: Props) {
  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(9,10,15,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="w-full max-w-md pointer-events-auto rounded-2xl border modal-enter"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(147,51,234,0.1)' }}>
              <Instagram className="w-5 h-5" style={{ color: '#9333ea' }} />
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 -mt-1 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Vista en modo simulación</h2>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                Esta vista todavía no es funcional porque la credencial de Instagram no está conectada. Mientras tanto, podés ver cómo se verían los chats y navegar la vista con datos simulados.
              </p>
            </div>

            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border" style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)' }}>
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-1)' }}>
                Mientras esperás la conexión, probá el <strong>Agente</strong> para ver cómo respondería automáticamente a tus creadores.
              </p>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={onClose}
                className="px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
              >
                Entendido
              </button>
              <button
                onClick={onTestAgent}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.97]"
                style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              >
                Probar el Agente
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
