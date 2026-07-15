import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy, TrendingUp, RefreshCw, Users, Loader2, ArrowUp, AlertTriangle, HelpCircle,
  X, Sparkles, CheckCircle2, BarChart3, ArrowUpDown,
} from 'lucide-react';
import { getInitials, avatarColor } from '../utils';
import { fetchRecomendaciones, fetchRefreshStatus, startRecomendacionesRefresh } from '../api';
import type {
  RecomendacionesResponse, RefreshGateStatus,
  CreadorTop, CreadorEnAlza, ExColaborador,
  UGC, Campana,
} from '../data';
import UGCDrawer, { type RecomendacionDrawerContext } from './UGCDrawer';

interface Props {
  ugcs: UGC[];
  campanas: Campana[];
  onUpdateUGC: (ugc: UGC) => void;
  onAsignar: (ugc: UGC, campanaId: string) => void;
  onGoToChat: (ugc: UGC) => void;
}

type SectionId = 'top-creadores' | 'en-alza' | 'ex-colaboradores';

const POLL_INTERVAL_MS = 12_000;

function formatEta(nextEligibleAt: string | null): string {
  if (!nextEligibleAt) return '';
  const ms = new Date(nextEligibleAt).getTime() - Date.now();
  if (ms <= 0) return 'ya disponible';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface HelpPoint { label: string; value: string; colorClass: string; }
interface HelpStep { icon: React.ElementType; colorClass: string; title: string; desc: string; points?: HelpPoint[]; }
interface HelpExample { nombre: string; bullets: HelpPoint[]; total: string; conclusion: string; }
interface SectionHelp { intro: string; steps: HelpStep[]; example: HelpExample; }

const SECTION_HELP: Record<SectionId, SectionHelp> = {
  'top-creadores': {
    intro: 'Ranking histórico de tus mejores creadores, cruzando todas las campañas ya terminadas.',
    steps: [
      {
        icon: Trophy, colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-600 dark:text-amber-400',
        title: 'Toma a los que ya trabajaron y terminaron campaña',
        desc: 'Busca creadores que estuvieron Activo en al menos una campaña con status Cerrada, y que tengan posteos con métricas reales cargados en Campañas → Contenido para esa campaña.',
      },
      {
        icon: Users, colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-600 dark:text-sky-400',
        title: 'Mide su rendimiento real',
        desc: 'Calcula el ER real promedio de sus posteos, comparado contra el resto de los creadores DE SU MISMA plataforma (nunca se compara un ER de Instagram contra uno de TikTok — las escalas son muy distintas). Ese lugar en la comparación es su percentil de rendimiento, de 0 a 100.',
      },
      {
        icon: Sparkles, colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300',
        title: 'Combina score de perfil + rendimiento real',
        desc: 'El score final es la suma de dos mitades:',
        points: [
          { label: 'Score de perfil (el de siempre: seguidores, ER, frecuencia, orgánico, pauta)', value: 'hasta 50pts', colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300' },
          { label: 'Percentil de ER real en campañas terminadas', value: 'hasta 50pts', colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300' },
        ],
      },
      {
        icon: CheckCircle2, colorClass: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-600 dark:text-emerald-400',
        title: 'Ordena de mayor a menor',
        desc: 'Se muestran hasta los 12 creadores con mayor score final. Sin métricas reales cargadas, un creador no entra a este ranking — acá se mide performance comprobada, no participación.',
      },
    ],
    example: {
      nombre: 'Camila R. — ejemplo, no es un creador real',
      bullets: [
        { label: 'Score de perfil 78/100 (78 × 0.5)', value: '39pts', colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300' },
        { label: 'ER real 4.2% → percentil 80 en Instagram (80 × 0.5)', value: '40pts', colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300' },
      ],
      total: '79 / 100 puntos',
      conclusion: 'Camila R. aparecería cerca del primer puesto del ranking, ordenada junto al resto por su score final.',
    },
  },
  'en-alza': {
    intro: 'Detecta creadores con crecimiento real comparando dos momentos en el tiempo.',
    steps: [
      {
        icon: RefreshCw, colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-600 dark:text-amber-400',
        title: 'Cada actualización guarda una foto',
        desc: 'Al presionar "Actualizar tendencias" se re-escanea Instagram/TikTok y se guarda una foto fechada (snapshot) de las métricas de cada creador del watchlist (Activo, En Negociación, Disponible, Inactivo).',
      },
      {
        icon: TrendingUp, colorClass: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-600 dark:text-emerald-400',
        title: 'Compara las últimas 2 fotos',
        desc: 'Hace falta al menos 2 actualizaciones registradas para poder calcular una diferencia — con sólo 1 no hay nada para comparar todavía.',
      },
      {
        icon: Sparkles, colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300',
        title: 'Calcula un score de momentum',
        desc: 'Suma tres variaciones, cada una con un tope máximo:',
        points: [
          { label: '% de crecimiento de seguidores', value: 'hasta 50pts', colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300' },
          { label: 'Variación de engagement rate ×6', value: 'hasta 30pts', colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300' },
          { label: 'Nuevos videos virales ×10', value: 'hasta 20pts', colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300' },
        ],
      },
      {
        icon: CheckCircle2, colorClass: 'bg-emerald-50 dark:bg-emerald-300/10 text-emerald-600 dark:text-emerald-400',
        title: 'Sólo lo positivo',
        desc: 'Si un creador no tuvo ningún crecimiento neto, simplemente no aparece en esta lista — no se muestran caídas.',
      },
    ],
    example: {
      nombre: 'Marco T. — ejemplo, no es un creador real',
      bullets: [
        { label: 'Seguidores: 50.000 → 54.000 (+8%)', value: '8pts', colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300' },
        { label: 'ER: 2.0% → 2.8% (+0.8pts × 6)', value: '4.8pts', colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300' },
        { label: 'Videos virales: 1 → 3 (+2 × 10)', value: '20pts', colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300' },
      ],
      total: '≈33 puntos de momentum',
      conclusion: 'Marco T. aparecería en "En alza", ordenado junto a otros creadores con crecimiento neto positivo desde la última actualización.',
    },
  },
  'ex-colaboradores': {
    intro: 'Vuelve a poner en el radar a quienes ya funcionaron, pero hoy están sin campaña.',
    steps: [
      {
        icon: RefreshCw, colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-600 dark:text-amber-400',
        title: 'Busca creadores Inactivos',
        desc: 'Ya trabajaron en alguna campaña (estuvieron Activo), pero hoy no tienen ninguna asignación vigente — ni Activo, ni Disponible, ni En Negociación en ninguna campaña abierta.',
      },
      {
        icon: BarChart3, colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-600 dark:text-sky-400',
        title: 'Mide su performance real',
        desc: 'Engagement rate promedio y total de interacciones (likes + comentarios + compartidos + guardados) en los posteos cargados en Campañas → Contenido.',
      },
      {
        icon: ArrowUpDown, colorClass: 'bg-violet-100 dark:bg-violet-300/10 text-violet-700 dark:text-violet-300',
        title: 'Ordena por resultado',
        desc: 'Primero los que tienen métricas reales cargadas, con mejor ER arriba. Los que todavía no tienen contenido cargado quedan al final, sin ordenar por número.',
      },
    ],
    example: {
      nombre: 'Valentina G. — ejemplo, no es un creador real',
      bullets: [
        { label: '3 posteos con ER 5.2%, 3.8% y 4.5%', value: 'prom. 4.5%', colorClass: 'bg-sky-50 dark:bg-sky-300/10 text-sky-700 dark:text-sky-300' },
        { label: 'Interacciones totales en esos 3 posteos', value: '12.400', colorClass: 'bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300' },
      ],
      total: 'ER promedio: 4.5%',
      conclusion: 'Valentina G. aparecería arriba en la lista, antes que otro ex-colaborador sin posteos cargados — porque tiene métricas reales para ordenar.',
    },
  },
};

function HelpModal({ section, sectionLabel, sectionIcon: SectionIcon, onClose }: {
  section: SectionId; sectionLabel: string; sectionIcon: React.ElementType; onClose: () => void;
}) {
  const help = SECTION_HELP[section];
  return (
    <>
      <div
        className="fixed inset-0 z-50 overlay-enter"
        style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className="rounded-2xl w-full max-w-lg pointer-events-auto modal-enter border flex flex-col max-h-[85vh]"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                <SectionIcon className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Cómo se calcula: {sectionLabel}</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{help.intro}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-200 flex-shrink-0"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {help.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${step.colorClass}`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>{step.title}</p>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--color-text-2)' }}>{step.desc}</p>
                  {step.points && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {step.points.map(p => (
                        <span key={p.label} className={`px-2 py-1 rounded-md text-[10px] font-semibold ${p.colorClass}`}>
                          {p.label} · {p.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="p-3.5 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-alt)' }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: 'var(--color-brand)' }}>Ejemplo (creador ficticio)</p>
              </div>
              <p className="text-xs font-bold mb-2.5" style={{ color: 'var(--color-text-1)' }}>{help.example.nombre}</p>
              <div className="flex flex-col gap-1.5 mb-2.5">
                {help.example.bullets.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                    <span style={{ color: 'var(--color-text-2)' }}>{b.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${b.colorClass}`}>{b.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--color-text-1)' }}>Total</span>
                <span className="text-sm font-black" style={{ color: 'var(--color-brand)' }}>{help.example.total}</span>
              </div>
              <p className="text-[11px] leading-relaxed mt-2.5" style={{ color: 'var(--color-text-3)' }}>{help.example.conclusion}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'brand' | 'amber' }) {
  const style =
    tone === 'brand'
      ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)' }
      : tone === 'amber'
      ? undefined
      : { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' };
  const className =
    tone === 'amber'
      ? 'px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20'
      : 'px-1.5 py-0.5 rounded-md text-[10px] font-semibold';
  return <span className={className} style={style}>{children}</span>;
}

function CardShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      className="flex flex-col p-4 rounded-2xl border select-none"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: hovered ? 'var(--color-brand)' : 'var(--color-border)',
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

function CardHeader({ id, nombre, username, rightBadge }: { id: string; nombre: string; username: string | null; rightBadge?: React.ReactNode }) {
  const av = avatarColor(id);
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${av}`}>
        {getInitials(nombre)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text-1)' }}>{nombre}</p>
        {username && <p className="text-[11px] font-mono truncate" style={{ color: 'var(--color-text-3)' }}>@{username}</p>}
      </div>
      {rightBadge}
    </div>
  );
}

function CardFooter({ razon }: { razon: string }) {
  return (
    <div className="mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>{razon}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
        <Icon className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>{title}</p>
      <p className="text-xs text-center max-w-sm" style={{ color: 'var(--color-text-3)' }}>{desc}</p>
    </div>
  );
}

function TopCreadorCard({ c, onClick }: { c: CreadorTop; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <CardHeader
        id={c.creatorId} nombre={c.nombre} username={c.username}
        rightBadge={<span className="font-mono font-bold text-lg flex-shrink-0" style={{ color: 'var(--color-brand)' }}>{c.finalScore}</span>}
      />
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${c.finalScore}%`, backgroundColor: 'var(--color-brand)' }} />
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs flex-wrap" style={{ color: 'var(--color-text-2)' }}>
        {c.seguidoresDisplay && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono font-semibold">{c.seguidoresDisplay}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 flex-shrink-0" />
          <span className="font-mono font-semibold">{c.avgEngagementRate.toFixed(1)}% ER real</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Chip>{c.totalCampanasTerminadas} campaña{c.totalCampanasTerminadas > 1 ? 's' : ''} terminada{c.totalCampanasTerminadas > 1 ? 's' : ''}</Chip>
        {c.marcas.slice(0, 2).map(b => <Chip key={b} tone="brand">{b}</Chip>)}
      </div>
      <CardFooter razon={c.razon} />
    </CardShell>
  );
}

function EnAlzaCard({ c, onClick }: { c: CreadorEnAlza; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <CardHeader
        id={c.creatorId} nombre={c.nombre} username={c.username}
        rightBadge={<span className="font-mono font-bold text-lg flex-shrink-0 text-emerald-600 dark:text-emerald-400">{Math.round(c.momentumScore)}</span>}
      />
      <div className="flex items-center gap-3 mb-3 text-xs flex-wrap" style={{ color: 'var(--color-text-2)' }}>
        {c.deltaFollowersPct > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ArrowUp className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono font-semibold">{c.deltaFollowersPct.toFixed(1)}% seguidores</span>
          </div>
        )}
        {c.deltaEngagementRate > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono font-semibold">+{c.deltaEngagementRate.toFixed(1)}pts ER</span>
          </div>
        )}
        {c.deltaVideosVirales > 0 && (
          <Chip tone="amber">+{c.deltaVideosVirales} virales</Chip>
        )}
      </div>
      <CardFooter razon={c.razon} />
    </CardShell>
  );
}

function ExColaboradorCard({ c, onClick }: { c: ExColaborador; onClick: () => void }) {
  return (
    <CardShell onClick={onClick}>
      <CardHeader
        id={c.creatorId} nombre={c.nombre} username={c.username}
        rightBadge={c.avgEngagementRate != null
          ? <span className="font-mono font-bold text-lg flex-shrink-0" style={{ color: 'var(--color-text-1)' }}>{c.avgEngagementRate}%</span>
          : undefined}
      />
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {c.totalPosts > 0 && <Chip>{c.totalPosts} posteo{c.totalPosts > 1 ? 's' : ''}</Chip>}
        {c.brandsHistoricos.slice(0, 2).map(b => <Chip key={b} tone="brand">{b}</Chip>)}
        <Chip tone="amber">Inactivo</Chip>
      </div>
      <CardFooter razon={c.razon} />
    </CardShell>
  );
}

export default function RecomendacionesTab({ ugcs, campanas, onUpdateUGC, onAsignar, onGoToChat }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get('section') as SectionId | null) ?? 'top-creadores';

  const [data, setData] = useState<RecomendacionesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<RefreshGateStatus | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selected, setSelected] = useState<{ ugc: UGC; context: RecomendacionDrawerContext } | null>(null);
  const pollRef = useRef<number | null>(null);

  /** Busca el UGC completo (ya cargado en App) y abre el drawer con el desglose de por qué apareció acá. */
  function openDetalle(creatorId: string, context: RecomendacionDrawerContext) {
    const ugc = ugcs.find(u => u.id === creatorId);
    if (!ugc) return;
    setSelected({ ugc, context });
  }

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

  const loadData = useCallback(() => {
    fetchRecomendaciones()
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const loadGate = useCallback(() => {
    fetchRefreshStatus().then(setGate).catch(() => {});
  }, []);

  useEffect(() => { loadData(); loadGate(); }, [loadData, loadGate]);

  // Mientras haya una corrida en marcha, poll de estado; al terminar, refetch de datos.
  useEffect(() => {
    if (gate?.status !== 'running') {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = window.setInterval(async () => {
      const fresh = await fetchRefreshStatus().catch(() => null);
      if (!fresh) return;
      setGate(fresh);
      if (fresh.status !== 'running') loadData();
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [gate?.status, loadData]);

  async function handleRefreshClick() {
    const result = await startRecomendacionesRefresh().catch(err => { setError(err.message); return null; });
    if (result) loadGate();
  }

  const topCreadoresCount = data?.topCreadores.creadores.length ?? 0;
  const enAlzaCount = data?.enAlza.creadores.length ?? 0;
  const exColaboradoresCount = data?.exColaboradores.length ?? 0;

  const SECTIONS = [
    { id: 'top-creadores' as SectionId, label: 'Top Creadores', icon: Trophy, count: topCreadoresCount,
      desc: 'Ranking histórico ponderado — score de perfil + rendimiento real en campañas terminadas' },
    { id: 'en-alza' as SectionId, label: 'En alza', icon: TrendingUp, count: enAlzaCount,
      desc: 'Creadores con crecimiento reciente de seguidores, engagement o videos virales' },
    { id: 'ex-colaboradores' as SectionId, label: 'Ex-colaboradores', icon: RefreshCw, count: exColaboradoresCount,
      desc: 'Trabajaron antes y hoy no tienen campaña vigente — rankeados por su performance real' },
  ];
  const currentSection = SECTIONS.find(s => s.id === section)!;

  const refreshDisabled = !gate || gate.status !== 'idle';
  const refreshLabel =
    gate?.status === 'running' ? 'Actualizando…' :
    gate?.status === 'cooldown' ? `Disponible en ${formatEta(gate.nextEligibleAt)}` :
    'Actualizar tendencias';

  return (
    <div className="flex flex-col gap-4">

      {/* Control de refresh on-demand (alimenta "En alza") */}
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border flex-wrap"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <RefreshCw className={`w-4 h-4 flex-shrink-0 ${gate?.status === 'running' ? 'animate-spin' : ''}`} style={{ color: 'var(--color-brand)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {gate?.status === 'running' && 'Analizando creadores Activo / En Negociación / Inactivo con Kernel — puede tardar varios minutos.'}
            {gate?.status === 'cooldown' && 'Ya se actualizó en las últimas 24hs. Las tendencias recién cambian de forma significativa pasado ese tiempo.'}
            {gate?.status === 'idle' && 'Re-escanea Instagram/TikTok de los creadores con relación vigente para detectar tendencias.'}
            {!gate && 'Cargando estado del refresh…'}
          </p>
        </div>
        <button
          onClick={handleRefreshClick}
          disabled={refreshDisabled}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-[0.97] flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-brand)', color: '#fff', borderColor: 'var(--color-brand)' }}
        >
          {gate?.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {refreshLabel}
        </button>
      </div>

      {/* Section switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          const isActive = section === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => updateParams({ section: sec.id === 'top-creadores' ? null : sec.id })}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-[0.97]"
              style={isActive ? {
                backgroundColor: 'var(--color-brand)', color: '#fff', borderColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)',
              } : {
                backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', borderColor: 'var(--color-border)',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'; }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {sec.label}
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={isActive ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' } : { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' }}
              >
                {sec.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Descripción de sección + botón "Cómo se calcula" (dos divs, misma row) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border flex-1 min-w-0" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {(() => { const Icon = currentSection.icon; return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />; })()}
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{currentSection.desc}</p>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          title="Cómo se calcula"
          className="group flex items-center px-3 py-2.5 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] flex-shrink-0"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
        >
          <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="grid grid-cols-[0fr] group-hover:grid-cols-[1fr] transition-[grid-template-columns] duration-200 ease-out">
            <span className="overflow-hidden whitespace-nowrap">
              <span className="pl-2">Cómo se calcula</span>
            </span>
          </span>
        </button>
      </div>

      {helpOpen && (
        <HelpModal
          section={section}
          sectionLabel={currentSection.label}
          sectionIcon={currentSection.icon}
          onClose={() => setHelpOpen(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-3)' }} />
        </div>
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="No se pudieron cargar las recomendaciones" desc={error} />
      ) : section === 'top-creadores' ? (
        !data?.topCreadores.disponible || data.topCreadores.creadores.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Todavía no hay creadores con historial real"
            desc="Esta sección necesita al menos un creador que haya estado Activo en una campaña Cerrada y tenga posteos con métricas cargados en Campañas → Contenido."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <Trophy className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>Ranking histórico</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                  {data.topCreadores.creadores.length} creador{data.topCreadores.creadores.length > 1 ? 'es' : ''} con historial real en campañas terminadas · score de perfil 50% + rendimiento real 50%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.topCreadores.creadores.map(c => (
                <TopCreadorCard
                  key={c.creatorId} c={c}
                  onClick={() => openDetalle(c.creatorId, {
                    titulo: 'Por qué aparece en Top Creadores',
                    razon: c.razon,
                    rows: c.breakdown,
                  })}
                />
              ))}
            </div>
          </div>
        )
      ) : section === 'en-alza' ? (
        !data?.enAlza.disponible ? (
          <EmptyState
            icon={TrendingUp}
            title="Todavía no hay tendencias"
            desc="Esta sección se activa después de correr “Actualizar tendencias” al menos dos veces — hace falta más de una foto en el tiempo para medir crecimiento."
          />
        ) : data.enAlza.creadores.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Sin creadores en alza por ahora"
            desc="Ningún creador del watchlist mostró crecimiento neto desde la última actualización."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.enAlza.creadores.map(c => (
              <EnAlzaCard
                key={c.creatorId} c={c}
                onClick={() => openDetalle(c.creatorId, {
                  titulo: 'Por qué aparece en En alza',
                  razon: c.razon,
                  rows: c.breakdown,
                })}
              />
            ))}
          </div>
        )
      ) : (
        !data?.exColaboradores.length ? (
          <EmptyState
            icon={RefreshCw}
            title="Sin ex-colaboradores por ahora"
            desc="Todavía no hay creadores marcados como Inactivo — es decir, que trabajaron antes pero no tienen campaña vigente hoy."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.exColaboradores.map(c => (
              <ExColaboradorCard
                key={c.creatorId} c={c}
                onClick={() => openDetalle(c.creatorId, {
                  titulo: 'Por qué aparece en Ex-colaboradores',
                  razon: c.razon,
                  rows: [
                    { label: 'ER promedio', value: c.avgEngagementRate != null ? `${c.avgEngagementRate}%` : null, pts: null, max: null },
                    { label: 'Interacciones totales', value: c.totalInteracciones > 0 ? c.totalInteracciones.toLocaleString('es-PE') : null, pts: null, max: null },
                    { label: 'Posteos con métricas', value: `${c.totalPosts}`, pts: null, max: null },
                    { label: 'Marcas con las que trabajó', value: c.brandsHistoricos.length ? c.brandsHistoricos.join(', ') : null, pts: null, max: null },
                  ],
                })}
              />
            ))}
          </div>
        )
      )}

      {selected && (
        <UGCDrawer
          ugc={selected.ugc}
          campanas={campanas}
          recomendacionContext={selected.context}
          onClose={() => setSelected(null)}
          onAsignar={onAsignar}
          onUpdateUGC={onUpdateUGC}
          onGoToChat={onGoToChat}
        />
      )}
    </div>
  );
}
