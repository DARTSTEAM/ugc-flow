import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, TrendingUp, RefreshCw, Users, Loader2, ArrowUp, AlertTriangle } from 'lucide-react';
import { getInitials, avatarColor } from '../utils';
import { fetchRecomendaciones, fetchRefreshStatus, startRecomendacionesRefresh } from '../api';
import type {
  RecomendacionesResponse, RefreshGateStatus,
  FormulaGanadoraMarca, CreadorRecomendado, CreadorEnAlza, ExColaborador,
} from '../data';

type SectionId = 'formula' | 'en-alza' | 'ex-colaboradores';

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

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col p-4 rounded-2xl border transition-all duration-200"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
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

function FormulaCard({ c }: { c: CreadorRecomendado }) {
  return (
    <CardShell>
      <CardHeader
        id={c.creatorId} nombre={c.nombre} username={c.username}
        rightBadge={<span className="font-mono font-bold text-lg flex-shrink-0" style={{ color: 'var(--color-brand)' }}>{c.similarityScore}</span>}
      />
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${c.similarityScore}%`, backgroundColor: 'var(--color-brand)' }} />
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs flex-wrap" style={{ color: 'var(--color-text-2)' }}>
        {c.seguidoresDisplay && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono font-semibold">{c.seguidoresDisplay}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {c.etiquetas.slice(0, 2).map(tag => <Chip key={tag} tone="brand">{tag}</Chip>)}
      </div>
      <CardFooter razon={c.razon} />
    </CardShell>
  );
}

function EnAlzaCard({ c }: { c: CreadorEnAlza }) {
  return (
    <CardShell>
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

function ExColaboradorCard({ c }: { c: ExColaborador }) {
  return (
    <CardShell>
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

export default function RecomendacionesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get('section') as SectionId | null) ?? 'formula';

  const [data, setData] = useState<RecomendacionesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<RefreshGateStatus | null>(null);
  const pollRef = useRef<number | null>(null);

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

  const formulaCount = data?.formulaGanadora.reduce((acc, b) => acc + b.recomendados.length, 0) ?? 0;
  const enAlzaCount = data?.enAlza.creadores.length ?? 0;
  const exColaboradoresCount = data?.exColaboradores.length ?? 0;

  const SECTIONS = [
    { id: 'formula' as SectionId, label: 'Fórmula ganadora', icon: Trophy, count: formulaCount,
      desc: 'Perfil de tus creadores con mejor rendimiento real por marca, matcheado contra candidatos sin contactar' },
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
              onClick={() => updateParams({ section: sec.id === 'formula' ? null : sec.id })}
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

      {/* Descripción de sección */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        {(() => { const Icon = currentSection.icon; return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />; })()}
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{currentSection.desc}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-3)' }} />
        </div>
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="No se pudieron cargar las recomendaciones" desc={error} />
      ) : section === 'formula' ? (
        !data?.formulaGanadora.length ? (
          <EmptyState
            icon={Trophy}
            title="Todavía no hay suficiente data por marca"
            desc="Cargá posteos con métricas en Campañas → Contenido para al menos 3 creadores de una marca — así esta sección puede calcular qué perfil funciona mejor."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {data.formulaGanadora.map(b => (
              <div key={b.brandId} className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <Trophy className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>{b.brandName}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                      Perfil ganador (basado en {b.perfilGanador.basadoEnCreadores} creadores)
                      {b.perfilGanador.etiquetas.length > 0 && ` · ${b.perfilGanador.etiquetas.join(', ')}`}
                      {b.perfilGanador.categoria && ` · ${b.perfilGanador.categoria}`}
                      {b.perfilGanador.seguidoresTier && ` · ${b.perfilGanador.seguidoresTier}`}
                      {` · ${b.perfilGanador.platform === 'tiktok' ? 'TikTok' : 'Instagram'}`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {b.recomendados.map(c => <FormulaCard key={c.creatorId} c={c} />)}
                </div>
              </div>
            ))}
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
            {data.enAlza.creadores.map(c => <EnAlzaCard key={c.creatorId} c={c} />)}
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
            {data.exColaboradores.map(c => <ExColaboradorCard key={c.creatorId} c={c} />)}
          </div>
        )
      )}
    </div>
  );
}
