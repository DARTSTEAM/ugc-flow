import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ open, itemName, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none p-4">
        <div
          className="rounded-2xl w-full max-w-sm pointer-events-auto modal-enter border"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#fff1f2' }}>
              <Trash2 className="w-6 h-6" style={{ color: '#e11d48' }} />
            </div>
            <div>
              <h3 className="text-base font-black mb-1.5" style={{ color: 'var(--color-text-1)' }}>
                ¿Estás seguro?
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                ¿Querés eliminar{' '}
                <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>
                  {itemName}
                </span>
                ? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 border rounded-xl font-semibold text-sm transition-all duration-200"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.97]"
                style={{ backgroundColor: '#e11d48', boxShadow: '0 1px 3px rgba(225,29,72,0.25)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#be123c'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#e11d48'}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
