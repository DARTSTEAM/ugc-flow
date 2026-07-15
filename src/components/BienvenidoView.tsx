import { useNavigate } from 'react-router-dom';
import {
  Megaphone, MessageSquare, ScanSearch, Star, BrainCircuit, Users,
  User, ArrowRight, Sparkles,
} from 'lucide-react';
import logoNgr from '../assets/Logo-ngr.png';

type StepKind = 'auto' | 'human' | 'result';

interface Step {
  title: string;
  desc: string;
  kind: StepKind;
}

const STEP_STYLES: Record<StepKind, { bg: string; border: string; text: string; dot: string }> = {
  auto:   { bg: '#EAF6F0', border: '#BFE3D2', text: '#1F6E56', dot: '#4FAE87' },
  human:  { bg: '#FDECE1', border: '#F6CDA9', text: '#A85A1E', dot: '#E08A3E' },
  result: { bg: '#FDF3D9', border: '#F0DDA0', text: '#93691A', dot: '#DDB247' },
};

const PROSPECCION_STEPS: Step[] = [
  { kind: 'auto', title: 'Definir criterios de búsqueda', desc: 'Nicho, ubicación, rango de seguidores y plataforma.' },
  { kind: 'auto', title: 'La inteligencia artificial busca candidatos', desc: 'Recorre Google en busca de perfiles que encajen con los criterios.' },
  { kind: 'auto', title: 'Analiza cada perfil', desc: 'Con datos reales extraídos de la cuenta del creador.' },
  { kind: 'auto', title: 'Evalúa el nicho y ubica el contacto', desc: 'Determina si el perfil corresponde y busca su correo electrónico.' },
  { kind: 'result', title: 'Lista de candidatos', desc: 'Queda lista para revisar y registrar como UGC en el catálogo.' },
];

const CAMPANA_STEPS: Step[] = [
  { kind: 'auto', title: 'Crear campaña', desc: 'Se define la marca del grupo y las fechas.' },
  { kind: 'auto', title: 'Elegir creadores candidatos', desc: 'Se seleccionan del catálogo por score y etiquetas.' },
  { kind: 'auto', title: 'Contacto en frío y seguimiento', desc: 'El embudo pasa por Pendiente, Respondió, En Negociación y Disponible.' },
  { kind: 'human', title: 'Cierre de negociación y pago', desc: 'Lo realiza una persona del equipo, fuera del sistema.' },
  { kind: 'human', title: 'Carga de la URL de la publicación', desc: 'El equipo la registra una vez que el creador publica el contenido.' },
  { kind: 'result', title: 'Medición automática de resultados', desc: 'ugc-flow obtiene las métricas reales de la publicación.' },
];

function FlowStepRow({ n, step, isLast }: { n: number; step: Step; isLast: boolean }) {
  const s = STEP_STYLES[step.kind];
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
          style={{ backgroundColor: s.dot, color: '#fff' }}
        >
          {step.kind === 'human' ? <User className="w-4 h-4" /> : n}
        </div>
        {!isLast && <div className="w-px flex-1 my-1" style={{ backgroundColor: s.border }} />}
      </div>
      <div
        className="flex-1 rounded-2xl border px-4 py-3 mb-4"
        style={{ backgroundColor: s.bg, borderColor: s.border }}
      >
        <p className="text-sm font-bold" style={{ color: s.text }}>{step.title}</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: s.text, opacity: 0.85 }}>{step.desc}</p>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 text-xs font-semibold">
      <span className="flex items-center gap-1.5" style={{ color: STEP_STYLES.auto.text }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STEP_STYLES.auto.dot }} />
        Paso automático de ugc-flow
      </span>
      <span className="flex items-center gap-1.5" style={{ color: STEP_STYLES.human.text }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STEP_STYLES.human.dot }} />
        Lo hace una persona
      </span>
      <span className="flex items-center gap-1.5" style={{ color: STEP_STYLES.result.text }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STEP_STYLES.result.dot }} />
        Resultado
      </span>
    </div>
  );
}

const MODULOS = [
  { icon: ScanSearch, name: 'Prospección', desc: 'Identifica creadores nuevos en Instagram o TikTok a partir de un nicho, una ubicación y un rango de seguidores. Una inteligencia artificial evalúa si el perfil corresponde al nicho y ubica su correo electrónico de contacto.', tipo: 'Flujo principal' },
  { icon: Users, name: 'UGCs Activos', desc: 'El catálogo de todos los creadores: perfil, etiquetas y un score de 0 a 100 calculado con datos extraídos directamente de sus redes sociales, no autodeclarados.', tipo: 'Flujo principal' },
  { icon: MessageSquare, name: 'Chats', desc: 'Espacio de conversación individual con cada creador para coordinar la colaboración durante el contacto en frío y la negociación.', tipo: 'Soporte' },
  { icon: Megaphone, name: 'Campañas', desc: 'Asignación de creadores a la campaña de una marca del grupo, carga de las URLs de sus publicaciones y obtención de las métricas públicas reales.', tipo: 'Flujo principal' },
  { icon: Star, name: 'Recomendaciones', desc: 'Sugiere a quién convocar nuevamente: los creadores con mejor desempeño en campañas anteriores, los que están en alza y los ex colaboradores con buen historial.', tipo: 'Flujo principal' },
  { icon: BrainCircuit, name: 'Test Agent', desc: 'Espacio interno para probar el agente de inteligencia artificial que atiende a los creadores y registrar comentarios sobre sus respuestas.', tipo: 'Soporte' },
];

