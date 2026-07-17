// ─── Types ─────────────────────────────────────────────────────────────────

export type Canal = 'WhatsApp' | 'Instagram';
export type EstadoUGC = 'Pendiente' | 'En Negociación' | 'Disponible' | 'Activo' | 'Descartado' | 'Inactivo';
export type EstadoCampana = 'Borrador' | 'Activa' | 'Pausada' | 'Cerrada';
export type EstadoEnCampana = 'Pendiente' | 'En Negociación' | 'Disponible' | 'Activo' | 'Descartado';

export interface ScoreBreakdown {
  criterio: string;
  puntos: number;
  maximo: number;
}

export interface Mensaje {
  id: string;
  tipo: 'entrante' | 'saliente';
  texto: string;
  fecha: string;
}

export interface RespuestaCalificacion {
  pregunta: string;
  respuesta: string;
}

// ─── Evaluation interfaces ──────────────────────────────────────────────────

/** Datos extraídos por Kernel al hacer scrape del perfil de Instagram */
export interface EvaluacionPerfil {
  nombre: string;
  perfil: string;                         // handle / @username
  seguidores: number;
  engagementRateCuenta: number | null;    // null si no hay posts suficientes
  promedioVistaVideos: number | null;     // null si no hay videos en los últimos 5 posts
  categoria: string | null;              // null para cuentas personales
  rangoEdadSeguidores: string | null;    // siempre null — no disponible públicamente
  frecuenciaSemanal: number | null;       // promedio de posts por semana (últimos 60 días)
  videosVirales: number | null;           // videos con vistas > 3x promedio resto (últimos 60 días)
  lastScrapedAt: string;                 // ISO timestamp
}

/** Datos extraídos por Kernel al hacer scrape del perfil de TikTok */
export interface EvaluacionPerfilTiktok {
  handle: string;
  seguidores: number;
  engagementRate: number | null;          // null si no hay videos suficientes
  promedioVistas: number | null;          // null si no hay play counts
  frecuenciaSemanal: number | null;       // promedio de videos por semana (últimos 60 días)
  videosVirales: number | null;           // videos con vistas > 3x promedio resto (últimos 60 días)
  lastScrapedAt: string;
}

/** Form manual — contenido orgánico de campaña (datos de referencia, no inciden directamente en el score) */
export interface EvaluacionOrganica {
  views?: number;           // promedio de vistas orgánicas
  shares?: number;          // promedio de shares orgánicos
  engagementRate?: number;  // ER % orgánico
  completado: boolean;
}

/** Form manual — KPIs de pauta */
export interface EvaluacionPauta {
  impresiones?: number;
  alcance?: number;
  cpm?: number;             // costo por 1000 impresiones (15% score)
  frecuencia?: number;      // frecuencia de exposición
  ctr?: number;             // % click-through rate (25% orgánico en score)
  vtr?: number;             // % view-through rate (25% orgánico en score)
  vistas?: number;          // reproducciones de pauta (15% score)
  er?: number;              // engagement rate de pauta % (15% score)
  completado: boolean;
}

export interface UGC {
  id: string;
  nombre: string;
  username?: string;             // Instagram @handle (used by Kernel scraper)
  canal: Canal;
  estado: EstadoUGC;
  score: number;
  ultimaActividad: string;
  campanasignada: string | null;
  conversacion: Mensaje[];
  calificacion: RespuestaCalificacion[];
  scoreBreakdown: ScoreBreakdown[];
  seguidores?: string;
  bio?: string;
  unread?: boolean;
  etiquetas?: string[];
  phone?: string;                          // número WhatsApp del creador
  usernameTiktok?: string;
  brandIds?: string[];                     // marcas asociadas (origen + campañas en las que participó)
  evaluacionPerfil?: EvaluacionPerfil;            // datos de Kernel Instagram (solo lectura)
  evaluacionPerfilTiktok?: EvaluacionPerfilTiktok; // datos de Kernel TikTok (solo lectura)
  evaluacionOrganica?: EvaluacionOrganica;         // form manual — contenido orgánico
  evaluacionPauta?: EvaluacionPauta;               // form manual — KPIs de pauta
}

// ─── Campaign content & metrics (públicas / orgánicas) ───────────────────────

/** Una pieza de contenido publicada por un creador PARA una campaña. */
export interface ContenidoCampana {
  id: string;
  campaignId: string;
  creatorId: string;
  creatorNombre?: string;
  platform: 'instagram' | 'tiktok' | 'desconocida';
  url: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  lastScrapedAt: string | null;
  scrapeError?: string | null;
}

/** Métricas agregadas a nivel campaña (suma de los posteos confirmados). */
export interface MetricasCampana {
  totalPosteos: number;
  totalCreadoresConPosteos: number;
  vistas: number;
  likes: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
  interacciones: number;
  engagementRate: number | null;
  /** false si ningún posteo tiene dato de vistas (p.ej. sólo fotos/carruseles de Instagram) — el 0 no es un valor real. */
  vistasDisponibles: boolean;
  /** Ordenado por interacciones descendente. */
  topContenidos: Array<{
    id: string;
    creatorId: string;
    creatorNombre: string;
    platform: string;
    url: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    engagementRate: number | null;
    interacciones: number;
  }>;
  /** Ranking de Creadores: métricas agregadas por creador (todos sus posteos en esta campaña). Ordenado por vistas descendente. */
  topCreadores: CreadorRanking[];
}

