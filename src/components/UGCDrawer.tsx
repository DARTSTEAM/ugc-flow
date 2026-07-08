import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, MessageCircle, TrendingUp, Award, ChevronRight,
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, BarChart2, Tv2, Pencil,
  ChevronDown, Plus, HelpCircle, Megaphone, Link2, ExternalLink,
} from 'lucide-react';
import type { UGC, Campana, EvaluacionOrganica, EvaluacionPauta, EstadoUGC, ContenidoCampana } from '../data';
import tiktokLogo from '../assets/tiktok-logo.png';
import instagramLogo from '../assets/instagram-logo.png';
import { scoreColor, ESTADO_UGC_CONFIG, getInitials, avatarColor, needsInfoUpdate, formatLastScraped } from '../utils';
import { fetchCreatorDetail, updateCreator, updateEtiquetas, updateEvaluacionOrganica, updateEvaluacionPauta, scrapeCreator, scrapeTikTokCreator, fetchCreatorContent, addCampaignContent, deleteCampaignContent } from '../api';

type DrawerTab = 'Perfil' | 'Contenido Orgánico' | 'Pauta' | 'Campañas';

interface Props {
  ugc: UGC;
  campanas: Campana[];
  initialTab?: DrawerTab;
  onClose: () => void;
  onAsignar: (ugc: UGC, campanaId: string) => void;
  onUpdateUGC: (ugc: UGC) => void;
  onGoToChat: (ugc: UGC) => void;
}

