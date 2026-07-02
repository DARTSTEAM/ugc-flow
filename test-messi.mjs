import { scrapeInstagramProfile } from './server/kernel/scrapers/instagram-profile.js';
import { closeAllBrowsers } from './server/kernel/browser-pool.js';

const handle = 'leomessi';
console.log('Scraping @' + handle + '...\n');

let result;
try {
  result = await scrapeInstagramProfile(handle);
} finally {
  await closeAllBrowsers();
}

if (result.error) {
  console.error('ERROR:', result.error);
  process.exit(1);
}

console.log('=== RESULTADO ===');
console.log('Nombre:             ', result.nombre);
console.log('Seguidores:         ', result.seguidores ? result.seguidores.toLocaleString('es-AR') : 'N/A');
console.log('ER Cuenta:          ', result.engagementRateCuenta, '%');
console.log('Promedio Vistas:    ', result.promedioVistaVideos ? result.promedioVistaVideos.toLocaleString('es-AR') : 'N/A');
console.log('Categoria:          ', result.categoria);
console.log('--- NUEVAS METRICAS ---');
console.log('Frecuencia semanal: ', result.frecuenciaSemanal, 'posts/sem');
console.log('Videos virales:     ', result.videosVirales, '(ultimos 60 dias, >3x avg)');
process.exit(0);
