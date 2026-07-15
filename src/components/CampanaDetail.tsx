import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Rocket, Pause, Play, Trash2, Megaphone,
  ChevronDown, ChevronUp, ChevronsUpDown,
  X, Loader2, RefreshCw,
  Eye, Heart, MessageCircle, Share2, Link2, ExternalLink, AlertTriangle, Activity, HelpCircle, Sparkles, Smile, Users, Check, Trophy
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import instagramLogo from '../assets/instagram-logo.png';
import tiktokLogo from '../assets/tiktok-logo.png';
import type { Campana, UGC, EstadoEnCampana, ContenidoCampana, MetricasCampana, SentimientoCampana } from '../data';
import {
  scoreColor, ESTADO_EN_CAMPANA_CONFIG, ESTADO_CAMPANA_CONFIG,
  getInitials, avatarColor
} from '../utils';
import ConfirmarEnvioModal from './ConfirmarEnvioModal';
import {
  scrapeCreatorsByCampaign, fetchCampaignContent, addCampaignContent,
  deleteCampaignContent, scrapeCampaignContent
} from '../api';

/** Formato compacto de números: 12.3K, 1.2M */
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('es-AR');
}

interface Props {
  campana: Campana;
  ugcs: UGC[];
  onBack: () => void;
  onTogglePause: (campana: Campana) => void;
  onLanzar: (campana: Campana) => void;
  onDeleteCampana: (campana: Campana) => void;
  onUpdateEstadoCreador: (campanaId: string, creatorId: string, estado: EstadoEnCampana) => void;
  onGoToChat: (ugc: UGC) => void;
}

type SortKey2 = 'nombre' | 'estado' | 'score' | 'fechaEnvio';
type SortDir = 'asc' | 'desc';
type RankingSortKey = 'nombre' | 'views' | 'likes' | 'comments' | 'shares' | 'sentiment';

const ESTADOS_EN: EstadoEnCampana[] = ['Pendiente', 'En Negociación', 'Disponible', 'Activo', 'Descartado'];

/** Tooltip por portal (mismo patrón que UGCDrawer.MetricRow). */
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
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

const NOT_ANALYZED_MSG = 'Todavía no se analizaron los posteos. Si querés analizarlos, presioná "Analizar ahora".';

/**
 * Tarjeta de métrica clave de campaña.
 * - value === null (todavía no se analizó la campaña) → "—" con tooltip genérico.
 * - unavailable (se analizó, pero la plataforma no expone este dato) → "Sin calcular"
 *   con tooltip explicando el motivo puntual.
 * - si no, muestra el valor.
 */
function MetricCard({ icon, label, value, help, unavailable }: {
  icon: React.ReactNode; label: string; value: string | null; help: string; unavailable?: string;
}) {
  return (
    <div className="flex-1 min-w-[120px] p-3 border rounded-xl" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ color: 'var(--color-text-3)' }}>{icon}</span>
        <Tip text={help}>
          <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--color-text-3)' }} />
        </Tip>
      </div>
      {unavailable ? (
        <Tip text={unavailable}>
          <p className="text-sm font-bold cursor-help" style={{ color: 'var(--color-text-3)' }}>Sin calcular</p>
        </Tip>
      ) : value != null ? (
        <p className="text-xl font-black font-mono" style={{ color: 'var(--color-text-1)' }}>{value}</p>
      ) : (
        <Tip text={NOT_ANALYZED_MSG}>
          <span className="text-xl font-black font-mono cursor-help" style={{ color: 'var(--color-text-3)' }}>—</span>
        </Tip>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</p>
    </div>
  );
}

/**
 * Barra de sentimiento (positivo/neutral/negativo) sobre la muestra de comentarios
 * analizada por MiniMax. Si sentimiento es null, muestra el mismo placeholder "—"
 * que MetricCard, con el mismo tooltip de "todavía no se analizó".
 */
