import { useState } from 'react';
import { X, Sparkles, Hash } from 'lucide-react';
import instagramLogo from '../assets/instagram-logo.png';
import tiktokLogo from '../assets/tiktok-logo.png';
import youtubeLogo from '../assets/youtube-logo.png';

type Plataforma = 'Instagram' | 'TikTok' | 'YouTube';

const NICHOS_DISPONIBLES = [
  'Gastronomía', 'Lifestyle', 'Moda', 'Belleza', 'Skincare',
  'Fitness', 'Wellness', 'Nutrición', 'Tecnología', 'Reviews',
  'Viajes', 'Deportes', 'Música', 'Entretenimiento', 'Gaming',
  'DIY', 'Hogar', 'Educación', 'Negocios', 'Arte',
];

const PLATAFORMA_CFG: Record<Plataforma, { logo: string; activeText: string; activeBg: string; activeBorder: string }> = {
  Instagram: { logo: instagramLogo, activeText: '#7c3aed', activeBg: 'rgba(124,58,237,0.07)', activeBorder: '#c4b5fd' },
  TikTok:    { logo: tiktokLogo,    activeText: 'var(--color-text-1)', activeBg: 'rgba(0,0,0,0.05)', activeBorder: 'var(--color-border)' },
  YouTube:   { logo: youtubeLogo,   activeText: '#dc2626', activeBg: 'rgba(220,38,38,0.06)', activeBorder: '#fca5a5' },
};

function inputStyle(focused: boolean) {
  return {
    backgroundColor: 'var(--color-surface)',
    borderColor: focused ? 'var(--color-brand)' : 'var(--color-border-subtle)',
    boxShadow: focused ? '0 0 0 3px rgba(252,154,0,0.12)' : 'none',
    color: 'var(--color-text-1)',
  };
}

interface Props {
  onClose: () => void;
}

