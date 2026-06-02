import { useState, useEffect } from 'react';
import {
  X, MessageCircle, TrendingUp, Award, ChevronRight, Send,
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, BarChart2, Tv2,
} from 'lucide-react';
import type { UGC, Campana, EvaluacionOrganica, EvaluacionPauta } from '../data';
import { scoreColor, ESTADO_UGC_CONFIG, getInitials, avatarColor, needsInfoUpdate, formatLastScraped } from '../utils';
import { fetchCreatorDetail, updateEvaluacionOrganica, updateEvaluacionPauta } from '../api';

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
}

const ESTADO_ORDER = ['Nuevo', 'Contactado', 'Respondió', 'Calificado', 'Descartado'] as const;

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
function MetricRow({ label, value, unit }: { label: string; value: string | number | undefined; unit?: string }) {
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
  onClose, onAvanzar, onDescartar, onAsignar, onUpdateUGC,
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

  // Pauta form state
  const [pImpresiones, setPImpresiones] = useState('');
  const [pAlcance, setPAlcance] = useState('');
  const [pCPM, setPCPM] = useState('');
  const [pFrecuencia, setPFrecuencia] = useState('');
  const [pCTR, setPCTR] = useState('');
  const [pVTR, setPVTR] = useState('');
  const [pautaSaving, setPautaSaving] = useState(false);
  const [pautaEditing, setPautaEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      try {
        setLoadingDetail(true);
        const detail = await fetchCreatorDetail(ugcProp.id);
        if (!cancelled) {
          const merged = { ...ugcProp, ...detail };
          setUgc(merged);
          // Populate form fields from existing data
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

  // ── Save handlers ────────────────────────────────────────────────────────

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
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${av}`}>
                {getInitials(ugc.nombre)}
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</h2>
                <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>{ugc.bio}</p>
              </div>
            </div>
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

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${estadoConfig.className}`}>
              {estadoConfig.label}
            </span>
            {ugc.seguidores && (
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium border"
                style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)', borderColor: 'var(--color-border)' }}>
                {ugc.seguidores} seguidores
              </span>
            )}
            {needsInfoUpdate(ugc) && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border"
                style={{ backgroundColor: 'rgba(252,154,0,0.08)', borderColor: 'rgba(252,154,0,0.25)', color: 'var(--color-brand)' }}>
                <AlertTriangle className="w-3 h-3" />
                Actualizar información
              </span>
            )}
          </div>

          {/* Score */}
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>Score total</span>
              <span className={`font-mono font-bold text-lg ${sc.text}`}>{ugc.score}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
              <div
                className={`h-full ${sc.bar} rounded-full transition-all duration-700`}
                style={{ width: `${ugc.score}%` }}
              />
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
                  {/* Last scrape info */}
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                      <RefreshCw className="w-3 h-3" />
                      Datos de Kernel
                    </h3>
                    {ugc.evaluacionPerfil ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                            style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'rgb(22,163,74)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            Actualizado {formatLastScraped(ugc.evaluacionPerfil.lastScrapedAt)}
                          </span>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
                          <MetricRow label="Handle" value={ugc.evaluacionPerfil.perfil} />
                          <MetricRow label="Seguidores" value={ugc.evaluacionPerfil.seguidores.toLocaleString('es-AR')} />
                          <MetricRow label="Engagement Rate Cuenta" value={ugc.evaluacionPerfil.engagementRateCuenta} unit="%" />
                          <MetricRow label="Promedio vistas (últimos 5 videos)" value={ugc.evaluacionPerfil.promedioVistaVideos.toLocaleString('es-AR')} />
                          <MetricRow label="Categoría" value={ugc.evaluacionPerfil.categoria} />
                          <MetricRow label="Rango de edad seguidores" value={ugc.evaluacionPerfil.rangoEdadSeguidores} />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                        style={{ backgroundColor: 'rgba(252,154,0,0.06)', borderColor: 'rgba(252,154,0,0.2)' }}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                        <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                          Sin datos de Kernel — se actualizará al iniciar una campaña con este creador.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Score Breakdown */}
                  {ugc.scoreBreakdown && ugc.scoreBreakdown.length > 0 && (
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                        <TrendingUp className="w-3 h-3" />
                        Desglose del Score
                      </h3>
                      <div className="space-y-2.5">
                        {ugc.scoreBreakdown.map((s, i) => (
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
                  )}

                  {/* Qualification Q&A */}
                  {ugc.calificacion && ugc.calificacion.length > 0 && (
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                        <Award className="w-3 h-3" />
                        Respuestas de Calificación
                      </h3>
                      <div className="space-y-3">
                        {ugc.calificacion.map((q, i) => (
                          <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
                            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-3)' }}>{q.pregunta}</p>
                            <p className="text-sm" style={{ color: 'var(--color-text-1)' }}>{q.respuesta}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conversation */}
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
                      <MessageCircle className="w-3 h-3" />
                      Historial de conversación
                    </h3>
                    {!ugc.conversacion || ugc.conversacion.length === 0 ? (
                      <div className="py-6 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>Sin mensajes aún</div>
                    ) : (
                      <div className="space-y-3">
                        {ugc.conversacion.map(m => (
                          <div key={m.id} className={`flex ${m.tipo === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
                              style={m.tipo === 'saliente' ? {
                                backgroundColor: 'var(--color-brand)', color: '#fff', borderTopRightRadius: '4px',
                              } : {
                                backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-1)', borderTopLeftRadius: '4px',
                              }}
                            >
                              <p>{m.texto}</p>
                              <p className="text-[10px] mt-1" style={{ color: m.tipo === 'saliente' ? 'rgba(255,255,255,0.65)' : 'var(--color-text-3)' }}>
                                {m.fecha}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assign to campaign */}
                  {ugc.estado !== 'Descartado' && (
                    <div className="px-6 py-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-3)' }}>
                        Asignar a campaña
                      </h3>
                      <div className="space-y-2">
                        {campanas.filter(c => c.estado !== 'Cerrada').map(c => (
                          <button
                            key={c.id}
                            onClick={() => onAsignar(ugc, c.id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all duration-200"
                            style={ugc.campanasignada === c.nombre ? {
                              borderColor: 'var(--color-brand-border)',
                              backgroundColor: 'var(--color-brand-light)',
                              color: 'var(--color-brand-hover)',
                            } : {
                              borderColor: 'var(--color-border)',
                              backgroundColor: 'var(--color-surface-alt)',
                              color: 'var(--color-text-2)',
                            }}
                          >
                            <span className="font-medium">{c.nombre}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                          </button>
                        ))}
                      </div>
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
                    // Read mode
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
                    // Edit / empty form
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
                    // Read mode
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
                    // Edit / empty form
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