function SentimentCard({ sentimiento }: { sentimiento: SentimientoCampana | null }) {
  return (
    <div className="flex-1 min-w-[240px] p-3 border rounded-xl" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
          <Smile className="w-4 h-4" />
        </span>
        <Tip text="Clasificación con IA (MiniMax) de los últimos 10 comentarios de cada posteo cargado, mezclados en una sola muestra. Positivo/negativo se calculan sobre el total de la muestra; neutral sale por diferencia para sumar 100%.">
          <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--color-text-3)' }} />
        </Tip>
      </div>
      {sentimiento ? (
        <>
          <div className="flex h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
            <div style={{ width: `${sentimiento.positivo}%`, backgroundColor: '#10b981' }} />
            <div style={{ width: `${sentimiento.neutral}%`, backgroundColor: 'var(--color-text-3)', opacity: 0.35 }} />
            <div style={{ width: `${sentimiento.negativo}%`, backgroundColor: '#f43f5e' }} />
          </div>
          <div className="flex items-center gap-3 text-xs font-mono font-bold">
            <span style={{ color: '#10b981' }}>{sentimiento.positivo}% pos</span>
            <span style={{ color: 'var(--color-text-3)' }}>{sentimiento.neutral}% neu</span>
            <span style={{ color: '#f43f5e' }}>{sentimiento.negativo}% neg</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-3)' }}>sobre {sentimiento.muestras} comentarios</p>
        </>
      ) : (
        <Tip text={NOT_ANALYZED_MSG}>
          <span className="text-xl font-black font-mono cursor-help" style={{ color: 'var(--color-text-3)' }}>—</span>
        </Tip>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: 'var(--color-text-3)' }}>Sentimiento de comentarios</p>
    </div>
  );
}

/**
 * Dropdown custom para recalificar a un creador dentro de una campaña.
 * Reemplaza al <select> nativo: el trigger es un badge del color del estado
 * actual, y el panel lista las 4 categorías como chips coloreados con check
 * en la seleccionada. El panel se renderiza por portal (mismo patrón que Tip)
 * para no quedar recortado dentro de contenedores con scroll (tabla, modal).
 */
