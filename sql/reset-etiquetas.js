import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

// Limpia TODAS las etiquetas actuales de los creadores.
// La lista de opciones para calificar pasa a definirse en server/index.js
// (DEFAULT_ETIQUETAS). Cualquier etiqueta nueva creada desde la UI se vuelve
// a acumular a partir de esta limpieza.
async function run() {
  console.log('Reseteando etiquetas de todos los creadores...');

  // Cuántos tenían etiquetas antes (para el reporte)
  const [before] = await bq.query({
    query: `SELECT COUNT(*) AS n FROM \`hike-agentic-playground.${DATASET}.creators\`
            WHERE etiquetas IS NOT NULL AND etiquetas != '[]'`,
    location: 'US',
  });
  console.log(`  Creadores con etiquetas antes: ${before[0].n}`);

  await bq.query({
    query: `UPDATE \`hike-agentic-playground.${DATASET}.creators\`
            SET etiquetas = '[]'
            WHERE etiquetas IS NOT NULL AND etiquetas != '[]'`,
    location: 'US',
  });

  console.log('✓ Etiquetas eliminadas de todos los creadores.');
  console.log('Done.');
}

run().catch(console.error);