/** Una fila del Ranking de Creadores dentro del detalle de campaña. */
export interface CreadorRanking {
  creatorId: string;
  nombre: string;
  views: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  interacciones: number;
  engagementRate: number | null;
  /** % de comentarios positivos (0-100), null si todavía no se corrió "Analizar ahora" tras este cambio. */
  sentimentPositive: number | null;
  sentimentSampleSize: number;
}

/**
 * Sentimiento agregado de campaña: % positivo/neutral/negativo sobre los
 * últimos `muestras` comentarios (últimos 10 por posteo, mezclados sin
 * distinguir creador/posteo de origen), clasificados por MiniMax.
 */
export interface SentimientoCampana {
  positivo: number;
  neutral: number;
  negativo: number;
  muestras: number;
  actualizadoEn: string | null;
}

export interface CampaignContentResponse {
  content: ContenidoCampana[];
  metricas: MetricasCampana | null;
  creadoresSinPosteos: Array<{ id: string; nombre: string }>;
  sentimiento: SentimientoCampana | null;
}

export interface UGCEnCampana {
  ugcId: string;
  estado: EstadoEnCampana;
  fechaEnvio: string;
  fechaRespuesta: string | null;
}

export interface Campana {
  id: string;
  nombre: string;
  estado: EstadoCampana;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  ugcs: UGCEnCampana[];
  marca?: string;
  marcaId?: string | null;   // brand_id (p.ej. 'popeyes') — usado para filtrar por empresa, a diferencia de `marca` que es el nombre para mostrar
  mensajeContacto?: string;  // template de WhatsApp para outreach masivo
}

// ─── Recomendaciones ──────────────────────────────────────────────────────────

/** Una fila del desglose "por qué aparece este creador" — pts/max null = fila informativa, sin barra de puntos. */
export interface RecomendacionBreakdownRow {
  label: string;
  value: string | null;
  pts: number | null;
  max: number | null;
}

export interface CreadorTop {
  creatorId: string;
  nombre: string;
  username: string | null;
  /** Score de perfil (0-100, el mismo de siempre — 60% seguidores/ER/frecuencia + 25% orgánico + 15% pauta) */
  score: number;
  seguidoresDisplay: string | null;
  /** ER real promedio en su plataforma primaria, sólo de campaign_content de campañas Cerradas */
  avgEngagementRate: number;
  /** Percentil (0-100) de avgEngagementRate contra pares de su misma plataforma */
  performanceIndex: number;
  /** score*0.5 + performanceIndex*0.5, redondeado */
  finalScore: number;
  totalPosts: number;
  totalInteracciones: number;
  totalCampanasTerminadas: number;
  marcas: string[];
  razon: string;
  breakdown: RecomendacionBreakdownRow[];
}

export interface TopCreadoresResultado {
  /** false si nadie tiene campaign_content real en una campaña Cerrada todavía */
  disponible: boolean;
  creadores: CreadorTop[];
}

export interface CreadorEnAlza {
  creatorId: string;
  nombre: string;
  username: string | null;
  deltaFollowersPct: number;
  deltaEngagementRate: number;
  deltaVideosVirales: number;
  momentumScore: number;
  razon: string;
  capturedAtPrev: string;
  capturedAtLatest: string;
  breakdown: RecomendacionBreakdownRow[];
}

export interface ExColaborador {
  creatorId: string;
  nombre: string;
  username: string | null;
  avgEngagementRate: number | null;
  totalInteracciones: number;
  totalPosts: number;
  brandsHistoricos: string[];
  razon: string;
}

export interface RecomendacionesResponse {
  topCreadores: TopCreadoresResultado;
  enAlza: { disponible: boolean; creadores: CreadorEnAlza[] };
  exColaboradores: ExColaborador[];
}

export interface RefreshGateStatus {
  status: 'idle' | 'running' | 'cooldown';
  canRefresh: boolean;
  runId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  creatorsCount: number | null;
  successCount: number | null;
  failedCount: number | null;
  nextEligibleAt: string | null;
}

/** Perfil del usuario logueado. Sin autenticación real todavía, es un único registro (ver /api/profile). */
export interface UserProfile {
  id: string;
  nombre: string;
  area: string;
  email: string | null;
  fotoUrl: string | null;   // data URL (base64) o link externo
  marcaAsignada: string | null;   // brand_id preseleccionado en el selector de empresa (null = Grupo NGR)
}

export interface Brand {
  id: string;
  nombre: string;
}

// ─── Grupo NGR ──────────────────────────────────────────────────────────────

export interface BrandComparativa {
  brandId: string;
  nombre: string;
  campanasActivas: number;
  campanasTotal: number;
  creadoresActivos: number;
  alcanceTotal: number;
  engagementRate: number | null;
}

export interface CampanaReciente {
  id: string;
  nombre: string;
  marcaId: string;
  marca: string;
  estado: string;
  fechaInicio: string;
  alcance: number;
}

export interface GroupOverview {
  totales: {
    campanasActivas: number;
    creadoresActivos: number;
    alcanceTotal: number;
    marcasConActividad: number;
  };
  comparativa: BrandComparativa[];
  campanasRecientes: CampanaReciente[];
}