function EstadoSelect({ value, onChange }: { value: EstadoEnCampana; onChange: (estado: EstadoEnCampana) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cfg = ESTADO_EN_CAMPANA_CONFIG[value];

  function handleToggle() {
    if (!open) {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        title="Recalificar creador"
        className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all duration-150 ${cfg.className}`}
        style={{ boxShadow: open ? '0 0 0 2px var(--color-brand)' : 'none' }}
      >
        {cfg.label}
        <ChevronDown className="w-3 h-3 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="w-44 rounded-xl border p-1 popover-enter"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
            backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)',
          }}
        >
          {ESTADOS_EN.map(e => {
            const eCfg = ESTADO_EN_CAMPANA_CONFIG[e];
            const isSelected = e === value;
            return (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg transition-colors duration-150"
                onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = ''}
              >
                <span className={`flex-1 text-left px-2 py-1 rounded-md text-[11px] font-semibold ${eCfg.className}`}>{eCfg.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

export default function CampanaDetail({ campana, ugcs, onBack, onTogglePause, onLanzar, onDeleteCampana, onUpdateEstadoCreador, onGoToChat }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterEstado = (searchParams.get('estado') as EstadoEnCampana | null) ?? '';
  const sortKey = (searchParams.get('sort') as SortKey2 | null) ?? 'score';
  const sortDir = (searchParams.get('dir') as SortDir | null) ?? 'desc';

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      return next;
    });
  }

  const [showLanzarModal, setShowLanzarModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ success: number; failed: number } | null>(null);

  // ── Contenido de campaña + métricas ──
  const [content, setContent] = useState<ContenidoCampana[]>([]);
  const [metricas, setMetricas] = useState<MetricasCampana | null>(null);
  const [sentimiento, setSentimiento] = useState<SentimientoCampana | null>(null);
  const [creadoresSinPosteos, setCreadoresSinPosteos] = useState<{ id: string; nombre: string }[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [scrapingContent, setScrapingContent] = useState(false);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [posteosOpen, setPosteosOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingSort, setRankingSort] = useState<{ key: RankingSortKey; dir: SortDir }>({ key: 'views', dir: 'desc' });
  const [creadoresOpen, setCreadoresOpen] = useState(false);
  const [modalEstado, setModalEstado] = useState<EstadoEnCampana | null>(null);

  const loadContent = useCallback(async () => {
    try {
      setContentLoading(true);
      const data = await fetchCampaignContent(campana.id);
      setContent(data.content);
      setMetricas(data.metricas);
      setSentimiento(data.sentimiento);
      setCreadoresSinPosteos(data.creadoresSinPosteos);
    } catch (err) {
      console.error('Failed to load campaign content:', err);
    } finally {
      setContentLoading(false);
    }
  }, [campana.id]);

  useEffect(() => { loadContent(); }, [loadContent]);

  async function handleAddUrl(creatorId: string) {
    const url = (urlInputs[creatorId] || '').trim();
    if (!url) return;
    setAddingFor(creatorId);
    try {
      await addCampaignContent(campana.id, creatorId, url);
      setUrlInputs(prev => ({ ...prev, [creatorId]: '' }));
      await loadContent();
    } catch (err) {
      console.error('Failed to add content:', err);
    } finally {
      setAddingFor(null);
    }
  }

  async function handleDeleteContent(contentId: string) {
    try {
      await deleteCampaignContent(campana.id, contentId);
      await loadContent();
    } catch (err) {
      console.error('Failed to delete content:', err);
    }
  }

  async function handleScrapeContent() {
    setScrapingContent(true);
    try {
      const result = await scrapeCampaignContent(campana.id);
      setContent(result.content);
      setMetricas(result.metricas);
      setSentimiento(result.sentimiento);
    } catch (err) {
      console.error('Failed to scrape content:', err);
    } finally {
      setScrapingContent(false);
    }
  }

  const estadoCfg = ESTADO_CAMPANA_CONFIG[campana.estado];

  const conteoPorEstado: Record<EstadoEnCampana, number> = {
    Pendiente: campana.ugcs.filter(u => u.estado === 'Pendiente').length,
    Activo: campana.ugcs.filter(u => u.estado === 'Activo').length,
    'En Negociación': campana.ugcs.filter(u => u.estado === 'En Negociación').length,
    Disponible: campana.ugcs.filter(u => u.estado === 'Disponible').length,
    Descartado: campana.ugcs.filter(u => u.estado === 'Descartado').length,
  };

  function handleSort(k: SortKey2) {
    if (sortKey === k) updateParams({ sort: k, dir: sortDir === 'asc' ? 'desc' : 'asc' });
    else updateParams({ sort: k, dir: 'desc' });
  }
  function SortIcon({ col }: { col: SortKey2 }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  const rows = campana.ugcs
    .filter(uc => !filterEstado || uc.estado === filterEstado)
    .map(uc => {
      const ugc = ugcs.find(u => u.id === uc.ugcId);
      return { uc, ugc };
    })
    .filter(x => x.ugc)
    .sort((a, b) => {
      const ua = a.ugc!;
      const ub = b.ugc!;
      let cmp = 0;
      if (sortKey === 'nombre') cmp = ua.nombre.localeCompare(ub.nombre);
      else if (sortKey === 'score') cmp = ua.score - ub.score;
      else if (sortKey === 'estado') cmp = a.uc.estado.localeCompare(b.uc.estado);
      else cmp = a.uc.fechaEnvio.localeCompare(b.uc.fechaEnvio);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const modalCreadores = modalEstado
    ? campana.ugcs
        .filter(uc => uc.estado === modalEstado)
        .map(uc => ({ uc, ugc: ugcs.find(u => u.id === uc.ugcId) }))
        .filter((x): x is { uc: typeof x.uc; ugc: UGC } => !!x.ugc)
        .sort((a, b) => a.ugc.nombre.localeCompare(b.ugc.nombre))
    : [];

  function handleRankingSort(k: RankingSortKey) {
    setRankingSort(prev => prev.key === k ? { key: k, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' });
  }
  function RankingSortIcon({ col }: { col: RankingSortKey }) {
    if (rankingSort.key !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return rankingSort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  const rankingRows = [...(metricas?.topCreadores ?? [])].sort((a, b) => {
    let cmp = 0;
    if (rankingSort.key === 'nombre') cmp = a.nombre.localeCompare(b.nombre);
    else if (rankingSort.key === 'sentiment') cmp = (a.sentimentPositive ?? -1) - (b.sentimentPositive ?? -1);
    else cmp = (a[rankingSort.key] ?? -1) - (b[rankingSort.key] ?? -1);
    return rankingSort.dir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0"
            style={{ color: 'var(--color-text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black" style={{ color: 'var(--color-text-1)' }}>{campana.nombre}</h2>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>{estadoCfg.label}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>{campana.descripcion}</p>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--color-text-3)' }}>{campana.fechaInicio} → {campana.fechaFin}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Eliminar campaña"
            className="group flex items-center px-2.5 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ borderColor: '#fecdd3', backgroundColor: '#fff1f2', color: '#e11d48' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#ffe4e6'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#fff1f2'}
          >
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-200 ease-out">
              <span className="overflow-hidden whitespace-nowrap">
                <span className="pl-2">Eliminar</span>
              </span>
            </span>
          </button>
          {campana.estado !== 'Cerrada' && campana.estado !== 'Borrador' && (
            <button
              onClick={() => { if (campana.estado === 'Pausada') onTogglePause(campana); else setShowPauseConfirm(true); }}
              title={campana.estado === 'Pausada' ? 'Reanudar campaña' : 'Pausar campaña'}
              className="group flex items-center px-2.5 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
            >
              {campana.estado === 'Pausada' ? <Play className="w-3.5 h-3.5 flex-shrink-0" /> : <Pause className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-200 ease-out">
                <span className="overflow-hidden whitespace-nowrap">
                  <span className="pl-2">{campana.estado === 'Pausada' ? 'Reanudar' : 'Pausar'}</span>
                </span>
              </span>
            </button>
          )}
          <button
            onClick={() => setShowEnvioModal(true)}
            title="Mensaje general"
            className="group flex items-center px-2.5 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ borderColor: '#e9d5ff', backgroundColor: '#faf5ff', color: '#9333ea' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f3e8ff'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#faf5ff'}
          >
            <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-200 ease-out">
              <span className="overflow-hidden whitespace-nowrap">
                <span className="pl-2">Mensaje general</span>
              </span>
            </span>
          </button>
          {campana.estado !== 'Cerrada' && (
            <button
              onClick={() => setShowLanzarModal(true)}
              title="Lanzar envío"
              className="group flex items-center px-3 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
            >
              <Rocket className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-200 ease-out">
                <span className="overflow-hidden whitespace-nowrap">
                  <span className="pl-2">Lanzar envío</span>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Progreso de campaña (tarjetas por categoría; clic abre el detalle) ── */}
      <div className="border rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Progreso de campaña</h3>
        </div>

        <div className="flex gap-3 flex-wrap">
          {ESTADOS_EN.map(estado => {
            const cfg = ESTADO_EN_CAMPANA_CONFIG[estado];
            return (
              <button
                key={estado}
                onClick={() => setModalEstado(estado)}
                className={`flex-1 min-w-[120px] px-3 py-2.5 border rounded-xl text-center transition-all duration-150 flex items-center justify-center gap-1.5 ${cfg.className}`}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px currentColor'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <span className="text-xl font-black font-mono leading-none">{conteoPorEstado[estado]}</span>
                <span className="text-xs font-semibold whitespace-nowrap">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Métricas clave de campaña (las elegidas con el cliente, públicas) ───── */}
      <div className="border rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Métricas de campaña</h3>
            {metricas && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
                {metricas.totalPosteos} posteos · {metricas.totalCreadoresConPosteos} creadores
              </span>
            )}
          </div>
          {campana.estado === 'Activa' && content.length > 0 && (
            <button
              onClick={handleScrapeContent}
              disabled={scrapingContent}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              onMouseEnter={e => { if (!scrapingContent) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
            >
              {scrapingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {scrapingContent ? 'Analizando…' : 'Analizar ahora'}
            </button>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <MetricCard icon={<Eye className="w-4 h-4" />} label="Vistas"
            value={metricas ? fmt(metricas.vistas) : null}
            unavailable={metricas && !metricas.vistasDisponibles
              ? 'Ningún posteo de esta campaña tiene datos de vistas. Instagram sólo mide vistas en video/Reels — los posteos de foto o carrusel no tienen este dato en la plataforma (no está oculto, directamente no existe).'
              : undefined}
            help="Suma de las reproducciones de todos los posteos cargados de la campaña. Sólo existe para video/Reels." />
          <MetricCard icon={<Activity className="w-4 h-4" />} label="Interacciones"
            value={metricas ? fmt(metricas.interacciones) : null}
            help="Suma de likes + comentarios + compartidos + guardados de todos los posteos." />
          <MetricCard icon={<Heart className="w-4 h-4" />} label="Likes"
            value={metricas ? fmt(metricas.likes) : null}
            help="Suma de likes de todos los posteos cargados de la campaña." />
          <MetricCard icon={<MessageCircle className="w-4 h-4" />} label="Comentarios"
            value={metricas ? fmt(metricas.comentarios) : null}
            help="Suma de comentarios de todos los posteos cargados de la campaña." />
          <MetricCard icon={<Share2 className="w-4 h-4" />} label="Compartidos"
            value={metricas ? fmt(metricas.compartidos) : null}
            help="Suma de veces compartido. En TikTok es el conteo público de shares; en Instagram es media_repost_count (veces que resubieron el contenido con Repost, el único agregado público de este tipo que expone la plataforma)." />
          <SentimentCard sentimiento={sentimiento} />
        </div>
      </div>

      {/* ── Posteos de campaña (carga de URLs + tops) ────────────────────────── */}
      <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <button
          type="button"
          onClick={() => setPosteosOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Posteos de campaña</h3>
            {creadoresSinPosteos.length > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
                {creadoresSinPosteos.length} Sin completar
              </span>
            )}
          </div>
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200"
            style={{ color: 'var(--color-text-3)', transform: posteosOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: posteosOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex flex-col gap-4 pt-4">
              {/* Warning: creadores sin posteos cargados */}
              {creadoresSinPosteos.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(252,154,0,0.08)', borderColor: 'rgba(252,154,0,0.3)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgb(180,83,9)' }} />
                  <div className="text-xs" style={{ color: 'rgb(146,64,14)' }}>
                    Las métricas están incompletas porque no se están teniendo en cuenta algunos posteos.
                    Falta cargar{' '}
                    <span className="font-bold">{creadoresSinPosteos.length}</span>{' '}
                    {creadoresSinPosteos.length === 1 ? 'creador' : 'creadores'}:{' '}
                    <span className="font-semibold">{creadoresSinPosteos.map(c => c.nombre).join(', ')}</span>.
                  </div>
                </div>
              )}

              {/* Carga de URLs por creador */}
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface-alt)' }}>
                  <Link2 className="w-3.5 h-3.5" style={{ color: 'var(--color-text-3)' }} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>Posteos por creador</span>
                </div>
                {contentLoading ? (
                  <div className="py-6 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-text-3)' }} /></div>
                ) : campana.ugcs.length === 0 ? (
                  <p className="py-6 text-center text-xs italic" style={{ color: 'var(--color-text-3)' }}>No hay creadores asignados a esta campaña</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    {campana.ugcs.map(uc => {
                      const ugc = ugcs.find(u => u.id === uc.ugcId);
                      if (!ugc) return null;
                      const piezas = content.filter(c => c.creatorId === uc.ugcId);
                      const av = avatarColor(ugc.id);
                      return (
                        <div key={uc.ugcId} className="px-3 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold ${av}`}>{getInitials(ugc.nombre)}</div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
                              {piezas.length} {piezas.length === 1 ? 'posteo' : 'posteos'}
                            </span>
                          </div>

                          {/* Lista de posteos del creador */}
                          {piezas.length > 0 && (
                            <div className="flex flex-col gap-1.5 mb-2">
                              {piezas.map(p => (
                                <div key={p.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
                                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 min-w-0 flex-1 hover:underline" style={{ color: 'var(--color-text-2)' }}>
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{p.url}</span>
                                  </a>
                                  {p.views != null ? (
                                    <span className="font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>
                                      {fmt(p.views)} vistas · {p.engagementRate != null ? `${p.engagementRate}%` : '—'} ER
                                    </span>
                                  ) : p.scrapeError ? (
                                    <span className="font-mono flex-shrink-0 text-rose-500" title={p.scrapeError}>error</span>
                                  ) : (
                                    <span className="font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>sin métricas</span>
                                  )}
                                  <button onClick={() => handleDeleteContent(p.id)} title="Quitar posteo" className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors hover:text-rose-500" style={{ color: 'var(--color-text-3)' }}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Input para agregar URL */}
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={urlInputs[uc.ugcId] || ''}
                              onChange={e => setUrlInputs(prev => ({ ...prev, [uc.ugcId]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(uc.ugcId); }}
                              placeholder="Pegá la URL del posteo (Instagram o TikTok)…"
                              className="flex-1 px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none transition-all duration-200"
                              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
                            />
                            <button
                              onClick={() => handleAddUrl(uc.ugcId)}
                              disabled={!((urlInputs[uc.ugcId] || '').trim()) || addingFor === uc.ugcId}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                              style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
                            >
                              {addingFor === uc.ugcId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                              Agregar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top contenidos por interacción */}
              {metricas && metricas.topContenidos.length > 0 && (
                <div className="border rounded-xl p-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--color-text-3)' }}>Top contenidos · por interacción</p>
                  <div className="flex flex-col">
                    {metricas.topContenidos.slice(0, 5).map((p, i) => {
                      const av = avatarColor(p.creatorId);
                      const platformLogo = p.platform === 'instagram' ? instagramLogo : p.platform === 'tiktok' ? tiktokLogo : null;
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-lg transition-colors duration-150"
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                        >
                          <span className="flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
                            {i + 1}
                          </span>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av}`}>
                            {getInitials(p.creatorNombre)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{p.creatorNombre}</span>
                              {platformLogo && <img src={platformLogo} alt={p.platform} className="w-3 h-3 object-contain flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs mt-0.5">
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                                <ExternalLink className="w-3 h-3" />
                                Ver Posteo
                              </a>
                              <span style={{ color: 'var(--color-border)' }}>·</span>
                              <span className="font-mono" style={{ color: 'var(--color-text-2)' }}>{fmt(p.interacciones)} interacciones</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ranking de Creadores (performance real por creador, ordenable) ──────── */}
      <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <button
          type="button"
          onClick={() => setRankingOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Ranking de Creadores</h3>
            {rankingRows.length > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
                {rankingRows.length} {rankingRows.length === 1 ? 'creador' : 'creadores'}
              </span>
            )}
          </div>
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200"
            style={{ color: 'var(--color-text-3)', transform: rankingOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: rankingOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="pt-4">
              {rankingRows.length === 0 ? (
                <p className="py-10 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>
                  Todavía no hay posteos con métricas cargadas para rankear creadores
                </p>
              ) : (
                <>
                  <div className="hidden sm:block border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-separate border-spacing-0 min-w-[640px]">
                        <thead style={{ backgroundColor: 'var(--color-surface)' }}>
                          <tr>
                            {[
                              { key: 'nombre', label: 'Creador' },
                              { key: 'views', label: 'Vistas' },
                              { key: 'likes', label: 'Likes' },
                              { key: 'comments', label: 'Comentarios' },
                              { key: 'shares', label: 'Compartidos' },
                            ].map(col => (
                              <th key={col.key} onClick={() => handleRankingSort(col.key as RankingSortKey)}
                                className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b cursor-pointer select-none whitespace-nowrap transition-colors duration-200"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                              >
                                <div className="flex items-center gap-1">{col.label}<RankingSortIcon col={col.key as RankingSortKey} /></div>
                              </th>
                            ))}
                            <th onClick={() => handleRankingSort('sentiment')}
                              className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b cursor-pointer select-none whitespace-nowrap transition-colors duration-200"
                              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                            >
                              <div className="flex items-center gap-1">
                                % Sentimiento positivo<RankingSortIcon col="sentiment" />
                                <Tip text="% de comentarios positivos entre los posteos de este creador en esta campaña. Se recalcula al correr 'Analizar ahora'.">
                                  <HelpCircle className="w-3 h-3" />
                                </Tip>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankingRows.map((r, i) => {
                            const av = avatarColor(r.creatorId);
                            return (
                              <tr key={r.creatorId} className="transition-colors duration-150"
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                              >
                                <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-4 text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>{i + 1}</span>
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av}`}>
                                      {getInitials(r.nombre)}
                                    </div>
                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{r.nombre}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{fmt(r.views)}</td>
                                <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{fmt(r.likes)}</td>
                                <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{fmt(r.comments)}</td>
                                <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{fmt(r.shares)}</td>
                                <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>
                                  {r.sentimentSampleSize > 0 ? (
                                    `${r.sentimentPositive}%`
                                  ) : (
                                    <Tip text="Todavía no se calculó el sentimiento por creador para este posteo — correr 'Analizar ahora'.">
                                      <span style={{ color: 'var(--color-border)' }}>—</span>
                                    </Tip>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lista en cards (mobile, < 640px) */}
                  <div className="sm:hidden flex flex-col gap-2.5">
                    {rankingRows.map((r, i) => {
                      const av = avatarColor(r.creatorId);
                      return (
                        <div key={r.creatorId} className="border rounded-xl p-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-4 text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>{i + 1}</span>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av}`}>
                              {getInitials(r.nombre)}
                            </div>
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{r.nombre}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs font-mono" style={{ color: 'var(--color-text-2)' }}>
                            <span>{fmt(r.views)} vistas</span>
                            <span>{fmt(r.likes)} likes</span>
                            <span>{fmt(r.comments)} coment.</span>
                            <span>{fmt(r.shares)} compart.</span>
                            <span>{r.sentimentSampleSize > 0 ? `${r.sentimentPositive}% positivo` : '— sentimiento'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detalle de creadores (tabla completa, filtrable) ─────────────────── */}
      <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <button
          type="button"
          onClick={() => setCreadoresOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Detalle de creadores</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
              {campana.ugcs.length} {campana.ugcs.length === 1 ? 'creador' : 'creadores'}
            </span>
          </div>
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200"
            style={{ color: 'var(--color-text-3)', transform: creadoresOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: creadoresOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => updateParams({ estado: null })}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap border transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)',
                    boxShadow: filterEstado === '' ? '0 0 0 1px var(--color-brand)' : 'none',
                  }}
                >
                  Todos
                </button>
                {ESTADOS_EN.map(e => {
                  const cfg = ESTADO_EN_CAMPANA_CONFIG[e];
                  const isActive = filterEstado === e;
                  return (
                    <button
                      key={e}
                      onClick={() => updateParams({ estado: isActive ? null : e })}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all duration-150 ${cfg.className}`}
                      style={{ opacity: filterEstado && !isActive ? 0.45 : 1, boxShadow: isActive ? '0 0 0 1px var(--color-brand)' : 'none' }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <div className="hidden sm:block border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-0 min-w-[600px]">
                    <thead style={{ backgroundColor: 'var(--color-surface)' }}>
                      <tr>
                        {[
                          { key: 'nombre', label: 'Creador' },
                          { key: 'estado', label: 'Estado' },
                          { key: 'score', label: 'Score' },
                          { key: 'fechaEnvio', label: 'Fecha envío' },
                        ].map(col => (
                          <th key={col.key} onClick={() => handleSort(col.key as SortKey2)}
                            className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b cursor-pointer select-none whitespace-nowrap transition-colors duration-200"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                          >
                            <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key as SortKey2} /></div>
                          </th>
                        ))}
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}>Fecha respuesta</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={6} className="py-10 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>No hay creadores con este filtro</td></tr>
                      ) : rows.map(({ uc, ugc }) => {
                        const sc = scoreColor(ugc!.score);
                        const av = avatarColor(ugc!.id);
                        return (
                          <tr key={uc.ugcId} className="transition-colors duration-150"
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                          >
                            <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${av}`}>
                                  {getInitials(ugc!.nombre)}
                                </div>
                                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{ugc!.nombre}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                              <EstadoSelect value={uc.estado} onChange={next => onUpdateEstadoCreador(campana.id, uc.ugcId, next)} />
                            </td>
                            <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                                  <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${ugc!.score}%` }} />
                                </div>
                                <span className={`text-xs font-mono font-bold ${sc.text}`}>{ugc!.score}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-3)' }}>{uc.fechaEnvio}</td>
                            <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-3)' }}>
                              {uc.fechaRespuesta ?? <span style={{ color: 'var(--color-border)' }}>—</span>}
                            </td>
                            <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                              <button
                                onClick={() => onGoToChat(ugc!)}
                                title="Ir al chat con este creador"
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap"
                                style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#ffe8b5'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'}
                              >
                                <MessageCircle className="w-3 h-3" />
                                Ir al chat
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lista de creadores en cards (mobile, < 640px) */}
              <div className="sm:hidden flex flex-col gap-2.5">
                {rows.length === 0 ? (
                  <p className="py-10 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>No hay creadores con este filtro</p>
                ) : rows.map(({ uc, ugc }) => {
                  const sc = scoreColor(ugc!.score);
                  const av = avatarColor(ugc!.id);
                  return (
                    <div key={uc.ugcId} className="border rounded-xl p-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av}`}>
                            {getInitials(ugc!.nombre)}
                          </div>
                          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{ugc!.nombre}</span>
                        </div>
                        <EstadoSelect value={uc.estado} onChange={next => onUpdateEstadoCreador(campana.id, uc.ugcId, next)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                          <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${ugc!.score}%` }} />
                        </div>
                        <span className={`text-xs font-mono font-bold ${sc.text}`}>{ugc!.score}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs font-mono" style={{ color: 'var(--color-text-3)' }}>
                        <span>Envío: {uc.fechaEnvio}</span>
                        <span>Respuesta: {uc.fechaRespuesta ?? '—'}</span>
                      </div>
                      <button
                        onClick={() => onGoToChat(ugc!)}
                        title="Ir al chat con este creador"
                        className="h-11 flex items-center justify-center gap-1.5 px-2.5 text-xs font-semibold rounded-lg transition-all duration-200"
                        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Ir al chat
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEnvioModal && (
        <ConfirmarEnvioModal
          campana={campana}
          ugcs={ugcs}
          onClose={() => setShowEnvioModal(false)}
        />
      )}

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        itemName={campana.nombre}
        onConfirm={() => { onDeleteCampana(campana); setShowDeleteConfirm(false); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Modal: creadores de una categoría del progreso de campaña, recalificables */}
      {modalEstado && (
        <>
          <div
            className="fixed inset-0 z-50 overlay-enter"
            style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setModalEstado(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div className="rounded-2xl w-full max-w-md pointer-events-auto modal-enter border flex flex-col max-h-[80vh]"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}>
              <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                    <Users className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>{ESTADO_EN_CAMPANA_CONFIG[modalEstado].label}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{modalCreadores.length} creador{modalCreadores.length !== 1 ? 'es' : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalEstado(null)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors duration-200 flex-shrink-0"
                  style={{ color: 'var(--color-text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                {modalCreadores.length === 0 ? (
                  <p className="py-8 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>No hay creadores en esta categoría</p>
                ) : modalCreadores.map(({ uc, ugc }) => {
                  const av = avatarColor(ugc.id);
                  return (
                    <div key={uc.ugcId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av}`}>
                        {getInitials(ugc.nombre)}
                      </div>
                      <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</span>
                      <EstadoSelect value={uc.estado} onChange={next => onUpdateEstadoCreador(campana.id, uc.ugcId, next)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmación de pausa */}
      {showPauseConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 overlay-enter"
            style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowPauseConfirm(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div className="rounded-2xl p-6 max-w-sm w-full pointer-events-auto modal-enter border"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(252,154,0,0.1)' }}>
                <Pause className="w-6 h-6" style={{ color: 'var(--color-brand)' }} />
              </div>
              <h3 className="text-lg font-black mb-1" style={{ color: 'var(--color-text-1)' }}>Pausar campaña</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-2)' }}>
                Vas a pausar <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>"{campana.nombre}"</span>.
                Mientras esté pausada se detienen los envíos y el contacto con creadores. Podés reanudarla cuando quieras.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onTogglePause(campana); setShowPauseConfirm(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold transition-all duration-200 text-sm active:scale-[0.97]"
                  style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
                >
                  <Pause className="w-4 h-4" />
                  Pausar campaña
                </button>
                <button
                  onClick={() => setShowPauseConfirm(false)}
                  className="px-4 py-2.5 border rounded-xl font-semibold transition-all duration-200 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lanzar Modal */}
      {showLanzarModal && (
        <>
          <div
            className="fixed inset-0 z-50 overlay-enter"
            style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!isScraping) setShowLanzarModal(false); }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div className="rounded-2xl p-6 max-w-sm w-full pointer-events-auto modal-enter border max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                {isScraping
                  ? <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--color-brand)' }} />
                  : <Rocket className="w-6 h-6" style={{ color: 'var(--color-brand)' }} />
                }
              </div>
              <h3 className="text-lg font-black mb-1" style={{ color: 'var(--color-text-1)' }}>
                {isScraping ? 'Actualizando métricas...' : 'Confirmar lanzamiento'}
              </h3>
              {isScraping ? (
                <div className="mb-5">
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-2)' }}>
                    Analizando perfiles de los {campana.ugcs.length} creadores asignados con Kernel.
                    Esto puede tardar unos minutos.
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'var(--color-brand)' }} />
                  </div>
                </div>
              ) : scrapeResult ? (
                <div className="mb-5">
                  <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>
                    Métricas actualizadas: <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>{scrapeResult.success}</span> correctos
                    {scrapeResult.failed > 0 && <>, <span className="text-rose-500 font-semibold">{scrapeResult.failed}</span> fallidos</>}.
                    Lanzando la campaña ahora.
                  </p>
                </div>
              ) : (
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-2)' }}>
                  Estás por lanzar <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>"{campana.nombre}"</span>.
                  Se actualizarán las métricas de {campana.ugcs.length} creadores con Kernel antes del envío.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  disabled={isScraping}
                  onClick={async () => {
                    setIsScraping(true);
                    setScrapeResult(null);
                    try {
                      const result = await scrapeCreatorsByCampaign(campana.id);
                      setScrapeResult({ success: result.success.length, failed: result.failed.length });
                    } catch {
                      setScrapeResult({ success: 0, failed: campana.ugcs.length });
                    } finally {
                      setIsScraping(false);
                    }
                    // Show results briefly so the user can see them before the modal closes
                    await new Promise<void>(r => setTimeout(r, 1500));
                    onLanzar(campana);
                    setShowLanzarModal(false);
                    setScrapeResult(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold transition-all duration-200 text-sm active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                  onMouseEnter={e => { if (!isScraping) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
                >
                  {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {isScraping ? 'Analizando...' : 'Lanzar ahora'}
                </button>
                {!isScraping && (
                  <button
                    onClick={() => { setShowLanzarModal(false); setScrapeResult(null); }}
                    className="px-4 py-2.5 border rounded-xl font-semibold transition-all duration-200 text-sm"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
