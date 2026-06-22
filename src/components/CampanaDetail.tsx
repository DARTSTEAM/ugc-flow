import { useState } from 'react';
import {
  ArrowLeft, Rocket, Pause, Play, TrendingUp, TrendingDown,
  BarChart3, Users, Mail, CheckCircle, ChevronDown, ChevronUp, ChevronsUpDown, Award,
  MessageCircleMore, X, Send, Zap, MessageSquare, Loader2, RefreshCw
} from 'lucide-react';
import type { Campana, UGC, EstadoEnCampana } from '../data';
import {
  scoreColor, ESTADO_EN_CAMPANA_CONFIG, ESTADO_CAMPANA_CONFIG,
  getInitials, avatarColor
} from '../utils';
import ConfirmarEnvioModal from './ConfirmarEnvioModal';
import { scrapeCreatorsByCampaign } from '../api';

interface Props {
  campana: Campana;
  ugcs: UGC[];
  onBack: () => void;
  onTogglePause: (campana: Campana) => void;
  onLanzar: (campana: Campana) => void;
}

type SortKey2 = 'nombre' | 'estado' | 'score' | 'fechaEnvio';
type SortDir = 'asc' | 'desc';

const ESTADOS_EN: EstadoEnCampana[] = ['Enviado', 'Respondió', 'Pendiente', 'Calificado', 'No aplica'];

