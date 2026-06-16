import { useState, useEffect } from 'react';
import {
  X, MessageCircle, TrendingUp, Award, ChevronRight, Send,
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, BarChart2, Tv2, Pencil,
  ChevronDown, Plus,
} from 'lucide-react';
import type { UGC, Campana, EvaluacionOrganica, EvaluacionPauta } from '../data';
import { scoreColor, ESTADO_UGC_CONFIG, getInitials, avatarColor, needsInfoUpdate, formatLastScraped } from '../utils';
import { fetchCreatorDetail, updateCreator, updateEvaluacionOrganica, updateEvaluacionPauta, scrapeCreator } from '../api';

type DrawerTab = 'Perfil' | 'Contenido Orgánico' | 'Pauta';

interface Props {
  ugc: UGC;
  campanas: Campana[];
  initialTab?: DrawerTab;
  onClose: () => void;
  onAvanzar: (ugc: UGC) => void;
  onDescartar: (ugc: UGC) => void;
  onAsignar: (ugc: UGC, campanaId: string) => void;
  onUpdateUGC: (ugc: UGC) => void;
  onGoToChat: (ugc: UGC) => void;
}

const ESTADO_ORDER = ['Nuevo', 'Contactado', 'Respondió', 'Calificado', 'Descartado'] as const;