export default function NuevaBusquedaModal({ onClose }: Props) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [nichos, setNichos] = useState<string[]>([]);
  const [segMin, setSegMin] = useState('5000');
  const [segMax, setSegMax] = useState('100000');
  const [engagement, setEngagement] = useState('3');
  const [ubicacion, setUbicacion] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);

  // Focus state for each input
  const [focused, setFocused] = useState<Record<string, boolean>>({});
  const onFocus = (k: string) => setFocused(p => ({ ...p, [k]: true }));
  const onBlur  = (k: string) => setFocused(p => ({ ...p, [k]: false }));

  function togglePlataforma(p: Plataforma) {
    setPlataformas(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleNicho(n: string) {
    setNichos(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }
  function addHashtag() {
    const tag = hashInput.trim().replace(/\s+/g, '');
    if (!tag) return;
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    if (!hashtags.includes(formatted)) setHashtags(prev => [...prev, formatted]);
    setHashInput('');
  }

  const sectionLabel = (text: string) => (
    <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-3)' }}>
      {text}
    </p>
  );

  const divider = () => (
    <div className="h-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
  );

  const fieldLabel = (text: string, optional?: boolean) => (
    <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--color-text-2)' }}>
      {text} {optional && <span style={{ color: 'var(--color-text-3)' }}>(opcional)</span>}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden modal-enter"
        style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-modal)' }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--color-text-1)' }}>
              Nueva búsqueda
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
              Configurá los parámetros para encontrar creadores ideales
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.92]"
            style={{ color: 'var(--color-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-alt)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* 1 – Identificación */}
          <section>
            {sectionLabel('Identificación')}
            <div className="space-y-3">
              <div>
                {fieldLabel('Nombre de la búsqueda *')}
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onFocus={() => onFocus('nombre')}
                  onBlur={() => onBlur('nombre')}
                  placeholder="Ej: Foodie CABA Verano 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                  style={inputStyle(focused.nombre)}
                />
              </div>
              <div>
                {fieldLabel('Descripción', true)}
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  onFocus={() => onFocus('desc')}
                  onBlur={() => onBlur('desc')}
                  placeholder="Describí el objetivo de esta búsqueda..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200 resize-none"
                  style={inputStyle(focused.desc)}
                />
              </div>
            </div>
          </section>

          {divider()}

          {/* 2 – Plataformas */}
          <section>
            {sectionLabel('Plataformas')}
            <div className="grid grid-cols-3 gap-3">
              {(['Instagram', 'TikTok', 'YouTube'] as Plataforma[]).map(p => {
                const cfg = PLATAFORMA_CFG[p];
                const active = plataformas.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlataforma(p)}
                    className="flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 transition-all duration-200 active:scale-[0.97]"
                    style={{
                      backgroundColor: active ? cfg.activeBg : 'var(--color-surface-alt)',
                      borderColor: active ? cfg.activeBorder : 'var(--color-border-subtle)',
                    }}
                  >
                    <img src={cfg.logo} alt={p} className="w-10 h-10 object-contain" />
                    <span className="text-xs font-bold" style={{ color: active ? cfg.activeText : 'var(--color-text-2)' }}>
                      {p}
                    </span>
                    {active && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: cfg.activeBorder, color: cfg.activeText }}
                      >
                        ✓ Seleccionado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {divider()}

          {/* 3 – Nichos */}
          <section>
            {sectionLabel('Nichos / Categorías')}
            <div className="flex flex-wrap gap-2">
              {NICHOS_DISPONIBLES.map(n => {
                const active = nichos.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleNicho(n)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-[0.96]"
                    style={active ? {
                      backgroundColor: 'var(--color-brand)',
                      color: '#fff',
                      borderColor: 'var(--color-brand)',
                    } : {
                      backgroundColor: 'var(--color-surface-alt)',
                      color: 'var(--color-text-2)',
                      borderColor: 'var(--color-border-subtle)',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </section>

          {divider()}

          {/* 4 – Audiencia */}
          <section>
            {sectionLabel('Audiencia')}
            <div className="space-y-3">
              {/* Followers range */}
              <div>
                {fieldLabel('Rango de seguidores')}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-3)' }}>Mínimo</p>
                    <input
                      type="number"
                      value={segMin}
                      onChange={e => setSegMin(e.target.value)}
                      onFocus={() => onFocus('segMin')}
                      onBlur={() => onBlur('segMin')}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                      style={inputStyle(focused.segMin)}
                    />
                  </div>
                  <span className="text-base font-bold mt-4" style={{ color: 'var(--color-text-3)' }}>—</span>
                  <div className="flex-1">
                    <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-3)' }}>Máximo</p>
                    <input
                      type="number"
                      value={segMax}
                      onChange={e => setSegMax(e.target.value)}
                      onFocus={() => onFocus('segMax')}
                      onBlur={() => onBlur('segMax')}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                      style={inputStyle(focused.segMax)}
                    />
                  </div>
                </div>
              </div>
              {/* Engagement + Idioma */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {fieldLabel('Engagement mínimo')}
                  <div className="relative">
                    <input
                      type="number"
                      value={engagement}
                      onChange={e => setEngagement(e.target.value)}
                      onFocus={() => onFocus('eng')}
                      onBlur={() => onBlur('eng')}
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                      style={inputStyle(focused.eng)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-text-3)' }}>%</span>
                  </div>
                </div>
                <div>
                  {fieldLabel('Idioma del contenido')}
                  <select
                    onFocus={() => onFocus('lang')}
                    onBlur={() => onBlur('lang')}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
                    style={inputStyle(focused.lang)}
                  >
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                    <option value="pt">Portugués</option>
                    <option value="any">Cualquier idioma</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {divider()}

          {/* 5 – Ubicación */}
          <section>
            {sectionLabel('Ubicación')}
            <input
              type="text"
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              onFocus={() => onFocus('loc')}
              onBlur={() => onBlur('loc')}
              placeholder="Ej: Buenos Aires, Argentina / Latinoamérica / Global"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all duration-200"
              style={inputStyle(focused.loc)}
            />
          </section>

          {divider()}

          {/* 6 – Hashtags */}
          <section>
            {sectionLabel('Hashtags y palabras clave')}
            <p className="text-[11px] -mt-1 mb-3" style={{ color: 'var(--color-text-3)' }}>
              Presioná Enter o coma para agregar
            </p>
            <div
              className="flex flex-wrap gap-2 p-3 rounded-xl border min-h-[48px]"
              style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border-subtle)' }}
            >
              {hashtags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  <Hash className="w-3 h-3" />
                  {tag.replace('#', '')}
                  <button
                    onClick={() => setHashtags(prev => prev.filter(t => t !== tag))}
                    className="ml-0.5 transition-opacity hover:opacity-60"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={hashInput}
                onChange={e => setHashInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addHashtag(); }
                }}
                placeholder={hashtags.length === 0 ? '#foodie, #bsas, #verano...' : 'Agregar más...'}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-xs"
                style={{ color: 'var(--color-text-1)' }}
              />
            </div>
          </section>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {plataformas.length} plataforma{plataformas.length !== 1 ? 's' : ''} · {nichos.length} nicho{nichos.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-alt)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface)')}
            >
              Cancelar
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-brand)')}
            >
              <Sparkles className="w-4 h-4" />
              Iniciar búsqueda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
