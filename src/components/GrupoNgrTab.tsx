import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, Loader2, Megaphone, Users, Radar, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, HelpCircle } from 'lucide-react';
import { fetchGroupOverview } from '../api';
import type { GroupOverview, BrandComparativa } from '../data';
import { ESTADO_CAMPANA_CONFIG, getInitials, avatarColor } from '../utils';
import Tip from './Tip';

/** Formato compacto de números: 12.3K, 1.2M — misma lógica que CampanaDetail.tsx. */
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('es-AR');
}

type SortKey = 'nombre' | 'campanasActivas' | 'creadoresActivos' | 'alcanceTotal' | 'engagementRate';

const ESTADO_CAMPANA_KEYS = new Set(Object.keys(ESTADO_CAMPANA_CONFIG));

/** Vista cruzada del Grupo NGR: compara cómo le va a cada marca, sin importar qué empresa esté elegida en el nav. */
export default function GrupoNgrTab() {
  const [data, setData] = useState<GroupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('alcanceTotal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGroupOverview()
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el resumen del grupo'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const comparativaOrdenada = useMemo(() => {
    if (!data) return [];
    const rows = [...data.comparativa];
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av ?? -1) - Number(bv ?? -1);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-3)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: '#fecdd3' }}>
        <p className="text-sm font-semibold text-rose-600">{error || 'No se pudo cargar el resumen del grupo'}</p>
      </div>
    );
  }

  const columns: { key: SortKey; label: string; help?: string }[] = [
    { key: 'nombre', label: 'Marca' },
    { key: 'campanasActivas', label: 'Campañas activas', help: 'Campañas con estado Activa de esta marca ahora mismo. No incluye borradores, pausadas ni cerradas.' },
    { key: 'creadoresActivos', label: 'Creadores activos', help: 'Creadores en estado Activo o Disponible en campañas de esta marca ahora mismo.' },
    { key: 'alcanceTotal', label: 'Alcance total', help: 'Suma de likes, comentarios, compartidos y guardados de TODAS las colaboraciones (posteos cargados) de esta marca en los últimos 30 días.' },
    { key: 'engagementRate', label: 'ER ponderado', help: 'Engagement rate ponderado de los últimos 30 días: suma de interacciones sobre suma de vistas de todas las colaboraciones de esta marca (no es el promedio simple de cada posteo).' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Totales del grupo ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Campañas activas', value: data.totales.campanasActivas, icon: Megaphone, color: '#10b981', sub: 'en todo el grupo',
            help: 'Cantidad de campañas con estado Activa ahora mismo, sumando las 6 marcas. No incluye borradores, pausadas ni cerradas.',
          },
          {
            label: 'Creadores activos', value: data.totales.creadoresActivos, icon: Users, color: 'var(--color-brand)', sub: 'activos o disponibles',
            help: 'Creadores en estado Activo o Disponible en al menos una campaña, sumando las 6 marcas (sin duplicar si trabaja con más de una).',
          },
          {
            label: 'Alcance total', value: fmt(data.totales.alcanceTotal), icon: Radar, color: '#3b82f6', sub: 'últimos 30 días',
            help: 'Suma de likes, comentarios, compartidos y guardados de TODAS las colaboraciones (posteos cargados) de las 6 marcas en los últimos 30 días — no es el acumulado histórico.',
          },
          {
            label: 'Marcas con actividad', value: data.totales.marcasConActividad, icon: Globe2, color: '#8b5cf6', sub: 'de 6 marcas NGR',
            help: 'Marcas del grupo que tienen al menos una campaña cargada en el sistema, sin importar su estado.',
          },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl px-5 py-4 border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</p>
              <Tip text={stat.help}>
                <HelpCircle className="w-3.5 h-3.5 cursor-help mt-1" style={{ color: 'var(--color-text-3)' }} />
              </Tip>
            </div>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-text-2)' }}>{stat.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Comparativa de marcas ─────────────────────────────────── */}
      <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-black mb-3" style={{ color: 'var(--color-text-1)' }}>Comparativa de marcas</h3>
        <div className="overflow-x-auto border rounded-xl" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <table className="w-full text-left border-separate border-spacing-0 min-w-[640px]">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] border-b cursor-pointer select-none whitespace-nowrap"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.help && (
                        <Tip text={col.help}>
                          <HelpCircle className="w-3 h-3 cursor-help" />
                        </Tip>
                      )}
                      {sortKey === col.key ? (sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparativaOrdenada.map((b: BrandComparativa, i) => (
                <tr key={b.brandId} className="transition-colors duration-150" onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                  <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>{i + 1}</span>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(b.brandId)}`}>
                        {getInitials(b.nombre)}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{b.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{b.campanasActivas}</td>
                  <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{b.creadoresActivos}</td>
                  <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{fmt(b.alcanceTotal)}</td>
                  <td className="py-3 px-4 border-b text-xs font-mono" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-2)' }}>{b.engagementRate != null ? `${b.engagementRate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Campañas recientes cruzadas ───────────────────────────── */}
      <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Campañas recientes</h3>
          <Tip text="El alcance de cada campaña de esta lista es su suma de likes + comentarios + compartidos + guardados de los últimos 30 días.">
            <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: 'var(--color-text-3)' }} />
          </Tip>
        </div>
        {data.campanasRecientes.length === 0 ? (
          <p className="py-8 text-center text-sm italic" style={{ color: 'var(--color-text-3)' }}>Todavía no hay campañas con fecha de inicio cargada</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.campanasRecientes.map(c => {
              const estadoCfg = ESTADO_CAMPANA_KEYS.has(c.estado) ? ESTADO_CAMPANA_CONFIG[c.estado as keyof typeof ESTADO_CAMPANA_CONFIG] : null;
              return (
                <Link
                  key={c.id}
                  to={`/campanas/${c.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-150"
                  style={{ borderColor: 'var(--color-border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(c.marcaId)}`}>
                    {getInitials(c.marca)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>{c.nombre}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{c.marca} · {c.fechaInicio}</p>
                  </div>
                  {estadoCfg && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 ${estadoCfg.className}`}>{estadoCfg.label}</span>
                  )}
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-2)' }}>{fmt(c.alcance)}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
