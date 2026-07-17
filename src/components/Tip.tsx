import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Tooltip on hover, rendered via portal so it never gets clipped by a scrolling/overflow ancestor. */
export default function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setVisible(true);
  };
  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} className="inline-flex items-center">
        {children}
      </span>
      {visible && createPortal(
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)',
          zIndex: 9999, width: '14rem', padding: '7px 10px', borderRadius: '8px',
          fontSize: '10px', lineHeight: '1.55', pointerEvents: 'none',
          backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)',
          border: '1px solid var(--color-border)', boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
