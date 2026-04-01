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

export interface UGC {
  id: string;
  nombre: string;
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
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

export const UGCS_MOCK: UGC[] = [
  {
    id: 'ugc-001',
    nombre: 'Valentina Torres',
    canal: 'Instagram',
    estado: 'Calificado',
    score: 88,
    ultimaActividad: 'hace 1 día',
    campanasignada: 'Lanzamiento Popeyes Verano',
    seguidores: '24.5k',
    bio: 'Lifestyle & moda sostenible 🌿 | Buenos Aires',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Valentina! Te contactamos de parte de NGR porque nos encanta tu contenido. ¿Estarías interesada en colaborar en una campaña para Popeyes?', fecha: 'hace 5 días' },
      { id: 'm2', tipo: 'entrante', texto: '¡Hola! Claro que sí, me encantaría saber más. ¿De qué trata la campaña?', fecha: 'hace 5 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Buscamos UGCs para comunicar las campañas de Popeyes. Vamos a hacerte unas preguntas rápidas para ver si encajas. ¿Te parece?', fecha: 'hace 4 días' },
      { id: 'm4', tipo: 'entrante', texto: '¡Dale! Con mucho gusto respondo todo.', fecha: 'hace 4 días' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '27 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Creadora de contenido UGC, me dedico a esto hace 2 años' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '18.200 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '24.500 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con varias marcas de food, moda y lifestyle' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Llevo trabajando con marcas desde hace 1 año y medio' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 15 Pro, ring light y micrófono de solapa' },
      { pregunta: '¿Eres consumidora de Popeyes?', respuesta: 'Sí, soy fan del pollo crujiente de Popeyes' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: 'Unas 5 o 6 veces, voy bastante seguido' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: '¡Sí, me encantaría! Es exactamente el tipo de proyecto que busco' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Sí, tengo la semana libre, sin problema' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 23, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 22, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 21, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 22, maximo: 25 },
    ],
  },
  {
    id: 'ugc-002',
    nombre: 'Matías Herrera',
    canal: 'WhatsApp',
    estado: 'Respondió',
    score: 62,
    ultimaActividad: 'hace 2 días',
    campanasignada: 'Lanzamiento Popeyes Verano',
    seguidores: '8.2k',
    bio: 'Foodie & lifestyle | Córdoba, Argentina',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Matías! Te escribimos de NGR. ¿Estarías interesado en ser UGC para una campaña de Popeyes?', fecha: 'hace 4 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola! Sí dale, ¿de qué se trata?', fecha: 'hace 3 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Te vamos a hacer unas preguntas cortas para ver si encajas en el perfil.', fecha: 'hace 3 días' },
      { id: 'm4', tipo: 'entrante', texto: 'Sí, adelante!', fecha: 'hace 2 días' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '24 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Hago contenido de forma hobby, pero me está yendo bien' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: 'No tengo TikTok activo' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: 'Como 8.200 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con algunas marcas locales de food' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Hace unos 6 meses' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'Samsung Galaxy S23, sin equipo extra' },
      { pregunta: '¿Eres consumidor de Popeyes?', respuesta: 'Sí, me gusta bastante' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: 'Unas 3 veces' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'Sí, me parece una buena oportunidad' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Tengo trabajo en esa semana pero puedo coordinar' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 14, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 17, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 14, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 17, maximo: 25 },
    ],
  },
  {
    id: 'ugc-003',
    nombre: 'Luciana Pérez',
    canal: 'Email',
    estado: 'Contactado',
    score: 45,
    ultimaActividad: 'hace 3 días',
    campanasignada: null,
    seguidores: '15.1k',
    bio: 'Belleza & skincare 💄 | CABA',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: 'Hola Luciana, te escribimos de NGR. Estamos buscando UGCs para una campaña de Popeyes. ¿Te interesa saber más?', fecha: 'hace 3 días' },
    ],
    calificacion: [],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 10, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 12, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 11, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 12, maximo: 25 },
    ],
  },
  {
    id: 'ugc-004',
    nombre: 'Santiago Morales',
    canal: 'Instagram',
    estado: 'Nuevo',
    score: 0,
    ultimaActividad: 'hace 1 hora',
    campanasignada: null,
    seguidores: '32k',
    bio: 'Fitness & nutrición 💪 | Rosario',
    conversacion: [],
    calificacion: [],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 0, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 0, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 0, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 0, maximo: 25 },
    ],
  },
  {
    id: 'ugc-005',
    nombre: 'Camila Rodríguez',
    canal: 'WhatsApp',
    estado: 'Descartado',
    score: 22,
    ultimaActividad: 'hace 6 días',
    campanasignada: null,
    seguidores: '3.4k',
    bio: 'DIY & manualidades 🎨',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Camila! Te contactamos para una campaña de Popeyes. ¿Te interesa?', fecha: 'hace 8 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola, ¿de qué se trata?', fecha: 'hace 7 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Buscamos UGCs para comunicar campañas de comida rápida. ¿Consumís Popeyes?', fecha: 'hace 7 días' },
      { id: 'm4', tipo: 'entrante', texto: 'La verdad que no voy casi nunca, y tampoco hago contenido de comida.', fecha: 'hace 6 días' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '21 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Made DIY, no food content' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '2.100 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '3.400 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'No' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'N/A' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 12' },
      { pregunta: '¿Eres consumidora de Popeyes?', respuesta: 'No, casi no voy a ese tipo de lugares' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: 'Ninguna' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'No creo que encaje bien con mi contenido' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Sí pero preferiría otra categoría de marca' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 8, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 3, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 6, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 5, maximo: 25 },
    ],
  },
  {
    id: 'ugc-006',
    nombre: 'Florencia Gutiérrez',
    canal: 'Instagram',
    estado: 'Calificado',
    score: 91,
    ultimaActividad: 'hace 2 horas',
    campanasignada: 'Lanzamiento Popeyes Verano',
    seguidores: '58.3k',
    bio: 'Travel & food | Buenos Aires ✈️',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Flor! Somos fans de tu contenido. Te invitamos a ser parte de una campaña de Popeyes. ¿Tenés 5 minutos?', fecha: 'hace 5 días' },
      { id: 'm2', tipo: 'entrante', texto: '¡Hola! Sí, claro. Me interesa mucho.', fecha: 'hace 5 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Genial, te hacemos unas preguntas rápidas de calificación.', fecha: 'hace 4 días' },
      { id: 'm4', tipo: 'entrante', texto: '¡Adelante! Respondo todo con gusto.', fecha: 'hace 4 días' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '29 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Soy UGC creator full time desde hace 3 años' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '41.000 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '58.300 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con marcas de food, travel y lifestyle' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Llevo 3 años trabajando con marcas. Trabajé con McDonald\'s, Rappi, y locales gastronómicos.' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 15 Pro Max, GoPro Hero 12, gimbal DJI OM 6, dos ring lights y micrófono Rode' },
      { pregunta: '¿Eres consumidora de Popeyes?', respuesta: 'Sí, fanática absoluta del chicken sandwich de Popeyes' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: 'Unas 8 veces, voy casi cada semana' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: '¡Sí! Me entusiasma mucho, es una marca que consumo de verdad' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Sí, tengo toda la semana libre y disponible' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 25, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 24, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 22, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 20, maximo: 25 },
    ],
  },
  {
    id: 'ugc-007',
    nombre: 'Rodrigo Vega',
    canal: 'WhatsApp',
    estado: 'Respondió',
    score: 71,
    ultimaActividad: 'hace 1 día',
    campanasignada: 'Campaña Burger King Q2',
    seguidores: '19.8k',
    bio: 'Tech & food reviews 📱 | Mendoza',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Rodrigo! Te contactamos para una campaña de Burger King. ¿Tenés interés?', fecha: 'hace 4 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola, sí cuéntame más.', fecha: 'hace 3 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Te vamos a hacer algunas preguntas de calificación, ¿te parece?', fecha: 'hace 3 días' },
      { id: 'm4', tipo: 'entrante', texto: 'Dale, bien.', fecha: 'hace 1 día' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '26 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Creador de contenido, principalmente tech y food' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '12.500 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '19.800 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con marcas de tecnología y algunas de food delivery' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Hace unos 8 meses, con Rappi y una marca de apps tech' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'Samsung S24, trípode, luz de panel LED' },
      { pregunta: '¿Eres consumidor de Burger King?', respuesta: 'Sí, voy seguido, me gustan las hamburguesas' },
      { pregunta: '¿Cuántas veces has consumido Burger King en los últimos 3 meses?', respuesta: '4 o 5 veces' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'Sí, me interesa, aunque lo mío principal es tech' },
      { pregunta: '¿Tienes disponibilidad para la semana del 17 de marzo?', respuesta: 'Sí, tengo disponibilidad esa semana' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 17, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 19, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 18, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 17, maximo: 25 },
    ],
  },
  {
    id: 'ugc-008',
    nombre: 'Ana Castillo',
    canal: 'Email',
    estado: 'Contactado',
    score: 38,
    ultimaActividad: 'hace 4 días',
    campanasignada: null,
    seguidores: '11.2k',
    bio: 'Gastronomía & recetas 🍳 | Tucumán',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: 'Hola Ana, te escribimos de NGR. Estamos buscando UGCs para una campaña de Popeyes. ¿Te interesaría participar?', fecha: 'hace 4 días' },
    ],
    calificacion: [],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 9, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 10, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 9, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 10, maximo: 25 },
    ],
  },
  {
    id: 'ugc-009',
    nombre: 'Julián Espinoza',
    canal: 'Instagram',
    estado: 'Calificado',
    score: 79,
    ultimaActividad: 'hace 3 horas',
    campanasignada: 'Campaña Burger King Q2',
    seguidores: '41.7k',
    bio: 'Deportes & lifestyle 🍔 | Mar del Plata',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Julián! Te contactamos para una campaña de Burger King. ¡Tu perfil nos encanta!', fecha: 'hace 6 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola! Gracias 😊 cuéntame qué tenés!', fecha: 'hace 5 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Perfecto, te hacemos unas preguntas de calificación.', fecha: 'hace 5 días' },
      { id: 'm4', tipo: 'entrante', texto: 'Dale, sin problema.', fecha: 'hace 3 horas' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '28 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Creador de contenido lifestyle y deporte, hace 2 años' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '29.000 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '41.700 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con marcas deportivas y de comida' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Trabajo con marcas hace 1 año y medio. Adidas, suplementos y Pedidos Ya.' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 15, trípode, aro de luz y micrófono inalámbrico' },
      { pregunta: '¿Eres consumidor de Burger King?', respuesta: 'Sí, me encanta la Whopper' },
      { pregunta: '¿Cuántas veces has consumido Burger King en los últimos 3 meses?', respuesta: '6 veces aproximadamente' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'Sí, me interesa mucho. Me identifico con la marca.' },
      { pregunta: '¿Tienes disponibilidad para la semana del 17 de marzo?', respuesta: 'Sí, esa semana estoy disponible' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 20, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 21, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 20, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 18, maximo: 25 },
    ],
  },
  {
    id: 'ugc-010',
    nombre: 'Sofía Ramírez',
    canal: 'WhatsApp',
    estado: 'Nuevo',
    score: 0,
    ultimaActividad: 'hace 30 min',
    campanasignada: null,
    seguidores: '27k',
    bio: 'Decoración & lifestyle 🏠 | Córdoba',
    conversacion: [],
    calificacion: [],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 0, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 0, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 0, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 0, maximo: 25 },
    ],
  },
  {
    id: 'ugc-011',
    nombre: 'Diego Fernández',
    canal: 'Instagram',
    estado: 'Respondió',
    score: 55,
    ultimaActividad: 'hace 2 días',
    campanasignada: null,
    seguidores: '9.3k',
    bio: 'Música & entretenimiento 🎵 | CABA',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: '¡Hola Diego! Te contactamos para una campaña de Popeyes. ¿Te animás?', fecha: 'hace 5 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola, ¿de qué marca es?', fecha: 'hace 4 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Es Popeyes, para comunicar sus campañas de verano. Te hacemos unas preguntas rápidas.', fecha: 'hace 4 días' },
      { id: 'm4', tipo: 'entrante', texto: 'Puede ser. Cuéntame.', fecha: 'hace 2 días' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '23 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'Hago contenido de música y entretenimiento, soy semi-profesional' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '5.800 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '9.300 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con algunas marcas pequeñas de entretenimiento' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Hace unos 4 meses, colaboraciones puntuales' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 14, un micrófono externo y luz LED' },
      { pregunta: '¿Eres consumidor de Popeyes?', respuesta: 'Sí, voy de vez en cuando' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: '2 veces' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'Sí, aunque no es mi nicho habitual, me interesa expandirme' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Necesito confirmarlo, tengo algunos compromisos' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 13, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 14, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 14, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 14, maximo: 25 },
    ],
  },
  {
    id: 'ugc-012',
    nombre: 'Carla Méndez',
    canal: 'Email',
    estado: 'Calificado',
    score: 83,
    ultimaActividad: 'hace 5 horas',
    campanasignada: 'Lanzamiento Popeyes Verano',
    seguidores: '36.4k',
    bio: 'Wellness & food & lifestyle 🧘 | Bariloche',
    conversacion: [
      { id: 'm1', tipo: 'saliente', texto: 'Hola Carla, te escribimos de NGR. Queremos invitarte a ser UGC para una campaña de Popeyes.', fecha: 'hace 7 días' },
      { id: 'm2', tipo: 'entrante', texto: 'Hola, gracias por contactarme. Me interesa, cuéntame más.', fecha: 'hace 6 días' },
      { id: 'm3', tipo: 'saliente', texto: 'Perfecto, te enviamos unas preguntas de calificación.', fecha: 'hace 6 días' },
      { id: 'm4', tipo: 'entrante', texto: 'Genial, respondo todo con gusto.', fecha: 'hace 5 horas' },
    ],
    calificacion: [
      { pregunta: '¿Cuál es tu edad?', respuesta: '31 años' },
      { pregunta: '¿Eres creador de contenido o UGC?', respuesta: 'UGC creator profesional hace 2 años y medio' },
      { pregunta: '¿Cuántos seguidores tienes en TikTok?', respuesta: '22.000 seguidores' },
      { pregunta: '¿Cuántos seguidores tienes en Instagram?', respuesta: '36.400 seguidores' },
      { pregunta: '¿Has trabajado con marcas anteriormente?', respuesta: 'Sí, con marcas de wellness, food y lifestyle' },
      { pregunta: '¿Hace cuánto trabajaste en las marcas mencionadas?', respuesta: 'Llevo 2 años trabajando con marcas como Rappi, Naturalia y algunas cafeterías.' },
      { pregunta: '¿Con qué equipos o aparatos electrónicos grabas tus videos?', respuesta: 'iPhone 15 Pro, gimbal, ring light profesional y micrófono Rode Wireless GO' },
      { pregunta: '¿Eres consumidora de Popeyes?', respuesta: 'Sí, voy regularmente, me gusta el pollo y las opciones del menú' },
      { pregunta: '¿Cuántas veces has consumido Popeyes en los últimos 3 meses?', respuesta: '4 veces en los últimos 3 meses' },
      { pregunta: '¿Te gustaría ser parte de nuestros UGCs para comunicar nuestras campañas?', respuesta: 'Absolutamente, me encanta la idea de trabajar con una marca que consumo genuinamente' },
      { pregunta: '¿Tienes disponibilidad para la semana del 10 de febrero?', respuesta: 'Sí, tengo disponibilidad completa esa semana' },
    ],
    scoreBreakdown: [
      { criterio: 'Velocidad de respuesta', puntos: 22, maximo: 25 },
      { criterio: 'Interés declarado', puntos: 21, maximo: 25 },
      { criterio: 'Calidad de respuesta', puntos: 20, maximo: 25 },
      { criterio: 'Perfil del canal', puntos: 20, maximo: 25 },
    ],
  },
];

