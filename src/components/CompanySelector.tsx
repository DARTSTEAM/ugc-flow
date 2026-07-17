import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';

/** Selector de empresa en el nav lateral: filtra UGCs/Campañas/Chats/Recomendaciones a la marca elegida. No afecta la vista "Grupo NGR". */
export default function CompanySelector() {
  const { brands, selectedBrandId, setSelectedBrandId } = useCompany();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = brands.find(b => b.id === selectedBrandId);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-semibold transition-colors duration-150"
        style={{ backgroundColor: open ? 'var(--color-surface-alt)' : 'transparent', color: 'var(--color-text-1)' }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
      >
        <span className="flex-1 text-left truncate">{current?.nombre || 'Elegir empresa'}</span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden popover-enter z-20"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="p-1.5">
            {brands.map(b => {
              const isSelected = b.id === selectedBrandId;
              return (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBrandId(b.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
                  style={isSelected ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' } : { color: 'var(--color-text-2)' }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  <span className="flex-1 text-left truncate">{b.nombre}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