export default function BienvenidoView() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh w-full" style={{ backgroundColor: '#FBF7F3' }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl border flex items-center justify-center overflow-hidden p-1.5 bg-white" style={{ borderColor: '#EFE6DC' }}>
            <img src={logoNgr} alt="NGR" className="w-full h-auto object-contain" />
          </div>
          <div>
            <p className="text-sm font-black leading-none" style={{ color: '#2B2620' }}>UGC Flow</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: '#9C9184' }}>by NGR Digital</p>
          </div>
        </div>

        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#B98A4E' }}>
          <Sparkles className="w-3.5 h-3.5" />
          Guía de bienvenida
        </p>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4" style={{ color: '#2B2620' }}>
          Qué es ugc-flow y para qué sirve
        </h1>
        <p className="text-base sm:text-lg leading-relaxed mb-12 max-w-2xl" style={{ color: '#6B6055' }}>
          Un resumen para quien no conoce el proyecto: qué problema resuelve, hasta dónde llega, y qué ocurre en tres momentos típicos de uso.
        </p>

        {/* ── Descripción general ─────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-black mb-3" style={{ color: '#2B2620' }}>Descripción general</h2>
          <p className="text-sm sm:text-base leading-relaxed mb-5" style={{ color: '#4A4238' }}>
            ugc-flow es la herramienta interna que utiliza el equipo de <strong>NGR</strong> para el primer contacto con creadores de contenido UGC (contenido generado por usuarios) de las distintas marcas del grupo. Cubre la etapa de descubrimiento y filtro inicial: identificar creadores nuevos, evaluar si conviene contratarlos, contactarlos en frío y dar seguimiento a la etapa en la que se encuentra cada conversación.
          </p>

          <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: STEP_STYLES.auto.bg, borderColor: STEP_STYLES.auto.border }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: STEP_STYLES.auto.text }}>Objetivo</p>
            <p className="text-sm leading-relaxed" style={{ color: STEP_STYLES.auto.text }}>
              Reemplazar la hoja de cálculo y las estimaciones aproximadas por datos reales: encontrar creadores, medirlos con la información real de sus redes sociales, y decidir con quién trabajar — y con quién repetir — según los resultados de campañas anteriores, no promesas.
            </p>
          </div>
        </section>

        {/* ── Alcance ──────────────────────────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-3" style={{ color: '#2B2620' }}>Dónde empieza y termina el sistema</h2>
          <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: STEP_STYLES.human.bg, borderColor: STEP_STYLES.human.border }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: STEP_STYLES.human.text }}>Alcance</p>
            <p className="text-sm leading-relaxed" style={{ color: STEP_STYLES.human.text }}>
              ugc-flow resuelve el <strong>primer filtro</strong> del proceso: encontrar creadores, contactarlos en frío y dar seguimiento a la etapa en la que se encuentra cada conversación, tanto dentro de una misma campaña como de forma cruzada entre las distintas marcas del grupo NGR. A partir de que un creador queda en estado <strong>"Disponible"</strong>, el cierre de la negociación y el pago quedan a cargo de una persona responsable del equipo, fuera del sistema.
            </p>
          </div>
        </section>

        {/* ── Escenario 1 ──────────────────────────────────────────── */}
        <section className="mb-14">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#B0A395' }}>Escenario 1</p>
          <h2 className="text-xl font-black mb-1" style={{ color: '#2B2620' }}>Inicio de una nueva prospección</h2>
          <p className="text-sm mb-5" style={{ color: '#8A7E70' }}>Cómo se obtienen creadores candidatos que todavía no están en el catálogo.</p>
          <div>
            {PROSPECCION_STEPS.map((step, i) => (
              <FlowStepRow key={step.title} n={i + 1} step={step} isLast={i === PROSPECCION_STEPS.length - 1} />
            ))}
          </div>
          <p className="text-xs leading-relaxed mt-1" style={{ color: '#8A7E70' }}>
            Se ejecuta de forma automática, sin necesidad de revisar perfil por perfil de manera manual. La única acción manual es revisar la lista y decidir a quién registrar como UGC.
          </p>
        </section>

        {/* ── Escenario 2 ──────────────────────────────────────────── */}
        <section className="mb-14">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#B0A395' }}>Escenario 2</p>
          <h2 className="text-xl font-black mb-1" style={{ color: '#2B2620' }}>Inicio de una nueva campaña</h2>
          <p className="text-sm mb-5" style={{ color: '#8A7E70' }}>Cómo se contacta y se da seguimiento a los creadores hasta que el proceso pasa a manos de una persona del equipo.</p>
          <Legend />
          <div>
            {CAMPANA_STEPS.map((step, i) => (
              <FlowStepRow key={step.title} n={i + 1} step={step} isLast={i === CAMPANA_STEPS.length - 1} />
            ))}
          </div>

          <div className="rounded-2xl border px-5 py-4 mt-2" style={{ backgroundColor: '#F1EDE6', borderColor: '#E2D9CB' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#7A6E5E' }}>Visibilidad cruzada entre marcas</p>
            <p className="text-sm leading-relaxed" style={{ color: '#5A5044' }}>
              Un mismo creador puede figurar en campañas de más de una marca del grupo al mismo tiempo. ugc-flow lo muestra en ambas: si ya está en estado "En Negociación" con la Marca A, el equipo de la Marca B lo visualiza antes de contactarlo en frío nuevamente.
            </p>
          </div>
        </section>

        {/* ── Escenario 3 ──────────────────────────────────────────── */}
        <section className="mb-14">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#B0A395' }}>Escenario 3</p>
          <h2 className="text-xl font-black mb-1" style={{ color: '#2B2620' }}>Qué análisis se pueden obtener</h2>
          <p className="text-sm mb-5" style={{ color: '#8A7E70' }}>Una vez que existen datos cargados, esto es lo que se puede consultar por creador y por campaña.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5" style={{ backgroundColor: '#EAF2FA', borderColor: '#C7DFF2' }}>
              <p className="text-sm font-black mb-3" style={{ color: '#265D85' }}>Por creador</p>
              <ul className="space-y-3">
                <li>
                  <p className="text-xs font-bold" style={{ color: '#265D85' }}>Score de 0 a 100</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#3E7196' }}>Perfil 60%, Orgánico 25%, Pauta 15%.</p>
                </li>
                <li>
                  <p className="text-xs font-bold" style={{ color: '#265D85' }}>Historial cruzado</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#3E7196' }}>Marcas del grupo que ya lo contactaron.</p>
                </li>
                <li>
                  <p className="text-xs font-bold" style={{ color: '#265D85' }}>Sentimiento</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#3E7196' }}>De los comentarios que recibe.</p>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FBEAF1', borderColor: '#F1C7D8' }}>
              <p className="text-sm font-black mb-3" style={{ color: '#9C3F63' }}>Por campaña</p>
              <ul className="space-y-3">
                <li>
                  <p className="text-xs font-bold" style={{ color: '#9C3F63' }}>Métricas reales</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#B1567F' }}>Vistas, likes, comentarios, engagement.</p>
                </li>
                <li>
                  <p className="text-xs font-bold" style={{ color: '#9C3F63' }}>Ranking de creadores</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#B1567F' }}>Dentro de esa campaña.</p>
                </li>
                <li>
                  <p className="text-xs font-bold" style={{ color: '#9C3F63' }}>Recomendaciones</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#B1567F' }}>A quién convocar en la siguiente campaña.</p>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-xs leading-relaxed mt-4" style={{ color: '#8A7E70' }}>
            El análisis por creador permite decidir a quién contratar. El análisis por campaña permite evaluar los resultados y decidir a quién convocar nuevamente.
          </p>
        </section>

        {/* ── Los 6 módulos ────────────────────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-5" style={{ color: '#2B2620' }}>Los 6 módulos</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {MODULOS.map(m => {
              const Icon = m.icon;
              const isFlow = m.tipo === 'Flujo principal';
              return (
                <div key={m.name} className="rounded-2xl border p-4 bg-white" style={{ borderColor: '#EFE6DC' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isFlow ? STEP_STYLES.auto.bg : '#F1EDE6' }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: isFlow ? STEP_STYLES.auto.text : '#7A6E5E' }} />
                      </div>
                      <p className="text-sm font-black" style={{ color: '#2B2620' }}>{m.name}</p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={isFlow
                        ? { backgroundColor: STEP_STYLES.auto.bg, color: STEP_STYLES.auto.text }
                        : { backgroundColor: '#F1EDE6', color: '#7A6E5E' }}
                    >
                      {m.tipo}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#8A7E70' }}>{m.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Footer note ──────────────────────────────────────────── */}
        <p className="text-xs leading-relaxed mb-14 pt-6 border-t" style={{ color: '#B0A395', borderColor: '#EFE6DC' }}>
          Detrás de escena: los datos de perfil y de publicaciones se obtienen mediante extracción automática de datos de Instagram y TikTok (motor Kernel) y se almacenan en BigQuery. Nada se completa manualmente, salvo la carga de las URLs de publicación y la evaluación de la pauta paga.
        </p>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/ugcs')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-brand, #fc9a00)', boxShadow: '0 4px 14px -3px rgba(252,154,0,0.35)' }}
          >
            Ir al sistema
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