function estadoCampanaStyle(estado: string): React.CSSProperties {
  switch (estado) {
    case 'Activa':   return { backgroundColor: 'rgba(34,197,94,0.1)',  color: 'rgb(22,163,74)',  border: '1px solid rgba(34,197,94,0.2)' };
    case 'Borrador': return { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' };
    case 'Pausada':  return { backgroundColor: 'rgba(252,154,0,0.1)', color: 'rgb(180,83,9)',   border: '1px solid rgba(252,154,0,0.2)' };
    case 'Cerrada':  return { backgroundColor: 'rgba(239,68,68,0.06)', color: 'rgb(185,28,28)', border: '1px solid rgba(239,68,68,0.15)' };
    default:         return {};
  }
}

// ─── Score sub-metric helpers (mirror of server/score-calculator.js) ─────────

type SubScore = { pts: number; max: number; value: string | null };

function ssSeguidores(seg: number | null): SubScore {
  if (seg == null) return { pts: 0, max: 20, value: null };
  const pts = seg >= 100_000 ? 20 : seg >= 50_000 ? 15 : seg >= 20_000 ? 10 : seg >= 10_000 ? 5 : 0;
  return { pts, max: 20, value: seg >= 1_000_000 ? (seg / 1_000_000).toFixed(1) + 'M' : seg.toLocaleString('es-AR') };
}
function ssER(er: number | null): SubScore {
  if (er == null) return { pts: 0, max: 20, value: null };
  const pts = er >= 6 ? 20 : er >= 4 ? 17 : er >= 2 ? 13 : er >= 1 ? 8 : er > 0 ? 3 : 0;
  return { pts, max: 20, value: er.toFixed(2) + '%' };
}
function ssFreq(freq: number | null): SubScore {
  if (freq == null) return { pts: 0, max: 20, value: null };
  const pts = (freq >= 2 && freq <= 5) ? 20 : freq >= 1 ? 12 : freq > 0 ? 6 : 0;
  return { pts, max: 20, value: freq.toFixed(2) + '/sem' };
}
function ssVirales(count: number | null): SubScore {
  if (count == null) return { pts: 0, max: 15, value: null };
  const pts = count >= 3 ? 15 : count === 2 ? 10 : count === 1 ? 5 : 0;
  return { pts, max: 15, value: count + (count === 1 ? ' video' : ' videos') };
}
function ssCTR(ctr: number | null): SubScore {
  if (ctr == null) return { pts: 0, max: 5, value: null };
  const pts = ctr >= 2 ? 5 : ctr >= 1 ? 3 : ctr > 0 ? 1 : 0;
  return { pts, max: 5, value: ctr.toFixed(2) + '%' };
}
function ssVTR(vtr: number | null): SubScore {
  if (vtr == null) return { pts: 0, max: 5, value: null };
  const pts = vtr >= 40 ? 5 : vtr >= 20 ? 3 : vtr > 0 ? 1 : 0;
  return { pts, max: 5, value: vtr.toFixed(1) + '%' };
}
function ssCPM(cpm: number | null): SubScore {
  if (cpm == null) return { pts: 0, max: 5, value: null };
  const pts = cpm <= 3 ? 5 : cpm <= 5 ? 4 : cpm <= 10 ? 3 : cpm <= 20 ? 1 : 0;
  return { pts, max: 5, value: '$' + cpm.toFixed(2) };
}
function ssVistas(v: number | null): SubScore {
  if (v == null) return { pts: 0, max: 5, value: null };
  const pts = v >= 500_000 ? 5 : v >= 200_000 ? 4 : v >= 50_000 ? 3 : v >= 10_000 ? 1 : 0;
  return { pts, max: 5, value: v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : v.toLocaleString('es-AR') };
}
function ssERPauta(er: number | null): SubScore {
  if (er == null) return { pts: 0, max: 5, value: null };
  const pts = er >= 4 ? 5 : er >= 2 ? 3 : er >= 1 ? 1 : 0;
  return { pts, max: 5, value: er.toFixed(2) + '%' };
}

// ─── Reusable form field ─────────────────────────────────────────────────────
function FormField({
  label, value, onChange, type = 'number', placeholder, unit, hint, tooltip,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; unit?: string; hint?: string; tooltip?: string;
}) {
  const [tipVisible, setTipVisible] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const showTip = () => {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setTipPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setTipVisible(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
          {label}{unit && <span className="ml-1 normal-case font-normal opacity-60">({unit})</span>}
        </label>
        {tooltip && (
          <>
            <div ref={iconRef} onMouseEnter={showTip} onMouseLeave={() => setTipVisible(false)} className="flex items-center">
              <HelpCircle className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
            </div>
            {tipVisible && createPortal(
              <div style={{
                position: 'fixed',
                top: tipPos.top,
                left: tipPos.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999,
                width: '12rem',
                padding: '6px 9px',
                borderRadius: '8px',
                fontSize: '10px',
                lineHeight: '1.5',
                pointerEvents: 'none',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-2)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              }}>
                {tooltip}
              </div>,
              document.body
            )}
          </>
        )}
      </div>
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

// ─── Warning icon with hover tooltip (portal) ───────────────────────────────
function WarnTooltip({ message }: { message: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    setVisible(true);
  };

  return (
    <>
      <div ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} className="flex items-center">
        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
      </div>
      {visible && createPortal(
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '13rem',
          padding: '7px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          lineHeight: '1.5',
          pointerEvents: 'none',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-2)',
          border: '1px solid rgba(252,154,0,0.35)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        }}>
          {message}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Read-only metric row ────────────────────────────────────────────────────
function MetricRow({ label, value, unit, tooltip }: { label: string; value: string | number | null | undefined; unit?: string; tooltip?: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setVisible(true);
  };

  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>{label}</span>
        {tooltip && (
          <>
            <div ref={iconRef} onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
              <HelpCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
            </div>
            {visible && createPortal(
              <div style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999,
                width: '13rem',
                padding: '7px 10px',
                borderRadius: '8px',
                fontSize: '10px',
                lineHeight: '1.55',
                pointerEvents: 'none',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-2)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              }}>
                {tooltip}
              </div>,
              document.body
            )}
          </>
        )}
      </div>
      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
        {value !== undefined && value !== null && value !== '' ? `${value}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function UGCDrawer({
  ugc: ugcProp, campanas, initialTab = 'Perfil',
  onClose, onAsignar, onUpdateUGC, onGoToChat,
}: Props) {
  const [ugc, setUgc] = useState<UGC>(ugcProp);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadDetailError, setLoadDetailError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);

  // Organic form state
  const [orgViews, setOrgViews] = useState('');
  const [orgShares, setOrgShares] = useState('');
  const [orgER, setOrgER] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgEditing, setOrgEditing] = useState(false);
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);

  // Kernel scrape state — Instagram
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);

  // Kernel scrape state — TikTok
  const [tiktokScrapeLoading, setTiktokScrapeLoading] = useState(false);
  const [tiktokScrapeError, setTiktokScrapeError] = useState<string | null>(null);
  const [tiktokScrapeSuccess, setTiktokScrapeSuccess] = useState(false);

  // Profile edit state
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editUsernameTiktok, setEditUsernameTiktok] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [etiquetasLocales, setEtiquetasLocales] = useState<string[]>(ugcProp.etiquetas || []);
  const etiquetasModified = useRef(false);
  const [availableEtiquetas, setAvailableEtiquetas] = useState<string[]>([]);

  // Pauta form state
  const [pImpresiones, setPImpresiones] = useState('');
  const [pAlcance, setPAlcance] = useState('');
  const [pCPM, setPCPM] = useState('');
  const [pFrecuencia, setPFrecuencia] = useState('');
  const [pCTR, setPCTR] = useState('');
  const [pVTR, setPVTR] = useState('');
  const [pVistas, setPVistas] = useState('');
  const [pER, setPER] = useState('');
  const [pautaSaving, setPautaSaving] = useState(false);
  const [pautaEditing, setPautaEditing] = useState(false);
  const [pautaSaveError, setPautaSaveError] = useState<string | null>(null);

  // Accordions & dropdowns
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [calificacionOpen, setCalificacionOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);

  // Contenido de campaña (posteos del creador, por campaña)
  const [creatorContent, setCreatorContent] = useState<ContenidoCampana[]>([]);
  const [contentUrlInputs, setContentUrlInputs] = useState<Record<string, string>>({});
  const [addingContentFor, setAddingContentFor] = useState<string | null>(null);

  async function reloadCreatorContent() {
    try {
      setCreatorContent(await fetchCreatorContent(ugcProp.id));
    } catch (err) {
      console.error('Failed to load creator content:', err);
    }
  }

  async function handleAddContent(campaignId: string) {
    const url = (contentUrlInputs[campaignId] || '').trim();
    if (!url) return;
    setAddingContentFor(campaignId);
    try {
      await addCampaignContent(campaignId, ugcProp.id, url);
      setContentUrlInputs(prev => ({ ...prev, [campaignId]: '' }));
      await reloadCreatorContent();
    } catch (err) {
      console.error('Failed to add content:', err);
    } finally {
      setAddingContentFor(null);
    }
  }

  async function handleDeleteCreatorContent(campaignId: string, contentId: string) {
    try {
      await deleteCampaignContent(campaignId, contentId);
      await reloadCreatorContent();
    } catch (err) {
      console.error('Failed to delete content:', err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      try {
        setLoadDetailError(null);
        setLoadingDetail(true);
        const detail = await fetchCreatorDetail(ugcProp.id);
        if (!cancelled) {
          const merged = { ...ugcProp, ...detail };
          setUgc(merged);
          if (!etiquetasModified.current) {
            setEtiquetasLocales(merged.etiquetas || []);
          }
          if (merged.evaluacionOrganica) {
            const o = merged.evaluacionOrganica;
            setOrgViews(o.views?.toString() ?? '');
            setOrgShares(o.shares?.toString() ?? '');
            setOrgER(o.engagementRate?.toString() ?? '');
          }
          if (merged.evaluacionPauta) {
            const p = merged.evaluacionPauta;
            setPImpresiones(p.impresiones?.toString() ?? '');
            setPAlcance(p.alcance?.toString() ?? '');
            setPCPM(p.cpm?.toString() ?? '');
            setPFrecuencia(p.frecuencia?.toString() ?? '');
            setPCTR(p.ctr?.toString() ?? '');
            setPVTR(p.vtr?.toString() ?? '');
            setPVistas(p.vistas?.toString() ?? '');
            setPER(p.er?.toString() ?? '');
          }
        }
      } catch (err) {
        console.error('Failed to load creator detail:', err);
        if (!cancelled) {
          setUgc(ugcProp);
          setLoadDetailError(err instanceof Error ? err.message : 'Error al cargar datos');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    loadDetail();
    fetch('/api/etiquetas')
      .then(r => r.json())
      .then(data => {
        if (!cancelled && Array.isArray(data)) setAvailableEtiquetas(data);
      })
      .catch(() => {});
    fetchCreatorContent(ugcProp.id)
      .then(data => { if (!cancelled) setCreatorContent(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ugcProp.id]);

  const av = avatarColor(ugc.id);
  const sc = scoreColor(ugc.score);
  const estadoConfig = ESTADO_UGC_CONFIG[ugc.estado];

  // ── Score breakdown computation ──────────────────────────────────────────
  const ep   = ugc.evaluacionPerfil;
  const ept  = ugc.evaluacionPerfilTiktok;
  const epau = ugc.evaluacionPauta;

  // Prefer Instagram, fall back to TikTok
  const bSeg   = ep?.seguidores ?? ept?.seguidores ?? null;
  const bER    = ep != null ? (ep.engagementRateCuenta ?? null) : (ept?.engagementRate ?? null);
  const bFreq  = ep?.frecuenciaSemanal ?? ept?.frecuenciaSemanal ?? null;
  // Viral: null if neither platform scraped; otherwise sum of both (may be 0)
  const igVirales = ep?.videosVirales ?? null;
  const ttVirales = ept?.videosVirales ?? null;
  const bVirales  = igVirales == null && ttVirales == null ? null : (igVirales ?? 0) + (ttVirales ?? 0);

  const bCPM    = epau?.cpm    != null ? epau.cpm    : null;
  const bCTR    = epau?.ctr    != null ? epau.ctr    : null;
  const bVTR    = epau?.vtr    != null ? epau.vtr    : null;
  const bVistas = epau?.vistas != null ? epau.vistas : null;
  const bERPauta = epau?.er    != null ? epau.er     : null;

  const sSeg    = ssSeguidores(bSeg);
  const sER     = ssER(bER);
  const sFreq   = ssFreq(bFreq);
  const sViral  = ssVirales(bVirales);
  const sCTR    = ssCTR(bCTR);
  const sVTR    = ssVTR(bVTR);
  const sCPM    = ssCPM(bCPM);
  const sVistas = ssVistas(bVistas);
  const sERPau  = ssERPauta(bERPauta);

  const perfilPts  = Math.min(60, sSeg.pts + sER.pts + sFreq.pts);
  const orgPts     = Math.min(25, sViral.pts + sCTR.pts + sVTR.pts);
  const pautaPts   = Math.min(15, sCPM.pts + sVistas.pts + sERPau.pts);

  const hasEvalData = !!ep || !!ept || !!epau;

  // Estado dropdown
  const [estadoOpen, setEstadoOpen] = useState(false);
  const [estadoPos, setEstadoPos] = useState({ top: 0, left: 0 });
  const estadoBadgeRef = useRef<HTMLButtonElement>(null);

  function openEstadoDropdown() {
    if (!estadoBadgeRef.current) return;
    const r = estadoBadgeRef.current.getBoundingClientRect();
    setEstadoPos({ top: r.bottom + 4, left: r.left });
    setEstadoOpen(true);
  }

  function handleEstadoChange(nuevo: EstadoUGC) {
    const updated = { ...ugc, estado: nuevo };
    setUgc(updated);
    onUpdateUGC(updated);
    setEstadoOpen(false);
  }

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
    setEditUsernameTiktok(ugc.usernameTiktok ?? '');
    setProfileEditing(true);
  }

  async function handleAddTag(tag: string) {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed || etiquetasLocales.includes(trimmed)) return;
    etiquetasModified.current = true;
    const next = [...etiquetasLocales, trimmed];
    setEtiquetasLocales(next);
    setUgc(prev => ({ ...prev, etiquetas: next }));
    if (!availableEtiquetas.includes(trimmed)) {
      setAvailableEtiquetas(prev => [...prev, trimmed]);
    }
    try {
      await updateEtiquetas(ugc.id, next);
      onUpdateUGC({ ...ugc, etiquetas: next });
    } catch (err) {
      console.error('Error guardando etiqueta:', err);
      setEtiquetasLocales(etiquetasLocales);
      setUgc(prev => ({ ...prev, etiquetas: etiquetasLocales }));
    }
  }

  async function handleRemoveTag(tag: string) {
    etiquetasModified.current = true;
    const next = etiquetasLocales.filter(t => t !== tag);
    setEtiquetasLocales(next);
    setUgc(prev => ({ ...prev, etiquetas: next }));
    try {
      await updateEtiquetas(ugc.id, next);
      onUpdateUGC({ ...ugc, etiquetas: next });
    } catch (err) {
      console.error('Error eliminando etiqueta:', err);
      setEtiquetasLocales(prev => [...prev, tag]);
      setUgc(prev => ({ ...prev, etiquetas: [...(prev.etiquetas || []), tag] }));
    }
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
        usernameTiktok: editUsernameTiktok.trim() || undefined,
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
    setOrgSaveError(null);
    try {
      const data: Omit<EvaluacionOrganica, 'completado'> = {
        views: orgViews ? parseFloat(orgViews) : undefined,
        shares: orgShares ? parseFloat(orgShares) : undefined,
        engagementRate: orgER ? parseFloat(orgER) : undefined,
      };
      await updateEvaluacionOrganica(ugc.id, data);
      const updated: UGC = {
        ...ugc,
        evaluacionOrganica: { ...data, completado: true },
      };
      setUgc(updated);
      onUpdateUGC(updated);
      setOrgEditing(false);
    } catch (err: any) {
      setOrgSaveError(err?.message ?? 'Error al guardar. Intentá de nuevo.');
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleSavePauta() {
    setPautaSaving(true);
    setPautaSaveError(null);
    try {
      const data: Omit<EvaluacionPauta, 'completado'> = {
        impresiones: pImpresiones ? parseFloat(pImpresiones) : undefined,
        alcance: pAlcance ? parseFloat(pAlcance) : undefined,
        cpm: pCPM ? parseFloat(pCPM) : undefined,
        frecuencia: pFrecuencia ? parseFloat(pFrecuencia) : undefined,
        ctr: pCTR ? parseFloat(pCTR) : undefined,
        vtr: pVTR ? parseFloat(pVTR) : undefined,
        vistas: pVistas ? parseFloat(pVistas) : undefined,
        er: pER ? parseFloat(pER) : undefined,
      };
      const result = await updateEvaluacionPauta(ugc.id, data);
      const updated: UGC = {
        ...ugc,
        score: result?.total ?? ugc.score,
        scoreBreakdown: result?.breakdown ?? ugc.scoreBreakdown,
        evaluacionPauta: { ...data, completado: true },
      };
      setUgc(updated);
      onUpdateUGC(updated);
      setPautaEditing(false);
    } catch (err: any) {
      setPautaSaveError(err?.message ?? 'Error al guardar. Intentá de nuevo.');
    } finally {
      setPautaSaving(false);
    }
  }

  async function handleScrapeAll() {
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeSuccess(false);
    if (ugc.usernameTiktok) {
      setTiktokScrapeLoading(true);
      setTiktokScrapeError(null);
      setTiktokScrapeSuccess(false);
    }

    let updatedUgc = { ...ugc };

    const [igResult, ttResult] = await Promise.allSettled([
      scrapeCreator(ugc.id),
      ugc.usernameTiktok ? scrapeTikTokCreator(ugc.id) : Promise.resolve(null),
    ]);

    // Instagram result
    if (igResult.status === 'fulfilled' && igResult.value?.ok && igResult.value.evaluacionPerfil) {
      updatedUgc = {
        ...updatedUgc,
        evaluacionPerfil: igResult.value.evaluacionPerfil,
        score: igResult.value.updatedScore ?? updatedUgc.score,
      };
      setScrapeSuccess(true);
      setTimeout(() => setScrapeSuccess(false), 3000);
    } else {
      const reason = igResult.status === 'rejected'
        ? igResult.reason?.message
        : 'No se pudo obtener datos de Instagram.';
      setScrapeError(reason ?? 'Error desconocido');
    }
    setScrapeLoading(false);

    // TikTok result
    if (ugc.usernameTiktok) {
      if (ttResult.status === 'fulfilled' && ttResult.value?.ok && ttResult.value?.evaluacionPerfilTiktok) {
        updatedUgc = {
          ...updatedUgc,
          evaluacionPerfilTiktok: ttResult.value.evaluacionPerfilTiktok,
          score: ttResult.value.updatedScore ?? updatedUgc.score,
        };
        setTiktokScrapeSuccess(true);
        setTimeout(() => setTiktokScrapeSuccess(false), 3000);
      } else {
        const reason = ttResult.status === 'rejected'
          ? (ttResult.reason as Error)?.message
          : 'No se pudo obtener datos de TikTok.';
        setTiktokScrapeError(reason ?? 'Error desconocido');
      }
      setTiktokScrapeLoading(false);
    }

    setUgc(updatedUgc);
    onUpdateUGC(updatedUgc);
  }

  // ── Tab button ───────────────────────────────────────────────────────────

  function TabBtn({ tab, icon: Icon, hasDot }: { tab: DrawerTab; icon: React.ElementType; hasDot?: boolean }) {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all duration-150 relative"
        style={isActive ? {
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-brand)',
          borderTop: '1px solid var(--color-border)',
          borderLeft: '1px solid var(--color-border)',
          borderRight: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-surface)',
          borderRadius: '8px 8px 0 0',
          marginBottom: '-1px',
          zIndex: 1,
        } : {
          backgroundColor: 'transparent',
          color: 'var(--color-text-3)',
          border: '1px solid transparent',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:block">{tab}</span>
        {hasDot && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white"
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
        className="fixed right-0 top-0 h-dvh w-full max-w-xl z-50 flex flex-col drawer-enter border-l"
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
                  <div className="flex items-center gap-1">
                    <img src={tiktokLogo} alt="TikTok" className="w-4 h-4 object-contain flex-shrink-0" />
                    <input
                      value={editUsernameTiktok}
                      onChange={e => setEditUsernameTiktok(e.target.value.replace(/^@/, ''))}
                      placeholder="handle_de_tiktok"
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
                      type="button"
                      onClick={() => setProfileEditing(false)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
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
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-200"
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
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200"
                style={{ color: 'var(--color-text-3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button
              ref={estadoBadgeRef}
              onClick={openEstadoDropdown}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-opacity hover:opacity-80 ${estadoConfig.className}`}
            >
              {estadoConfig.label}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {needsInfoUpdate(ugc) && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border"
                style={{ backgroundColor: 'rgba(252,154,0,0.08)', borderColor: 'rgba(252,154,0,0.25)', color: 'var(--color-brand)' }}>
                <AlertTriangle className="w-3 h-3" />
                Actualizar información
              </span>
            )}
          </div>

          {/* Estado dropdown portal */}
          {estadoOpen && createPortal(
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setEstadoOpen(false)} />
              <div style={{
                position: 'fixed',
                top: estadoPos.top,
                left: estadoPos.left,
                zIndex: 9999,
                minWidth: '160px',
                borderRadius: '10px',
                overflow: 'hidden',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              }}>
                {(Object.keys(ESTADO_UGC_CONFIG) as EstadoUGC[]).map(estado => (
                  <button
                    key={estado}
                    onClick={() => handleEstadoChange(estado)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors"
                    style={{
                      backgroundColor: ugc.estado === estado ? 'var(--color-surface-alt)' : 'transparent',
                      color: 'var(--color-text-1)',
                    }}
                    onMouseEnter={e => { if (ugc.estado !== estado) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                    onMouseLeave={e => { if (ugc.estado !== estado) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${ESTADO_UGC_CONFIG[estado].className}`}>
                      {ESTADO_UGC_CONFIG[estado].label}
                    </span>
                    {ugc.estado === estado && (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}

          {/* Score — clickable, expands breakdown */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <button
              onClick={() => hasEvalData && setScoreBreakdownOpen(o => !o)}
              className="w-full p-3 text-left"
              style={{ cursor: hasEvalData ? 'pointer' : 'default' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>Score total</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono font-bold text-lg ${sc.text}`}>{ugc.score}</span>
                  {hasEvalData && (
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

            {/* Animated breakdown — detailed sub-metrics */}
            <div
              style={{
                maxHeight: scoreBreakdownOpen ? '600px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.4s ease-in-out',
              }}
            >
              <div className="px-3 pb-3 pt-2 space-y-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>

                {/* ── Evaluación de perfil ── */}
                {(() => {
                  const subs: { label: string; sub: SubScore }[] = [
                    { label: 'Seguidores',        sub: sSeg },
                    { label: 'ER de cuenta',       sub: sER  },
                    { label: 'Frecuencia semanal', sub: sFreq },
                  ];
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-1)' }}>Evaluación de perfil</span>
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {perfilPts}<span style={{ color: 'var(--color-text-3)' }}>/60</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${(perfilPts / 60) * 100}%` }} />
                      </div>
                      <div className="space-y-1 pl-2 border-l" style={{ borderColor: 'var(--color-border)' }}>
                        {subs.map(({ label, sub }) => (
                          <div key={label} className="flex justify-between items-center">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
                            <div className="flex items-center gap-2">
                              {sub.value && <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-2)' }}>{sub.value}</span>}
                              <span className="text-[10px] font-mono font-bold" style={{ color: sub.pts > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
                                {sub.value == null ? '—' : `${sub.pts}/${sub.max}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Contenido orgánico ── */}
                {(() => {
                  const subs: { label: string; sub: SubScore }[] = [
                    { label: 'Videos virales (×3 avg)', sub: sViral },
                    { label: 'CTR',                      sub: sCTR   },
                    { label: 'VTR',                      sub: sVTR   },
                  ];
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-1)' }}>Contenido orgánico</span>
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {orgPts}<span style={{ color: 'var(--color-text-3)' }}>/25</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${(orgPts / 25) * 100}%` }} />
                      </div>
                      <div className="space-y-1 pl-2 border-l" style={{ borderColor: 'var(--color-border)' }}>
                        {subs.map(({ label, sub }) => (
                          <div key={label} className="flex justify-between items-center">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
                            <div className="flex items-center gap-2">
                              {sub.value && <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-2)' }}>{sub.value}</span>}
                              <span className="text-[10px] font-mono font-bold" style={{ color: sub.pts > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
                                {sub.value == null ? '—' : `${sub.pts}/${sub.max}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── KPIs de pauta ── */}
                {(() => {
                  const subs: { label: string; sub: SubScore }[] = [
                    { label: 'CPM',         sub: sCPM    },
                    { label: 'Vistas paid', sub: sVistas  },
                    { label: 'ER paid',     sub: sERPau  },
                  ];
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-1)' }}>KPIs de pauta</span>
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {pautaPts}<span style={{ color: 'var(--color-text-3)' }}>/15</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${(pautaPts / 15) * 100}%` }} />
                      </div>
                      <div className="space-y-1 pl-2 border-l" style={{ borderColor: 'var(--color-border)' }}>
                        {subs.map(({ label, sub }) => (
                          <div key={label} className="flex justify-between items-center">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
                            <div className="flex items-center gap-2">
                              {sub.value && <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-2)' }}>{sub.value}</span>}
                              <span className="text-[10px] font-mono font-bold" style={{ color: sub.pts > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>
                                {sub.value == null ? '—' : `${sub.pts}/${sub.max}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 pt-3 pb-0 border-b flex items-end gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-alt)' }}>
          <TabBtn tab="Perfil" icon={TrendingUp} />
          <TabBtn tab="Contenido Orgánico" icon={Tv2} hasDot={missingOrganica} />
          <TabBtn tab="Pauta" icon={BarChart2} hasDot={missingPauta} />
          <TabBtn tab="Campañas" icon={Megaphone} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--color-text-3)' }}>Cargando detalle...</span>
            </div>
          ) : loadDetailError ? (
            <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl"
                 style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(239,68,68)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'rgb(185,28,28)' }}>Error al cargar el detalle</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(185,28,28)', opacity: 0.8 }}>{loadDetailError}</p>
              </div>
            </div>
          ) : (

            <>
              {/* ── TAB: PERFIL ──────────────────────────────────────────── */}
              {activeTab === 'Perfil' && (
                <>
                  {/* ── KERNEL DATA section ── */}
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    {/* Section header: title + single unified button */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
                        Datos del perfil
                      </h3>
                      <button
                        onClick={handleScrapeAll}
                        disabled={scrapeLoading || tiktokScrapeLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 disabled:opacity-60"
                        style={
                          (scrapeSuccess && !scrapeLoading) || (tiktokScrapeSuccess && !tiktokScrapeLoading)
                            ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgb(22,163,74)', border: '1px solid rgba(34,197,94,0.35)' }
                            : (scrapeLoading || tiktokScrapeLoading)
                              ? { backgroundColor: 'rgba(249,115,22,0.12)', color: 'rgb(234,88,12)', border: '1px solid rgba(249,115,22,0.35)' }
                              : { backgroundColor: 'rgb(249,115,22)', color: '#fff', border: '1px solid rgb(234,88,12)', boxShadow: '0 1px 4px rgba(249,115,22,0.4)' }
                        }
                      >
                        {(scrapeLoading || tiktokScrapeLoading)
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Evaluando...</>
                          : (scrapeSuccess || tiktokScrapeSuccess)
                            ? <><CheckCircle2 className="w-3 h-3" />Evaluado</>
                            : <><RefreshCw className="w-3 h-3" />Evaluar perfil</>
                        }
                      </button>
                    </div>

                    {/* ── Instagram card ── */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <img src={instagramLogo} alt="Instagram" className="w-4 h-4 object-contain" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>Instagram</span>
                        {ugc.evaluacionPerfil && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                            style={{ backgroundColor: 'rgba(20,184,166,0.1)', color: 'rgb(13,148,136)', border: '1px solid rgba(20,184,166,0.2)' }}
                          >
                            Actualizado {formatLastScraped(ugc.evaluacionPerfil.lastScrapedAt)}
                          </span>
                        )}
                      </div>
                      {scrapeError && (
                        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border"
                          style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                          <p className="text-[11px] text-rose-600">{scrapeError}</p>
                        </div>
                      )}
                      {ugc.evaluacionPerfil ? (
                        <div className="rounded-xl p-3 border" style={{ backgroundColor: 'rgba(20,184,166,0.03)', borderColor: 'rgba(20,184,166,0.15)' }}>
                          <MetricRow label="Handle" value={ugc.evaluacionPerfil.perfil} />
                          <MetricRow label="Seguidores" value={ugc.evaluacionPerfil.seguidores.toLocaleString('es-AR')} />
                          <MetricRow label="ER Cuenta" value={ugc.evaluacionPerfil.engagementRateCuenta} unit="%" tooltip="(Likes + Comentarios) ÷ (Posts × Seguidores) × 100. Últimos 5 posts sin pinnear con likes visibles." />
                          <MetricRow label="Promedio Vistas" value={ugc.evaluacionPerfil.promedioVistaVideos?.toLocaleString('es-AR')} tooltip="Promedio de reproducciones de los últimos 5 Reels del perfil." />
                          <MetricRow label="Frecuencia semanal" value={ugc.evaluacionPerfil.frecuenciaSemanal != null ? `${ugc.evaluacionPerfil.frecuenciaSemanal} posts/sem` : undefined} tooltip="Promedio de posts publicados por semana en los últimos 60 días." />
                          <MetricRow label="Videos virales" value={ugc.evaluacionPerfil.videosVirales != null ? `${ugc.evaluacionPerfil.videosVirales}` : undefined} tooltip="Videos en los últimos 60 días cuyas vistas superan 3× el promedio del resto." />
                          <MetricRow label="Categoría" value={ugc.evaluacionPerfil.categoria} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                          style={{ backgroundColor: 'rgba(20,184,166,0.04)', borderColor: 'rgba(20,184,166,0.15)' }}>
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(13,148,136)' }} />
                          <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                            Sin datos — presioná "Evaluar perfil" para analizar.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── TikTok card ── */}
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <img src={tiktokLogo} alt="TikTok" className="w-4 h-4 object-contain" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>TikTok</span>
                        {ugc.evaluacionPerfilTiktok && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                            style={{ backgroundColor: 'rgba(20,184,166,0.1)', color: 'rgb(13,148,136)', border: '1px solid rgba(20,184,166,0.2)' }}
                          >
                            Actualizado {formatLastScraped(ugc.evaluacionPerfilTiktok.lastScrapedAt)}
                          </span>
                        )}
                      </div>
                      {tiktokScrapeError && (
                        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border"
                          style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                          <p className="text-[11px] text-rose-600">{tiktokScrapeError}</p>
                        </div>
                      )}
                      {ugc.usernameTiktok ? (
                        ugc.evaluacionPerfilTiktok ? (
                          <div className="rounded-xl p-3 border" style={{ backgroundColor: 'rgba(20,184,166,0.03)', borderColor: 'rgba(20,184,166,0.15)' }}>
                            <MetricRow label="Handle" value={`@${ugc.evaluacionPerfilTiktok.handle}`} />
                            <MetricRow label="Seguidores" value={ugc.evaluacionPerfilTiktok.seguidores.toLocaleString('es-AR')} />
                            <MetricRow label="ER" value={ugc.evaluacionPerfilTiktok.engagementRate} unit="%" tooltip="(Likes + Comentarios) ÷ (Videos × Seguidores) × 100. Últimos 5 videos sin pinnear." />
                            <MetricRow label="Promedio Vistas" value={ugc.evaluacionPerfilTiktok.promedioVistas?.toLocaleString('es-AR')} tooltip="Promedio de reproducciones de los últimos 5 videos sin pinnear del perfil." />
                            <MetricRow label="Frecuencia semanal" value={ugc.evaluacionPerfilTiktok.frecuenciaSemanal != null ? `${ugc.evaluacionPerfilTiktok.frecuenciaSemanal} posts/sem` : undefined} tooltip="Promedio de videos publicados por semana en los últimos 60 días." />
                            <MetricRow label="Videos virales" value={ugc.evaluacionPerfilTiktok.videosVirales != null ? `${ugc.evaluacionPerfilTiktok.videosVirales}` : undefined} tooltip="Videos en los últimos 60 días cuyas vistas superan 3× el promedio del resto." />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                            style={{ backgroundColor: 'rgba(20,184,166,0.04)', borderColor: 'rgba(20,184,166,0.15)' }}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(13,148,136)' }} />
                            <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                              Sin datos — presioná "Evaluar perfil" para analizar.
                            </p>
                          </div>
                        )
                      ) : (
                        <p className="text-xs italic" style={{ color: 'var(--color-text-3)' }}>
                          Sin handle — editá el perfil para agregarlo.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Etiquetas ── */}
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--color-text-3)' }}>
                      Etiquetas
                    </h3>

                    {/* Input con dropdown */}
                    <div className="relative mb-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={e => { setTagInput(e.target.value); setTagDropdownOpen(true); }}
                            onFocus={() => setTagDropdownOpen(true)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag(tagInput);
                                setTagInput('');
                                setTagDropdownOpen(false);
                              }
                              if (e.key === 'Escape') setTagDropdownOpen(false);
                            }}
                            placeholder="Agregar etiqueta..."
                            className="w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none transition-all"
                            style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: tagDropdownOpen ? 'var(--color-brand)' : 'var(--color-border)', color: 'var(--color-text-1)', boxShadow: tagDropdownOpen ? '0 0 0 3px rgba(252,154,0,0.12)' : 'none' }}
                          />

                          {/* Dropdown */}
                          {tagDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setTagDropdownOpen(false)} />
                              {(() => {
                                const q = tagInput.toLowerCase();
                                const opts = availableEtiquetas.filter(t =>
                                  !etiquetasLocales.includes(t) && (!q || t.toLowerCase().includes(q))
                                );
                                const showNew = tagInput.trim() && !availableEtiquetas.some(t => t.toLowerCase() === tagInput.trim().toLowerCase()) && !etiquetasLocales.includes(tagInput.trim());
                                if (opts.length === 0 && !showNew) return null;
                                return (
                                  <div
                                    className="absolute left-0 right-0 z-20 mt-1 rounded-xl border shadow-lg overflow-hidden"
                                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', maxHeight: '180px', overflowY: 'auto' }}
                                  >
                                    {opts.map(tag => (
                                      <button
                                        key={tag}
                                        type="button"
                                        onMouseDown={e => { e.preventDefault(); handleAddTag(tag); setTagInput(''); setTagDropdownOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-100"
                                        style={{ color: 'var(--color-text-1)' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                    {showNew && (
                                      <button
                                        type="button"
                                        onMouseDown={e => { e.preventDefault(); handleAddTag(tagInput); setTagInput(''); setTagDropdownOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-semibold transition-colors duration-100 flex items-center gap-1.5"
                                        style={{ color: 'var(--color-brand-hover)', borderTop: opts.length > 0 ? '1px solid var(--color-border-subtle)' : 'none' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                                      >
                                        <Plus className="w-3 h-3" />
                                        Crear "{tagInput.trim()}"
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => { handleAddTag(tagInput); setTagInput(''); setTagDropdownOpen(false); }}
                          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200"
                          style={{ borderColor: 'var(--color-brand-border)', backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)' }
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)' }
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chips seleccionadas */}
                    {etiquetasLocales.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {etiquetasLocales.map(tag => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-0.5 hover:opacity-60 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: 'var(--color-text-3)' }}>Sin etiquetas</p>
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

                </>
              )}

              {/* ── TAB: CONTENIDO ORGÁNICO ──────────────────────────────── */}
              {activeTab === 'Contenido Orgánico' && (
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Contenido Orgánico de Campaña</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Métricas orgánicas del creador en campaña (referencia)</p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {ugc.evaluacionOrganica?.completado && !orgEditing ? (
                        <button
                          onClick={() => setOrgEditing(true)}
                          className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                        >
                          Editar
                        </button>
                      ) : !ugc.evaluacionOrganica?.completado ? (
                        <WarnTooltip message="Completá esta sección para poder calcular el score del creador." />
                      ) : null}
                    </div>
                  </div>

                  {ugc.evaluacionOrganica?.completado && !orgEditing ? (
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-alt)' }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(22,163,74)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'rgb(22,163,74)' }}>Evaluación completa</span>
                      </div>
                      <div className="px-4 py-2">
                        <MetricRow label="Views promedio" value={ugc.evaluacionOrganica.views?.toLocaleString('es-AR')} />
                        <MetricRow label="Shares promedio" value={ugc.evaluacionOrganica.shares?.toLocaleString('es-AR')} />
                        <MetricRow label="Engagement Rate" value={ugc.evaluacionOrganica.engagementRate} unit="%" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <FormField label="Views promedio" value={orgViews} onChange={setOrgViews} placeholder="ej: 12500"
                          tooltip="Promedio de reproducciones por video en los últimos posteos orgánicos de campaña." />
                        <FormField label="Shares promedio" value={orgShares} onChange={setOrgShares} placeholder="ej: 340"
                          tooltip="Promedio de veces que se compartió cada video orgánico de campaña." />
                        <FormField label="Engagement Rate" unit="%" value={orgER} onChange={setOrgER} placeholder="ej: 4.2"
                          tooltip="(Likes + Comentarios) ÷ Alcance × 100, promediado en los últimos posteos orgánicos." />
                      </div>
                      <div className="flex gap-2">
                        {orgEditing && (
                          <button
                            onClick={() => setOrgEditing(false)}
                            className="px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={handleSaveOrganica}
                          disabled={orgSaving}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-brand)' }}
                        >
                          {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {orgSaving ? 'Guardando...' : 'Guardar evaluación'}
                        </button>
                      </div>
                      {orgSaveError && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                          style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                          <p className="text-xs text-rose-600">{orgSaveError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: PAUTA ───────────────────────────────────────────── */}
              {activeTab === 'Pauta' && (
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Evaluación de KPIs de Pauta</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Métricas de rendimiento en campañas pagadas</p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {ugc.evaluacionPauta?.completado && !pautaEditing ? (
                        <button
                          onClick={() => setPautaEditing(true)}
                          className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                        >
                          Editar
                        </button>
                      ) : !ugc.evaluacionPauta?.completado ? (
                        <WarnTooltip message="Completá esta sección para poder calcular el score del creador." />
                      ) : null}
                    </div>
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
                        <MetricRow label="Vistas (paid)" value={ugc.evaluacionPauta.vistas?.toLocaleString('es-AR')} />
                        <MetricRow label="ER (paid)" value={ugc.evaluacionPauta.er} unit="%" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <FormField label="Impresiones" value={pImpresiones} onChange={setPImpresiones} placeholder="ej: 45000"
                          tooltip="Total de veces que se mostró el anuncio, incluyendo repeticiones al mismo usuario." />
                        <FormField label="Alcance" value={pAlcance} onChange={setPAlcance} placeholder="ej: 38000"
                          tooltip="Cantidad de personas únicas que vieron el anuncio al menos una vez." />
                        <FormField label="CPM" unit="$" value={pCPM} onChange={setPCPM} placeholder="ej: 2.5"
                          tooltip="Costo por cada 1.000 impresiones. Indica la eficiencia del gasto en pauta." />
                        <FormField label="Frecuencia" value={pFrecuencia} onChange={setPFrecuencia} placeholder="ej: 1.8"
                          tooltip="Promedio de veces que cada persona vio el anuncio. Impresiones ÷ Alcance." />
                        <FormField label="CTR" unit="%" value={pCTR} onChange={setPCTR} placeholder="ej: 3.2"
                          tooltip="Click-Through Rate: % de personas que hicieron clic sobre el total de impresiones." />
                        <FormField label="VTR" unit="%" value={pVTR} onChange={setPVTR} placeholder="ej: 65"
                          tooltip="View-Through Rate: % de personas que vieron el video completo sobre el total de impresiones." />
                        <FormField label="Vistas (paid)" value={pVistas} onChange={setPVistas} placeholder="ej: 120000"
                          tooltip="Reproducciones totales obtenidas con pauta en esta campaña." />
                        <FormField label="ER (paid)" unit="%" value={pER} onChange={setPER} placeholder="ej: 2.1"
                          tooltip="Engagement Rate del contenido pauteado: interacciones ÷ impresiones × 100." />
                      </div>
                      <div className="flex gap-2">
                        {pautaEditing && (
                          <button
                            onClick={() => setPautaEditing(false)}
                            className="px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface-alt)' }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={handleSavePauta}
                          disabled={pautaSaving}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-brand)' }}
                        >
                          {pautaSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {pautaSaving ? 'Guardando...' : 'Guardar evaluación'}
                        </button>
                      </div>
                      {pautaSaveError && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                          style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                          <p className="text-xs text-rose-600">{pautaSaveError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: CAMPAÑAS ─────────────────────────────────────────── */}
              {activeTab === 'Campañas' && (
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-3)' }}>
                      Campañas asignadas
                    </h3>
                    {ugc.estado !== 'Descartado' && availableToAssign.length > 0 && (
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
                      {ugc.estado !== 'Descartado' && availableToAssign.length > 0 && (
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-3)' }}>
                          Usá el botón + para agregar
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignedCampaigns.map(c => {
                        const ugcInCamp = c.ugcs.find(u => u.ugcId === ugc.id);
                        const piezas = creatorContent.filter(p => p.campaignId === c.id);
                        return (
                          <div
                            key={c.id}
                            className="px-3 py-2.5 rounded-xl border"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-alt)' }}
                          >
                            <div className="flex items-center justify-between">
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

                            {/* Posteos del creador en esta campaña */}
                            <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Link2 className="w-3 h-3" style={{ color: 'var(--color-text-3)' }} />
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
                                  Posteos ({piezas.length})
                                </span>
                              </div>
                              {piezas.length > 0 && (
                                <div className="flex flex-col gap-1 mb-1.5">
                                  {piezas.map(p => (
                                    <div key={p.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 min-w-0 flex-1 hover:underline" style={{ color: 'var(--color-text-2)' }}>
                                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                        <span className="truncate">{p.url}</span>
                                      </a>
                                      {p.views != null && (
                                        <span className="font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>
                                          {p.views >= 1000 ? (p.views / 1000).toFixed(1) + 'K' : p.views} vistas
                                        </span>
                                      )}
                                      <button onClick={() => handleDeleteCreatorContent(c.id, p.id)} title="Quitar" className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:text-rose-500" style={{ color: 'var(--color-text-3)' }}>
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="url"
                                  value={contentUrlInputs[c.id] || ''}
                                  onChange={e => setContentUrlInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleAddContent(c.id); }}
                                  placeholder="URL del posteo…"
                                  className="flex-1 px-2 py-1 border rounded-lg text-[11px] focus:outline-none transition-all duration-200"
                                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                                />
                                <button
                                  onClick={() => handleAddContent(c.id)}
                                  disabled={!((contentUrlInputs[c.id] || '').trim()) || addingContentFor === c.id}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                  style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
                                >
                                  {addingContentFor === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                                  Agregar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </>
  );
}
