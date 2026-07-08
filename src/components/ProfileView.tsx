import { useEffect, useRef, useState } from 'react';
import { User, Camera, Loader2, Check } from 'lucide-react';
import type { UserProfile } from '../data';
import { fetchProfile, updateProfile } from '../api';
import { getInitials } from '../utils';

interface Props {
  onSaved: (profile: UserProfile) => void;
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB, generoso para un avatar

const inputBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-1)',
};

function focusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--color-brand)';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)';
}
function blurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--color-border)';
  e.currentTarget.style.boxShadow = '';
}

export default function ProfileView({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [email, setEmail] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then(p => {
        if (cancelled) return;
        setNombre(p.nombre || '');
        setArea(p.area || '');
        setEmail(p.email || '');
        setFotoUrl(p.fotoUrl);
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Error al cargar el perfil'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError('La imagen no puede pesar más de 3MB.'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setFotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    setError('');
    setSaving(true);
    try {
      await updateProfile({ nombre: nombre.trim(), area: area.trim(), email: email.trim() || null, fotoUrl });
      onSaved({ id: 'user-001', nombre: nombre.trim(), area: area.trim(), email: email.trim() || null, fotoUrl });
      setSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-3)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-base font-black" style={{ color: 'var(--color-text-1)' }}>Mi Perfil</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Información básica de tu cuenta</p>
      </div>

      <div
        className="rounded-2xl border p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold text-white overflow-hidden group flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-muted) 100%)' }}
            title="Cambiar foto"
          >
            {fotoUrl
              ? <img src={fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              : (nombre ? getInitials(nombre) : <User className="w-8 h-8" />)}
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-200 opacity-0 group-hover:opacity-100">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold transition-colors duration-200"
            style={{ color: 'var(--color-brand)' }}
          >
            Cambiar foto
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>Nombre</label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre"
            className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
            style={inputBase}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>Área</label>
          <input
            value={area}
            onChange={e => setArea(e.target.value)}
            placeholder="ej: Marketing"
            className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
            style={inputBase}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200"
            style={inputBase}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        {error && (
          <p className="text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar cambios
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-semibold popover-enter" style={{ color: '#059669' }}>
              <Check className="w-3.5 h-3.5" /> Cambios guardados
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