function estadoCampanaStyle(estado: string): React.CSSProperties {
  switch (estado) {
    case 'Activa':   return { backgroundColor: 'rgba(34,197,94,0.1)',  color: 'rgb(22,163,74)',  border: '1px solid rgba(34,197,94,0.2)' };
    case 'Borrador': return { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' };
    case 'Pausada':  return { backgroundColor: 'rgba(252,154,0,0.1)', color: 'rgb(180,83,9)',   border: '1px solid rgba(252,154,0,0.2)' };
    case 'Cerrada':  return { backgroundColor: 'rgba(239,68,68,0.06)', color: 'rgb(185,28,28)', border: '1px solid rgba(239,68,68,0.15)' };
    default:         return {};
  }
}

// ─── Reusable form field ─────────────────────────────────────────────────────
function FormField({
  label, value, onChange, type = 'number', placeholder, unit, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; unit?: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
        {label}{unit && <span className="ml-1 normal-case font-normal opacity-60">({unit})</span>}
      </label>
      {hint && <p className="text-[10px] italic" style={{ color: 'var(--color-text-3)' }}>{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        step={type === 'number' ? 'any' : undefined}
        className="px-3 py-2 rounded-xl border text-sm focus:outline-none transition-all"
        style={{
          backgroundColor: 'var(--color-surface-alt)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-1)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
      />
    </div>
  );
}

// ─── Read-only metric row ────────────────────────────────────────────────────
function MetricRow({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
        {value !== undefined && value !== null && value !== '' ? `${value}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function UGCDrawer({
  ugc: ugcProp, campanas, initialTab = 'Perfil',
  onClose, onAvanzar, onDescartar, onAsignar, onUpdateUGC, onGoToChat,
}: Props) {
  const [ugc, setUgc] = useState<UGC>(ugcProp);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);

  // Organic form state
  const [orgViews, setOrgViews] = useState('');
  const [orgShares, setOrgShares] = useState('');
  const [orgER, setOrgER] = useState('');
  const [orgHook, setOrgHook] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgEditing, setOrgEditing] = useState(false);

  // Kernel scrape state
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);

  // Profile edit state
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  // Pauta form state
  const [pImpresiones, setPImpresiones] = useState('');
  const [pAlcance, setPAlcance] = useState('');
  const [pCPM, setPCPM] = useState('');
  const [pFrecuencia, setPFrecuencia] = useState('');
  const [pCTR, setPCTR] = useState('');
  const [pVTR, setPVTR] = useState('');
  const [pautaSaving, setPautaSaving] = useState(false);
  const [pautaEditing, setPautaEditing] = useState(false);

  // Accordions & dropdowns
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [calificacionOpen, setCalificacionOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      try {
        setLoadingDetail(true);
        const detail = await fetchCreatorDetail(ugcProp.id);
        if (!cancelled) {
          const merged = { ...ugcProp, ...detail };
          setUgc(merged);
          if (merged.evaluacionOrganica) {
            const o = merged.evaluacionOrganica;
            setOrgViews(o.views?.toString() ?? '');
            setOrgShares(o.shares?.toString() ?? '');
            setOrgER(o.engagementRate?.toString() ?? '');
            setOrgHook(o.hookNatural?.toString() ?? '');
          }
          if (merged.evaluacionPauta) {
            const p = merged.evaluacionPauta;
            setPImpresiones(p.impresiones?.toString() ?? '');
            setPAlcance(p.alcance?.toString() ?? '');
            setPCPM(p.cpm?.toString() ?? '');
            setPFrecuencia(p.frecuencia?.toString() ?? '');
            setPCTR(p.ctr?.toString() ?? '');
            setPVTR(p.vtr?.toString() ?? '');
          }
        }
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

  const missingOrganica = !ugc.evaluacionOrganica?.completado;
  const missingPauta = !ugc.evaluacionPauta?.completado;

  const followersDisplay = ugc.evaluacionPerfil?.seguidores
    ? ugc.evaluacionPerfil.seguidores.toLocaleString('es-AR')
    : ugc.seguidores || null;

  // Campaigns this UGC belongs to (from campaigns' ugcs list)
  const assignedCampaigns = campanas.filter(c => c.ugcs.some(u => u.ugcId === ugc.id));
  // Campaigns available to add (not closed, not already assigned)
  const availableToAssign = campanas.filter(c =>
    c.estado !== 'Cerrada' && !c.ugcs.some(u => u.ugcId === ugc.id)
  );

  function startProfileEditing() {
    setEditNombre(ugc.nombre);
    setEditUsername(ugc.username ?? '');
    setEditBio(ugc.bio ?? '');
    setProfileEditing(true);
  }

  // ── Save handlers ────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    setProfileSaving(true);
    try {
      const updated: UGC = {
        ...ugc,
        nombre: editNombre.trim() || ugc.nombre,
        username: editUsername.trim() || undefined,
        bio: editBio.trim() || undefined,
        canal: ugc.canal,
      };
      await updateCreator(updated);
      setUgc(updated);
      onUpdateUGC(updated);
      setProfileEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveOrganica() {
    setOrgSaving(true);
    try {
      const data: Omit<EvaluacionOrganica, 'completado'> = {
        views: orgViews ? parseFloat(orgViews) : undefined,
        shares: orgShares ? parseFloat(orgShares) : undefined,
        engagementRate: orgER ? parseFloat(orgER) : undefined,
        hookNatural: orgHook ? parseFloat(orgHook) : undefined,
      };
      await updateEvaluacionOrganica(ugc.id, data);
      const updated: UGC = {
        ...ugc,
        evaluacionOrganica: { ...data, completado: true },
      };
      setUgc(updated);
      onUpdateUGC(updated);
      setOrgEditing(false);
    } catch (err) {
      console.error('Error saving evaluación orgánica:', err);
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleSavePauta() {
    setPautaSaving(true);
    try {
      const data: Omit<EvaluacionPauta, 'completado'> = {
        impresiones: pImpresiones ? parseFloat(pImpresiones) : undefined,
        alcance: pAlcance ? parseFloat(pAlcance) : undefined,
        cpm: pCPM ? parseFloat(pCPM) : undefined,
        frecuencia: pFrecuencia ? parseFloat(pFrecuencia) : undefined,
        ctr: pCTR ? parseFloat(pCTR) : undefined,
        vtr: pVTR ? parseFloat(pVTR) : undefined,
      };
      await updateEvaluacionPauta(ugc.id, data);
      const updated: UGC = {
        ...ugc,
        evaluacionPauta: { ...data, completado: true },
      };
      setUgc(updated);
      onUpdateUGC(updated);
      setPautaEditing(false);
    } catch (err) {
      console.error('Error saving evaluación pauta:', err);
    } finally {
      setPautaSaving(false);
    }
  }

  async function handleScrape() {
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeSuccess(false);
    try {
      const result = await scrapeCreator(ugc.id);
      if (!result.ok || !result.evaluacionPerfil) {
        setScrapeError('No se pudo obtener datos del perfil.');
        return;
      }
      const updated: UGC = { ...ugc, evaluacionPerfil: result.evaluacionPerfil };
      setUgc(updated);
      onUpdateUGC(updated);
      setScrapeSuccess(true);
      setTimeout(() => setScrapeSuccess(false), 3000);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setScrapeLoading(false);
    }
  }

  // ── Tab button ───────────────────────────────────────────────────────────

  function TabBtn({ tab, icon: Icon, hasDot }: { tab: DrawerTab; icon: React.ElementType; hasDot?: boolean }) {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-200 relative flex-1 justify-center"
        style={isActive ? {
          backgroundColor: 'var(--color-brand)',
          color: '#fff',
        } : {
          backgroundColor: 'var(--color-surface-alt)',
          color: 'var(--color-text-2)',
        }}
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="hidden sm:block truncate">{tab}</span>
        {hasDot && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"
            title="Información pendiente"
          />
        )}
      </button>
    );
  }

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
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm ${av}`}>
                {getInitials(ugc.nombre)}
              </div>

              {profileEditing ? (
                /* ── Edit mode ── */
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-2.5 py-1.5 rounded-lg border text-sm font-semibold focus:outline-none transition-all"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>@</span>
                    <input
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value.replace(/^@/, ''))}
                      placeholder="handle_de_instagram"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border text-sm font-mono focus:outline-none transition-all"
                      style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Descripción</label>
                    <textarea
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      placeholder="Notas internas sobre este UGC..."
                      rows={3}
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none transition-all resize-none"
                      style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    />
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => setProfileEditing(false)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                      style={{ backgroundColor: 'var(--color-brand)' }}
                    >
                      {profileSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display mode ── */
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</h2>
                    <button
                      onClick={startProfileEditing}
                      title="Editar perfil"
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-200"
                      style={{ color: 'var(--color-text-3)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  {(ugc.username || followersDisplay) && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {ugc.username && (
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-2)' }}>@{ugc.username}</span>
                      )}
                      {followersDisplay && (
                        <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                          {ugc.username && '· '}{followersDisplay} seguidores
                        </span>
                      )}
                    </div>
                  )}
                  {ugc.bio && (
                    <p className="text-sm mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-3)' }}>{ugc.bio}</p>
                  )}
                </div>
              )}
            </div>

            {/* Header actions: Ir al chat + Close */}
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              <button
                onClick={() => onGoToChat(ugc)}
                title="Ir al chat con este UGC"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-2)'; }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Chat</span>
              </button>
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
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${estadoConfig.className}`}>
              {estadoConfig.label}
            </span>
            {needsInfoUpdate(ugc) && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border"
                style={{ backgroundColor: 'rgba(252,154,0,0.08)', borderColor: 'rgba(252,154,0,0.25)', color: 'var(--color-brand)' }}>
                <AlertTriangle className="w-3 h-3" />
                Actualizar información
              </span>
            )}
          </div>

          {/* Score — clickable, expands breakdown */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <button
              onClick={() => ugc.scoreBreakdown?.length && setScoreBreakdownOpen(o => !o)}
              className="w-full p-3 text-left"
              style={{ cursor: ugc.scoreBreakdown?.length ? 'pointer' : 'default' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>Score total</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono font-bold text-lg ${sc.text}`}>{ugc.score}</span>
                  {!!ugc.scoreBreakdown?.length && (
                    <ChevronDown
                      className="w-3.5 h-3.5 transition-transform duration-300"
                      style={{
                        color: 'var(--color-text-3)',
                        transform: scoreBreakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className={`h-full ${sc.bar} rounded-full transition-all duration-700`}
                  style={{ width: `${ugc.score}%` }}
                />
              </div>
            </button>

            {/* Animated breakdown */}
            <div
              style={{
                maxHeight: scoreBreakdownOpen ? '320px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.32s ease-in-out',
              }}
            >
              <div className="px-3 pb-3 pt-1 space-y-2.5 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {(ugc.scoreBreakdown || []).map((s, i) => (
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
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 py-2.5 border-b flex gap-1.5 flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}>
          <TabBtn tab="Perfil" icon={TrendingUp} />
          <TabBtn tab="Contenido Orgánico" icon={Tv2} hasDot={missingOrganica} />
          <TabBtn tab="Pauta" icon={BarChart2} hasDot={missingPauta} />
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
              {/* ── TAB: PERFIL ──────────────────────────────────────────── */}
              {activeTab === 'Perfil' && (
                <>
                  {/* ── KERNEL DATA section ── */}
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
                          Datos del perfil
                        </h3>
                        {ugc.evaluacionPerfil && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                            style={{ backgroundColor: 'rgba(20,184,166,0.1)', color: 'rgb(13,148,136)', border: '1px solid rgba(20,184,166,0.2)' }}
                          >
                            Actualizado {formatLastScraped(ugc.evaluacionPerfil.lastScrapedAt)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleScrape}
                        disabled={scrapeLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{
                          borderColor: scrapeSuccess ? 'rgba(34,197,94,0.4)' : 'var(--color-border)',
                          backgroundColor: scrapeSuccess ? 'rgba(34,197,94,0.08)' : 'var(--color-surface-alt)',
                          color: scrapeSuccess ? 'rgb(22,163,74)' : 'var(--color-text-2)',
                        }}
                      >
                        {scrapeLoading
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Evaluando...</>
                          : scrapeSuccess
                            ? <><CheckCircle2 className="w-3 h-3" />Actualizado</>
                            : <><RefreshCw className="w-3 h-3" />Evaluar ahora</>
                        }
                      </button>
                    </div>
                    {scrapeError && (
                      <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border"
                        style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                        <p className="text-[11px] text-rose-600">{scrapeError}</p>
                      </div>
                    )}
                    {ugc.evaluacionPerfil ? (
                      <>
                        <div className="rounded-xl p-3 border" style={{ backgroundColor: 'rgba(20,184,166,0.03)', borderColor: 'rgba(20,184,166,0.15)' }}>
                          <MetricRow label="Handle" value={ugc.evaluacionPerfil.perfil} />
                          <MetricRow label="Seguidores" value={ugc.evaluacionPerfil.seguidores.toLocaleString('es-AR')} />
                          <MetricRow label="Engagement Rate Cuenta" value={ugc.evaluacionPerfil.engagementRateCuenta} unit="%" />
                          <MetricRow label="Promedio vistas (últimos 5 videos)" value={ugc.evaluacionPerfil.promedioVistaVideos?.toLocaleString('es-AR')} />
                          <MetricRow label="Categoría" value={ugc.evaluacionPerfil.categoria} />
                          <MetricRow label="Rango de edad seguidores" value={ugc.evaluacionPerfil.rangoEdadSeguidores} />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                        style={{ backgroundColor: 'rgba(20,184,166,0.04)', borderColor: 'rgba(20,184,166,0.15)' }}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(13,148,136)' }} />
                        <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                          Sin datos de Kernel — presioná "Evaluar ahora" para analizar el perfil.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── AI: Respuestas de Calificación (collapsible) ── */}
                  {ugc.calificacion && ugc.calificacion.length > 0 && (
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <button
                        onClick={() => setCalificacionOpen(!calificacionOpen)}
                        className="w-full flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0"
                            style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: 'rgb(109,40,217)', border: '1px solid rgba(139,92,246,0.2)' }}
                          >
                            IA
                          </span>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
                            Respuestas de Calificación
                          </h3>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}
                          >
                            {ugc.calificacion.length}
                          </span>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                          style={{
                            color: 'var(--color-text-3)',
                            transform: calificacionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>

                      <div
                        style={{
                          maxHeight: calificacionOpen ? '800px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.38s ease-in-out',
                        }}
                      >
                        <div className="mt-3 space-y-2.5">
                          {ugc.calificacion.map((q, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl border"
                              style={{ backgroundColor: 'rgba(139,92,246,0.03)', borderColor: 'rgba(139,92,246,0.12)' }}
                            >
                              <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'rgb(109,40,217)' }}>{q.pregunta}</p>
                              <p className="text-sm" style={{ color: 'var(--color-text-1)' }}>{q.respuesta}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Campañas asignadas ── */}
                  {ugc.estado !== 'Descartado' && (
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-3)' }}>
                          Campañas asignadas
                        </h3>
                        {availableToAssign.length > 0 && (
                          <div className="relative">
                            <button
                              onClick={() => setAssignMenuOpen(!assignMenuOpen)}
                              title="Agregar a campaña"
                              className="w-6 h-6 flex items-center justify-center rounded-lg border transition-all duration-200"
                              style={{
                                borderColor: assignMenuOpen ? 'var(--color-brand)' : 'var(--color-border)',
                                backgroundColor: assignMenuOpen ? 'var(--color-brand-light)' : 'var(--color-surface-alt)',
                                color: assignMenuOpen ? 'var(--color-brand)' : 'var(--color-text-2)',
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {assignMenuOpen && (
                              <>
                                {/* Close overlay */}
                                <div className="fixed inset-0 z-10" onClick={() => setAssignMenuOpen(false)} />
                                <div
                                  className="absolute right-0 top-8 z-20 min-w-[220px] rounded-xl border py-1 shadow-xl"
                                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                                >
                                  <p className="text-[10px] font-black uppercase tracking-wider px-3 py-2" style={{ color: 'var(--color-text-3)' }}>
                                    Agregar a campaña
                                  </p>
                                  {availableToAssign.map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => { onAsignar(ugc, c.id); setAssignMenuOpen(false); }}
                                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all duration-200"
                                      style={{ color: 'var(--color-text-1)' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                                    >
                                      <span className="font-medium truncate mr-2 text-left">{c.nombre}</span>
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                                        style={estadoCampanaStyle(c.estado)}
                                      >
                                        {c.estado}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {assignedCampaigns.length === 0 ? (
                        <div
                          className="py-4 text-center rounded-xl border"
                          style={{ borderColor: 'var(--color-border)', borderStyle: 'dashed' }}
                        >
                          <p className="text-xs italic" style={{ color: 'var(--color-text-3)' }}>No asignado a ninguna campaña</p>
                          {availableToAssign.length > 0 && (
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-3)' }}>
                              Usá el botón + para agregar
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {assignedCampaigns.map(c => {
                            const ugcInCamp = c.ugcs.find(u => u.ugcId === ugc.id);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-alt)' }}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-1)' }}>{c.nombre}</span>
                                  {ugcInCamp && (
                                    <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                                      Estado: {ugcInCamp.estado}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-md font-semibold flex-shrink-0 ml-2"
                                  style={estadoCampanaStyle(c.estado)}
                                >
                                  {c.estado}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── TAB: CONTENIDO ORGÁNICO ──────────────────────────────── */}
              {activeTab === 'Contenido Orgánico' && (
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Evaluación de Contenido Orgánico</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Cada variable pondera 25% del score orgánico</p>
                    </div>
                    {ugc.evaluacionOrganica?.completado && !orgEditing && (
                      <button
                        onClick={() => setOrgEditing(true)}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {ugc.evaluacionOrganica?.completado && !orgEditing ? (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-alt)' }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(22,163,74)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'rgb(22,163,74)' }}>Evaluación completa</span>
                      </div>
                      <div className="px-4 py-2">
                        <MetricRow label="Views promedio (25%)" value={ugc.evaluacionOrganica.views?.toLocaleString('es-AR')} />
                        <MetricRow label="Shares promedio (25%)" value={ugc.evaluacionOrganica.shares?.toLocaleString('es-AR')} />
                        <MetricRow label="Engagement Rate (25%)" value={ugc.evaluacionOrganica.engagementRate} unit="%" />
                        <MetricRow label="Hook Natural (25%)" value={ugc.evaluacionOrganica.hookNatural ? `${ugc.evaluacionOrganica.hookNatural}/10` : undefined} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {!ugc.evaluacionOrganica?.completado && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                          style={{ backgroundColor: 'rgba(252,154,0,0.06)', borderColor: 'rgba(252,154,0,0.2)' }}>
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                          <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                            Completá esta sección para poder calcular el score del creador.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Views promedio" unit="25%" value={orgViews} onChange={setOrgViews} placeholder="ej: 12500" />
                        <FormField label="Shares promedio" unit="25%" value={orgShares} onChange={setOrgShares} placeholder="ej: 340" />
                        <FormField label="Engagement Rate" unit="% · 25%" value={orgER} onChange={setOrgER} placeholder="ej: 4.2" />
                        <FormField
                          label="Hook Natural"
                          unit="1–10 · 25%"
                          value={orgHook}
                          onChange={v => {
                            const n = parseFloat(v);
                            if (v === '' || (n >= 1 && n <= 10)) setOrgHook(v);
                          }}
                          placeholder="ej: 8"
                          hint="Puntuación de la calidad del hook inicial del contenido"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        {orgEditing && (
                          <button
                            onClick={() => setOrgEditing(false)}
                            className="px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={handleSaveOrganica}
                          disabled={orgSaving}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-brand)' }}
                        >
                          {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Guardar evaluación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: PAUTA ───────────────────────────────────────────── */}
              {activeTab === 'Pauta' && (
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Evaluación de KPIs de Pauta</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Métricas de rendimiento en campañas pagadas</p>
                    </div>
                    {ugc.evaluacionPauta?.completado && !pautaEditing && (
                      <button
                        onClick={() => setPautaEditing(true)}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {ugc.evaluacionPauta?.completado && !pautaEditing ? (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-alt)' }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(22,163,74)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'rgb(22,163,74)' }}>Evaluación completa</span>
                      </div>
                      <div className="px-4 py-2">
                        <MetricRow label="Impresiones" value={ugc.evaluacionPauta.impresiones?.toLocaleString('es-AR')} />
                        <MetricRow label="Alcance" value={ugc.evaluacionPauta.alcance?.toLocaleString('es-AR')} />
                        <MetricRow label="CPM" value={ugc.evaluacionPauta.cpm} unit="$" />
                        <MetricRow label="Frecuencia" value={ugc.evaluacionPauta.frecuencia} />
                        <MetricRow label="CTR" value={ugc.evaluacionPauta.ctr} unit="%" />
                        <MetricRow label="VTR" value={ugc.evaluacionPauta.vtr} unit="%" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {!ugc.evaluacionPauta?.completado && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                          style={{ backgroundColor: 'rgba(252,154,0,0.06)', borderColor: 'rgba(252,154,0,0.2)' }}>
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                          <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                            Completá esta sección para poder calcular el score del creador.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Impresiones" value={pImpresiones} onChange={setPImpresiones} placeholder="ej: 45000" />
                        <FormField label="Alcance" value={pAlcance} onChange={setPAlcance} placeholder="ej: 38000" />
                        <FormField label="CPM" unit="$" value={pCPM} onChange={setPCPM} placeholder="ej: 2.5" />
                        <FormField label="Frecuencia" value={pFrecuencia} onChange={setPFrecuencia} placeholder="ej: 1.8" />
                        <FormField label="CTR" unit="%" value={pCTR} onChange={setPCTR} placeholder="ej: 3.2" />
                        <FormField label="VTR" unit="%" value={pVTR} onChange={setPVTR} placeholder="ej: 65" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        {pautaEditing && (
                          <button
                            onClick={() => setPautaEditing(false)}
                            className="px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={handleSavePauta}
                          disabled={pautaSaving}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-brand)' }}
                        >
                          {pautaSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Guardar evaluación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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
