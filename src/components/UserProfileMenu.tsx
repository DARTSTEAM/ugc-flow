import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Sun, Moon, HelpCircle, Bell, BellOff, LogOut, X, User } from 'lucide-react';
import type { UserProfile } from '../data';
import { getInitials } from '../utils';

interface Props {
  dark: boolean;
  setDark: (updater: (d: boolean) => boolean) => void;
  profile: UserProfile;
  onOpenProfile: () => void;
  active: boolean;
  /** 'sidebar' (default): full name/area row, popover opens upward. 'header': avatar-only icon, popover opens downward. */
  variant?: 'sidebar' | 'header';
}

type InfoKey = 'ayuda' | null;

const menuItemBase: React.CSSProperties = { color: 'var(--color-text-2)' };

function hoverIn(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)';
}
function hoverOut(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.backgroundColor = '';
}

export default function UserProfileMenu({ dark, setDark, profile, onOpenProfile, active, variant = 'sidebar' }: Props) {
  const [open, setOpen] = useState(false);
  const [activeInfo, setActiveInfo] = useState<InfoKey>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click/tap-driven (not hover): hover has no equivalent on touch devices,
  // so the whole menu was unreachable on mobile before this fix.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setActiveInfo(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <>
      <div ref={containerRef} className="relative">
        {open && (
          <div
            className={
              variant === 'header'
                ? 'absolute top-full right-0 mt-2 w-60 rounded-2xl border overflow-hidden popover-enter z-20'
                : 'absolute bottom-full left-0 right-0 mb-2 rounded-2xl border overflow-hidden popover-enter'
            }
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="p-1.5">
              {/* Perfil */}
              <button
                onClick={() => { onOpenProfile(); setOpen(false); setActiveInfo(null); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={menuItemBase}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">Perfil</span>
              </button>

              {/* Aspecto: light/dark switch */}
              <button
                onClick={() => setDark(d => !d)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={menuItemBase}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                {dark ? <Moon className="w-3.5 h-3.5 flex-shrink-0" /> : <Sun className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="flex-1 text-left">Aspecto</span>
                <span
                  className="relative w-8 h-[18px] rounded-full flex-shrink-0 transition-colors duration-200"
                  style={{ backgroundColor: dark ? 'var(--color-brand)' : 'var(--color-border)' }}
                >
                  <span
                    className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: dark ? 'calc(100% - 16px)' : '2px' }}
                  />
                </span>
              </button>

              {/* Ayuda */}
              <button
                onClick={() => setActiveInfo(v => (v === 'ayuda' ? null : 'ayuda'))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={menuItemBase}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">Ayuda</span>
              </button>
              {activeInfo === 'ayuda' && (
                <div
                  className="mx-1 mb-1.5 px-2.5 py-2 rounded-lg text-[10.5px] leading-snug popover-enter"
                  style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}
                >
                  Próximamente habrá un tutorial — Estamos trabajando en ello.
                </div>
              )}

              {/* Notificaciones */}
              <button
                onClick={() => { setShowNotifications(true); setOpen(false); setActiveInfo(null); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={menuItemBase}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">Notificaciones</span>
              </button>

              <div className="h-px my-1 mx-1" style={{ backgroundColor: 'var(--color-border-subtle)' }} />

              {/* Cerrar sesión */}
              <button
                onClick={() => { setShowLogout(true); setOpen(false); setActiveInfo(null); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150"
                style={{ color: '#dc2626' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(220,38,38,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}

        {/* Trigger */}
        {variant === 'header' ? (
          <div
            onClick={() => setOpen(o => !o)}
            aria-label="Perfil"
            title={profile.nombre}
            className="w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.92]"
            style={active
              ? { backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }
              : { backgroundColor: open ? 'var(--color-surface-alt)' : '' }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = open ? 'var(--color-surface-alt)' : ''; }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-muted) 100%)' }}
            >
              {profile.fotoUrl
                ? <img src={profile.fotoUrl} alt={profile.nombre} className="w-full h-full object-cover" />
                : getInitials(profile.nombre || 'B')}
            </div>
          </div>
        ) : (
          <div
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-all duration-200"
            style={active
              ? { backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }
              : { backgroundColor: open ? 'var(--color-surface-alt)' : '' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-muted) 100%)' }}
            >
              {profile.fotoUrl
                ? <img src={profile.fotoUrl} alt={profile.nombre} className="w-full h-full object-cover" />
                : getInitials(profile.nombre || 'B')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: active ? '#fff' : 'var(--color-text-1)' }}>{profile.nombre}</p>
              <p className="text-[10px] truncate" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--color-text-3)' }}>{profile.area}</p>
            </div>
            <ChevronRight
              className="w-3 h-3 transition-transform duration-200"
              style={{ color: active ? '#fff' : 'var(--color-text-3)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </div>
        )}
      </div>

      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </>
  );
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="rounded-2xl border w-full max-w-sm pointer-events-auto modal-enter"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                <Bell className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              </div>
              <h2 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Notificaciones</h2>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-200 -mr-2"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
              <BellOff className="w-5 h-5" style={{ color: 'var(--color-text-3)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>No hay nuevas notificaciones</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function LogoutModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="rounded-2xl border w-full max-w-sm pointer-events-auto modal-enter"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}>
                <LogOut className="w-4 h-4" style={{ color: '#dc2626' }} />
              </div>
              <h2 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Cerrar Sesión</h2>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-200 -mr-2"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.08)' }}>
              <LogOut className="w-5 h-5" style={{ color: '#dc2626' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>Estamos trabajando en un sistema de autenticación.</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
