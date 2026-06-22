// ─── Types ─────────────────────────────────────────────────────────────────

export type Canal = 'WhatsApp' | 'Instagram' | 'Email';
export type EstadoUGC = 'Nuevo' | 'Contactado' | 'Respondió' | 'Calificado' | 'Descartado';
export type EstadoCampana = 'Borrador' | 'Activa' | 'Pausada' | 'Cerrada';
export type EstadoEnCampana = 'Enviado' | 'Respondió' | 'Pendiente' | 'Calificado' | 'No aplica';

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
  lastScrapedAt: string;                 // ISO timestamp
}

/** Datos extraídos por Kernel al hacer scrape del perfil de TikTok */
export interface EvaluacionPerfilTiktok {
  handle: string;
  seguidores: number;
  engagementRate: number | null;          // null si no hay videos suficientes
  promedioVistas: number | null;          // null si no hay play counts
  lastScrapedAt: string;
}

/** Form manual — contenido orgánico. Cada campo pondera 25% del score orgánico */
export interface EvaluacionOrganica {
  views?: number;           // promedio de vistas (25%)
  shares?: number;          // promedio de shares (25%)
  engagementRate?: number;  // ER % (25%)
  hookNatural?: number;     // puntuación 1–10 de hook natural (25%)
  completado: boolean;
}

/** Form manual — KPIs de pauta */
export interface EvaluacionPauta {
  impresiones?: number;
  alcance?: number;
  cpm?: number;             // costo por 1000 impresiones
  frecuencia?: number;      // frecuencia de exposición
  ctr?: number;             // % click-through rate
  vtr?: number;             // % view-through rate
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
  evaluacionPerfil?: EvaluacionPerfil;            // datos de Kernel Instagram (solo lectura)
  evaluacionPerfilTiktok?: EvaluacionPerfilTiktok; // datos de Kernel TikTok (solo lectura)
  evaluacionOrganica?: EvaluacionOrganica;         // form manual — contenido orgánico
  evaluacionPauta?: EvaluacionPauta;               // form manual — KPIs de pauta
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
  objetivo: number;
  ugcs: UGCEnCampana[];
  marca?: string;
  mensajeContacto?: string;  // template de WhatsApp para outreach masivo
}
