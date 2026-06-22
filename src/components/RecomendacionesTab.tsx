import { useMemo, useState } from 'react';
import type { UGC, Campana } from '../data';
import { Star, Users, TrendingUp, RefreshCw, Lightbulb, Trophy } from 'lucide-react';
import { scoreColor, getInitials, avatarColor, ESTADO_UGC_CONFIG } from '../utils';

interface Props {
  ugcs: UGC[];
  campanas: Campana[];
}

type SectionId = 'top' | 'sin-evaluar' | 'reengagement';

function parseFollowersNum(ugc: UGC): number {
  const exact = ugc.evaluacionPerfil?.seguidores;
  if (exact) return exact;
  const s = ugc.seguidores;
  if (!s) return 0;
  const lower = s.toLowerCase().replace(',', '.');
  if (lower.endsWith('k')) return parseFloat(lower) * 1000;
  if (lower.endsWith('m')) return parseFloat(lower) * 1000000;
  return parseInt(lower, 10) || 0;
}

function formatFollowers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function getRazonTop(ugc: UGC): string {
  const parts: string[] = [];
  const er = ugc.evaluacionPerfil?.engagementRateCuenta;
  if (er && er > 3) parts.push(`ER ${er.toFixed(1)}% en IG`);
  if (ugc.evaluacionPauta?.completado) parts.push('Historial de pauta');
  else if (ugc.evaluacionOrganica?.completado) parts.push('Orgánico evaluado');
  const seg = ugc.evaluacionPerfil?.seguidores;
  if (seg && seg > 30000) parts.push(`${(seg / 1000).toFixed(0)}k en Instagram`);
  if (parts.length === 0) {
    const followers = parseFollowersNum(ugc);
    if (followers > 0) parts.push(`${formatFollowers(followers)} seguidores`);
    else parts.push('Mayor score del catálogo');
  }
  return parts.slice(0, 2).join(' · ');
}

function getRazonSinEvaluar(ugc: UGC): string {
  const followers = parseFollowersNum(ugc);
  const parts: string[] = [];
  if (followers > 0) parts.push(`${formatFollowers(followers)} seguidores`);
  const cat = ugc.evaluacionPerfil?.categoria;
  if (cat) {
    parts.push(cat);
  } else if (ugc.bio) {
    const bioFragment = ugc.bio.split('|')[0].trim().split('&')[0].trim().slice(0, 28);
    if (bioFragment.length > 3) parts.push(bioFragment);
  }
  if (parts.length === 0) parts.push('Pendiente de evaluación completa');
  return parts.slice(0, 2).join(' · ');
}

function getRazonReengagement(ugc: UGC, campanas: Campana[]): string {
  const closed = campanas.filter(c =>
    c.estado === 'Cerrada' &&
    c.ugcs.some(cu => cu.ugcId === ugc.id && cu.estado === 'Calificado')
  );
  if (closed.length === 0) return 'Historial confirmado en campañas anteriores';
  const marcas = [...new Set(closed.map(c => c.marca || c.nombre.split(' - ')[0]))];
  return `${closed.length} campaña${closed.length > 1 ? 's' : ''} exitosa${closed.length > 1 ? 's' : ''} · ${marcas.slice(0, 2).join(', ')}`;
}