function KPICard({
  icon, label, value, note, trend
}: { icon: React.ReactNode; label: string; value: number | string; note?: string; trend?: 'up' | 'down' }) {
  return (
    <div
      className="flex-1 min-w-[130px] p-4 border rounded-xl"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between mb-2">
        <span style={{ color: 'var(--color-text-3)' }}>{icon}</span>
        {trend && (
          <span className={trend === 'up' ? 'text-emerald-500' : 'text-rose-400'}>
            {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-black font-mono" style={{ color: 'var(--color-text-1)' }}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</p>
      {note && <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-3)' }}>{note}</p>}
    </div>
  );
}

export default function CampanaDetail({ campana, ugcs, onBack, onTogglePause, onLanzar }: Props) {
  const [filterEstado, setFilterEstado] = useState<EstadoEnCampana | ''>('');
  const [sortKey, setSortKey] = useState<SortKey2>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showLanzarModal, setShowLanzarModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ success: number; failed: number } | null>(null);
  const [overrideUGC, setOverrideUGC] = useState<UGC | null>(null);
  const [overrideMsg, setOverrideMsg] = useState('');
  const [overrideSent, setOverrideSent] = useState(false);

  const estadoCfg = ESTADO_CAMPANA_CONFIG[campana.estado];

  const enviados = campana.ugcs.filter(u => u.estado !== 'No aplica').length;
  const respondidos = campana.ugcs.filter(u => ['Respondió', 'Calificado'].includes(u.estado)).length;
  const pendientes = campana.ugcs.filter(u => u.estado === 'Pendiente' || u.estado === 'Enviado').length;
  const calificados = campana.ugcs.filter(u => u.estado === 'Calificado').length;
  const progreso = Math.round((enviados / campana.objetivo) * 100);

  function handleSort(k: SortKey2) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
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

  const ranking = campana.ugcs
    .filter(uc => uc.estado === 'Calificado')
    .map(uc => ugcs.find(u => u.id === uc.ugcId))
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as UGC[];

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0"
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {campana.estado !== 'Cerrada' && campana.estado !== 'Borrador' && (
            <button
              onClick={() => onTogglePause(campana)}
              className="flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
            >
              {campana.estado === 'Pausada' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {campana.estado === 'Pausada' ? 'Reanudar' : 'Pausar'}
            </button>
          )}
          {campana.estado !== 'Cerrada' && (
            <button
              onClick={() => setShowLanzarModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
            >
              <Rocket className="w-3.5 h-3.5" />
              Lanzar envío
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 border rounded-xl" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-2)' }}>Progreso de campaña</span>
          <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-1)' }}>{enviados}/{campana.objetivo} UGCs</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(progreso, 100)}%`, backgroundColor: 'var(--color-brand)' }}
          />
        </div>
        <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--color-text-3)' }}>{progreso}% completado</p>
      </div>

      {/* KPI Strip */}
      <div className="flex gap-3 flex-wrap">
        <KPICard icon={<Mail className="w-5 h-5" />} label="Enviados" value={enviados}
          note={`de ${campana.objetivo} objetivo`} trend="up" />
        <KPICard icon={<BarChart3 className="w-5 h-5" />} label="Respondidos" value={respondidos}
          note={enviados > 0 ? `${Math.round((respondidos / enviados) * 100)}% del total` : '—'} trend="up" />
        <KPICard icon={<Users className="w-5 h-5" />} label="Pendientes" value={pendientes}
          note="sin respuesta" />
        <KPICard icon={<CheckCircle className="w-5 h-5" />} label="Calificados" value={calificados}
          note={respondidos > 0 ? `${Math.round((calificados / respondidos) * 100)}% de respondidos` : '—'} trend="up" />
      </div>

      {/* Contactar creadores */}
      <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(252,154,0,0.1)' }}>
              <Send className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: 'var(--color-text-1)' }}>Contactar creadores por WhatsApp</p>
              {campana.mensajeContacto ? (
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                  {campana.mensajeContacto}
                </p>
              ) : (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                  Sin mensaje de contacto definido
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEnvioModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97] flex-shrink-0"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Enviar a creadores
          </button>
        </div>
      </div>

      {/* UGC Table */}

      <div className="border rounded-2xl overflow-hidden flex flex-col flex-1"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-3)' }}>Creadores en esta campaña</h3>
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value as EstadoEnCampana | '')}
            className="px-3 py-1.5 border rounded-xl text-xs focus:outline-none transition-all duration-200"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252,154,0,0.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_EN.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[600px]">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-surface)' }}>
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
                const estadoCfg = ESTADO_EN_CAMPANA_CONFIG[uc.estado];
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
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${estadoCfg.className}`}>{estadoCfg.label}</span>
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
                        onClick={() => { setOverrideUGC(ugc!); setOverrideMsg(''); setOverrideSent(false); }}
                        title="Override bot — contactar directamente"
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#ffe8b5'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'}
                      >
                        <Zap className="w-3 h-3" />
                        Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking panel */}
      {ranking.length > 0 && (
        <div className="border rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
            <Award className="w-3.5 h-3.5 text-amber-400" />
            Ranking de candidatos
          </h3>
          <div className="space-y-2">
            {ranking.map((ugc, i) => {
              const sc = scoreColor(ugc.score);
              const av = avatarColor(ugc.id);
              return (
                <div key={ugc.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors duration-150"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                >
                  <span className="text-xs font-black font-mono w-4 text-center" style={{ color: 'var(--color-text-3)' }}>#{i + 1}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${av}`}>
                    {getInitials(ugc.nombre)}
                  </div>
                  <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>{ugc.nombre}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${ugc.score}%` }} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${sc.text} w-6`}>{ugc.score}</span>
                  </div>
                  <button
                    className="px-3 py-1 text-xs font-semibold rounded-xl transition-all duration-200"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)', border: '1px solid var(--color-brand-border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#ffe8b5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-light)'}
                  >
                    Seleccionar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showEnvioModal && (
        <ConfirmarEnvioModal
          campana={campana}
          ugcs={ugcs}
          onClose={() => setShowEnvioModal(false)}
        />
      )}

      {/* Override Bot Modal */}
      {overrideUGC && (
        <>
          <div className="fixed inset-0 z-50 overlay-enter" style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setOverrideUGC(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div className="rounded-2xl w-full max-w-md pointer-events-auto modal-enter border"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-modal)' }}>
              <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>Override del bot</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Contacto directo a <span className="font-semibold" style={{ color: 'var(--color-text-2)' }}>{overrideUGC.nombre}</span></p>
                  </div>
                </div>
                <button onClick={() => setOverrideUGC(null)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-200"
                  style={{ color: 'var(--color-text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-4 flex flex-col gap-4">
                {overrideSent ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <MessageCircleMore className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--color-text-1)' }}>Mensaje enviado</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Tu mensaje fue enviado directamente, sin pasar por el bot.</p>
                    </div>
                    <button
                      onClick={() => setOverrideUGC(null)}
                      className="mt-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all duration-200"
                      style={{ backgroundColor: 'var(--color-text-1)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-border)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-brand-hover)' }}>
                        ⚡ Este mensaje bypasea al bot y se enviará <strong>directamente por WhatsApp</strong>.
                        Usalo para casos urgentes o personalizados.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Mensaje</label>
                      <textarea
                        value={overrideMsg}
                        onChange={e => setOverrideMsg(e.target.value)}
                        placeholder={`Hola ${overrideUGC.nombre.split(' ')[0]}, te contacto directamente para...`}
                        rows={4}
                        autoFocus
                        className="px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-all duration-200 resize-none"
                        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#FBBF24'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.15)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
                      />
                      <p className="text-[10px] font-mono text-right" style={{ color: 'var(--color-text-3)' }}>{overrideMsg.length} chars</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { if (!overrideMsg.trim()) return; setOverrideSent(true); }}
                        disabled={!overrideMsg.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold transition-all duration-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                        style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                        onMouseEnter={e => { if (!overrideMsg.trim()) return; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-hover)'; }}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand)'}
                      >
                        <Send className="w-4 h-4" />
                        Enviar ahora
                      </button>
                      <button
                        onClick={() => setOverrideUGC(null)}
                        className="px-4 py-2.5 border rounded-xl font-semibold transition-all duration-200 text-sm"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
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
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4 pointer-events-auto modal-enter border"
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