export const CAMPANAS_MOCK: Campana[] = [
  {
    id: 'camp-001',
    nombre: 'Lanzamiento Popeyes Verano',
    marca: 'Popeyes',
    estado: 'Activa',
    descripcion: 'Campaña de UGC para comunicar el menú de verano de Popeyes. Buscamos creadores auténticos consumidores de la marca.',
    fechaInicio: '2025-01-15',
    fechaFin: '2025-03-15',
    objetivo: 10,
    ugcs: [
      { ugcId: 'ugc-001', estado: 'Calificado', fechaEnvio: '2025-01-16', fechaRespuesta: '2025-01-17' },
      { ugcId: 'ugc-002', estado: 'Respondió', fechaEnvio: '2025-01-16', fechaRespuesta: '2025-01-18' },
      { ugcId: 'ugc-003', estado: 'Enviado', fechaEnvio: '2025-01-17', fechaRespuesta: null },
      { ugcId: 'ugc-005', estado: 'No aplica', fechaEnvio: '2025-01-15', fechaRespuesta: '2025-01-16' },
      { ugcId: 'ugc-006', estado: 'Calificado', fechaEnvio: '2025-01-16', fechaRespuesta: '2025-01-17' },
      { ugcId: 'ugc-008', estado: 'Pendiente', fechaEnvio: '2025-01-17', fechaRespuesta: null },
      { ugcId: 'ugc-012', estado: 'Calificado', fechaEnvio: '2025-01-15', fechaRespuesta: '2025-01-16' },
    ],
  },
  {
    id: 'camp-002',
    nombre: 'Campaña Burger King Q2',
    marca: 'Burger King',
    estado: 'Borrador',
    descripcion: 'Campaña de UGC para el lanzamiento de la nueva Whopper edición limitada. Creadores lifestyle y food.',
    fechaInicio: '2025-04-01',
    fechaFin: '2025-06-30',
    objetivo: 8,
    ugcs: [
      { ugcId: 'ugc-007', estado: 'Calificado', fechaEnvio: '2025-04-02', fechaRespuesta: '2025-04-03' },
      { ugcId: 'ugc-009', estado: 'Calificado', fechaEnvio: '2025-04-02', fechaRespuesta: '2025-04-04' },
    ],
  },
  {
    id: 'camp-003',
    nombre: 'Popeyes Black Friday 2024',
    marca: 'Popeyes',
    estado: 'Cerrada',
    descripcion: 'Campaña de UGC para Black Friday 2024 de Popeyes. Alta rotación de contenido para comunicar promociones.',
    fechaInicio: '2024-11-01',
    fechaFin: '2024-11-30',
    objetivo: 15,
    ugcs: [
      { ugcId: 'ugc-001', estado: 'Calificado', fechaEnvio: '2024-11-01', fechaRespuesta: '2024-11-02' },
      { ugcId: 'ugc-004', estado: 'Enviado', fechaEnvio: '2024-11-01', fechaRespuesta: null },
      { ugcId: 'ugc-006', estado: 'Calificado', fechaEnvio: '2024-11-01', fechaRespuesta: '2024-11-02' },
      { ugcId: 'ugc-008', estado: 'Enviado', fechaEnvio: '2024-11-02', fechaRespuesta: null },
      { ugcId: 'ugc-009', estado: 'Calificado', fechaEnvio: '2024-11-01', fechaRespuesta: '2024-11-03' },
      { ugcId: 'ugc-010', estado: 'Respondió', fechaEnvio: '2024-11-02', fechaRespuesta: '2024-11-04' },
      { ugcId: 'ugc-011', estado: 'Respondió', fechaEnvio: '2024-11-02', fechaRespuesta: '2024-11-05' },
      { ugcId: 'ugc-012', estado: 'Calificado', fechaEnvio: '2024-11-01', fechaRespuesta: '2024-11-02' },
      { ugcId: 'ugc-002', estado: 'No aplica', fechaEnvio: '2024-11-03', fechaRespuesta: '2024-11-04' },
      { ugcId: 'ugc-003', estado: 'Pendiente', fechaEnvio: '2024-11-03', fechaRespuesta: null },
      { ugcId: 'ugc-005', estado: 'No aplica', fechaEnvio: '2024-11-03', fechaRespuesta: '2024-11-04' },
    ],
  },
];