export default function RecomendacionesTab({ ugcs, campanas }: Props) {
  const [section, setSection] = useState<SectionId>('top');
  const [filterEtiqueta, setFilterEtiqueta] = useState('');

  const allEtiquetas = useMemo(() => {
    const set = new Set<string>();
    ugcs.forEach(u => u.etiquetas?.forEach(e => set.add(e)));
    return [...set].sort();
  }, [ugcs]);

  // IDs de UGCs calificados en campañas cerradas
  const ugcsEnCerradasCalificados = useMemo(() => {
    const set = new Set<string>();
    campanas.forEach(c => {
      if (c.estado === 'Cerrada') {
        c.ugcs.forEach(cu => {
          if (cu.estado === 'Calificado') set.add(cu.ugcId);
        });
      }
    });
    return set;
  }, [campanas]);

  // Sección 1: Top por score
  const topCreadores = useMemo(() => {
    return ugcs
      .filter(u => u.score > 0 && u.estado !== 'Descartado')
      .filter(u => !filterEtiqueta || u.etiquetas?.includes(filterEtiqueta))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [ugcs, filterEtiqueta]);

  // Sección 2: Alto potencial, no calificados
  const sinEvaluar = useMemo(() => {
    return ugcs
      .filter(u =>
        u.estado !== 'Descartado' &&
        u.score < 50 &&
        (u.estado === 'Nuevo' || u.estado === 'Contactado' || u.estado === 'Respondió') &&
        parseFollowersNum(u) >= 10000
      )
      .sort((a, b) => parseFollowersNum(b) - parseFollowersNum(a))
      .slice(0, 9);
  }, [ugcs]);

  // Sección 3: Probados en campañas cerradas
  const reengagement = useMemo(() => {
    return ugcs
      .filter(u => ugcsEnCerradasCalificados.has(u.id) && u.estado !== 'Descartado')
      .sort((a, b) => b.score - a.score)
      .slice(0, 9);
  }, [ugcs, ugcsEnCerradasCalificados]);

  const SECTIONS = [
    {
      id: 'top' as SectionId,
      label: 'Mejores del catálogo',
      icon: Trophy,
      count: topCreadores.length,
      desc: 'Creadores rankeados por score total — los más confiables para tu próxima campaña',
    },
    {
      id: 'sin-evaluar' as SectionId,
      label: 'A evaluar',
      icon: Lightbulb,
      count: sinEvaluar.length,
      desc: 'Alcance significativo pero sin calificación completa — potencial sin aprovechar',
    },
    {
      id: 'reengagement' as SectionId,
      label: 'Ex-colaboradores',
      icon: RefreshCw,
      count: reengagement.length,
      desc: 'Calificados en campañas anteriores cerradas — trayectoria probada con la marca',
    },
  ];

  const currentSection = SECTIONS.find(s => s.id === section)!;
  const currentItems =
    section === 'top' ? topCreadores :
    section === 'sin-evaluar' ? sinEvaluar :
    reengagement;

  return (
    <div className="flex flex-col gap-4">

      {/* Section switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          const isActive = section === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setSection(sec.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-[0.97]"
              style={isActive ? {
                backgroundColor: 'var(--color-brand)',
                color: '#fff',
                borderColor: 'var(--color-brand)',
                boxShadow: 'var(--shadow-btn-brand)',
              } : {
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-2)',
                borderColor: 'var(--color-border)',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'; }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {sec.label}
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={isActive
                  ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' }
                }
              >
                {sec.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Etiqueta filter — solo en sección top */}
      {section === 'top' && allEtiquetas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-3)' }}>Etiqueta:</span>
          <button
            onClick={() => setFilterEtiqueta('')}
            className="px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all duration-150"
            style={!filterEtiqueta ? {
              borderColor: 'var(--color-brand)',
              backgroundColor: 'var(--color-brand-light)',
              color: 'var(--color-brand-hover)',
            } : {
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-2)',
            }}
          >
            Todos
          </button>
          {allEtiquetas.map(e => (
            <button
              key={e}
              onClick={() => setFilterEtiqueta(filterEtiqueta === e ? '' : e)}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all duration-150"
              style={filterEtiqueta === e ? {
                borderColor: 'var(--color-brand)',
                backgroundColor: 'var(--color-brand-light)',
                color: 'var(--color-brand-hover)',
              } : {
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-2)',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Descripción de sección */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {(() => { const Icon = currentSection.icon; return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />; })()}
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{currentSection.desc}</p>
      </div>

      {/* Grid de cards */}
      {currentItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            {section === 'top'
              ? <Trophy className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
              : section === 'sin-evaluar'
              ? <Lightbulb className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
              : <RefreshCw className="w-6 h-6" style={{ color: 'var(--color-text-3)' }} />
            }
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>Sin resultados</p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-3)' }}>
            {section === 'top' && (filterEtiqueta
              ? `No hay creadores con la etiqueta "${filterEtiqueta}"`
              : 'Evaluá creadores para ver recomendaciones'
            )}
            {section === 'sin-evaluar' && 'No hay creadores con alto alcance pendientes de calificación completa'}
            {section === 'reengagement' && 'Aún no hay campañas cerradas con participación calificada'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentItems.map((u, index) => {
            const av = avatarColor(u.id);
            const sc = scoreColor(u.score);
            const estadoCfg = ESTADO_UGC_CONFIG[u.estado];
            const followers = parseFollowersNum(u);
            const followersDisplay = followers > 0 ? formatFollowers(followers) : (u.seguidores || null);
            const er = u.evaluacionPerfil?.engagementRateCuenta;
            const erTk = u.evaluacionPerfilTiktok?.engagementRate;

            const razon =
              section === 'top' ? getRazonTop(u) :
              section === 'sin-evaluar' ? getRazonSinEvaluar(u) :
              getRazonReengagement(u, campanas);

            const cerradasCalificadas = campanas.filter(c =>
              c.estado === 'Cerrada' &&
              c.ugcs.some(cu => cu.ugcId === u.id && cu.estado === 'Calificado')
            );

            return (
              <div
                key={u.id}
                className="flex flex-col p-4 rounded-2xl border transition-all duration-200"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${av}`}>
                      {getInitials(u.nombre)}
                    </div>
                    {section === 'top' && (
                      <span
                        className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: index < 3 ? 'var(--color-brand)' : 'var(--color-text-3)' }}
                      >
                        {index + 1}
                      </span>
                    )}
                    {section === 'reengagement' && cerradasCalificadas.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-amber-500"
                      >
                        {cerradasCalificadas.length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text-1)' }}>{u.nombre}</p>
                    {u.username && (
                      <p className="text-[11px] font-mono truncate" style={{ color: 'var(--color-text-3)' }}>@{u.username}</p>
                    )}
                  </div>
                  {u.score > 0 && (
                    <span className={`font-mono font-bold text-lg flex-shrink-0 ${sc.text}`}>{u.score}</span>
                  )}
                </div>

                {/* Score bar */}
                {u.score > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className={`h-full ${sc.bar} rounded-full transition-all`} style={{ width: `${u.score}%` }} />
                    </div>
                  </div>
                )}

                {/* Métricas */}
                <div className="flex items-center gap-3 mb-3 text-xs flex-wrap" style={{ color: 'var(--color-text-2)' }}>
                  {followersDisplay && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono font-semibold">{followersDisplay}</span>
                    </div>
                  )}
                  {er !== undefined && er !== null && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono font-semibold">{er}% IG</span>
                    </div>
                  )}
                  {erTk !== undefined && erTk !== null && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono font-semibold">{erTk}% TK</span>
                    </div>
                  )}
                  {section === 'reengagement' && cerradasCalificadas.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 flex-shrink-0 text-amber-500" />
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {cerradasCalificadas.length} exitosa{cerradasCalificadas.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Chips de estado + etiquetas */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${estadoCfg.className}`}>
                    {estadoCfg.label}
                  </span>
                  {(u.etiquetas || []).slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)' }}
                    >
                      {tag}
                    </span>
                  ))}
                  {section === 'sin-evaluar' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20">
                      Sin calificar
                    </span>
                  )}
                  {section === 'reengagement' && cerradasCalificadas.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-300/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-300/20">
                      Probado
                    </span>
                  )}
                </div>

                {/* Razón de recomendación */}
                <div className="mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>{razon}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
