# Cambios post-respuestas del cliente — Plataforma UGC

## Cómo usar este archivo

Este archivo contiene el análisis completo de los cambios pendientes en la plataforma UGC de NGR/Hike. Fue generado después de la reunión del 17/06/2026 con Raissa Tara Galarza y Lucia Cutipa.

**Para implementar los cambios**: Abrí este archivo en un nuevo chat, pegá las respuestas del cliente al mail enviado, y decile a la IA:
> "Analizando el archivo `cambios-post-respuestas.md` y las respuestas del cliente que te pego a continuación, implementá todos los cambios necesarios en el proyecto."

---

## Contexto del proyecto

**Stack**: React 19 + TypeScript (Vite) en el frontend, Express.js en el backend, BigQuery como base de datos (proyecto `hike-agentic-playground`, dataset `ngr_ugc`). Kernel SDK + Playwright para scraping de Instagram.

**Tabs de la app**: UGCs activos, Prospección, Campañas, Chats.

**Archivos clave**:
- `src/App.tsx` — estado global, navegación entre tabs
- `src/data.ts` — todas las interfaces TypeScript del dominio
- `src/api.ts` — capa HTTP al backend
- `src/components/UGCsTab.tsx` — lista principal de creadores
- `src/components/UGCDrawer.tsx` — panel lateral de detalle de un creador (incluye formularios de evaluación)
- `src/components/CampanasTab.tsx` — listado de campañas
- `src/components/CampanaDetail.tsx` — detalle de una campaña
- `src/components/NuevaCampanaModal.tsx` — modal para crear campaña
- `src/components/ChatsTab.tsx` — centro de mensajería
- `src/components/ProspeccionTab.tsx` — búsqueda de nuevos creadores
- `src/components/NuevaBusquedaModal.tsx` — modal para crear búsqueda
- `server/index.js` — API Express (todos los endpoints REST)
- `server/kernel/scrapers/instagram-profile.js` — scraper de Instagram (ya excluye posts pineados, calcula engagement de últimos 5 posts)
- `sql/add_evaluation_columns.sql` — historial de migraciones de BigQuery

---

## Pregunta 1 — Construcción del score del perfil

**Pregunta enviada al cliente**: ¿Cómo quieren que se construya el score de un perfil? ¿Cuánto peso le asignarían a cada etapa: evaluación de perfil, contenido orgánico y KPIs de pauta?

### Qué leer en la respuesta

Tres componentes con sus pesos relativos (pueden venir como porcentajes, puntos, o descripción cualitativa):

- **Evaluación de perfil** (calculada automáticamente por Kernel): seguidores, engagement rate, frecuencia de publicación, promedio de vistas
- **Evaluación de contenido orgánico** (carga manual): views, shares, engagement rate histórico del contenido que hicieron para la marca
- **Evaluación de KPIs de pauta** (carga manual): impresiones, alcance, CPM, frecuencia, CTR, VTR

También pueden definir umbrales mínimos por componente (ej: "si el engagement es menor a X, el score de perfil no puede superar Y").

### Cambios a implementar

#### `server/index.js`
Actualmente el score se guarda directamente como número en BigQuery. Hay que añadir una función `calcularScore(creator)` que lo recalcule en base a los pesos definidos por el cliente. Ejemplo de estructura:

```js
function calcularScore({ evaluacionPerfil, evaluacionOrganica, evaluacionPauta }, pesos) {
  const scorePerfil = calcularScorePerfil(evaluacionPerfil) * pesos.perfil;
  const scoreOrganico = calcularScoreOrganico(evaluacionOrganica) * pesos.organico;
  const scorePauta = calcularScorePauta(evaluacionPauta) * pesos.pauta;
  return Math.round(scorePerfil + scoreOrganico + scorePauta);
}
```

Los pesos deben quedar como constantes configurables al inicio del archivo (no hardcodeados dentro de queries).

#### `src/components/UGCDrawer.tsx`
El desglose del score que se muestra en el drawer debe reflejar los tres componentes con sus pesos reales y el puntaje parcial de cada uno. Actualmente hay un ejemplo placeholder; hay que reemplazarlo con los valores reales calculados.

#### `src/utils.ts`
Verificar que `scoreColor()` sigue siendo correcto con la nueva escala. Si los pesos cambian la distribución de scores, los umbrales (70+, 40+) pueden necesitar ajuste.

---

## Pregunta 2 — Métricas del resumen de campaña

**Pregunta enviada al cliente**: ¿Cuáles son las métricas que les gustaría ver en el resumen de una campaña?

### Qué leer en la respuesta

Separar lo que pidan en dos grupos:

**Métricas orgánicas** (por creador y consolidado de campaña):
- Views, likes, comentarios, shares, guardados, CTR, engagement rate del video

**Métricas de pauta** (por creador):
- Impresiones, CPM, frecuencia, CTR, VTR
- Alcance: Raissa ya aclaró en la reunión que el alcance a nivel campaña **no debe sumarse** (los AdGroups en Meta/TikTok dan un alcance deduplicado, sumar los individuales no es real). Si el cliente confirma que quiere verlo igual, mostrarlo como "alcance estimado" con una nota aclaratoria.

**Consolidado de campaña**:
- Número de creadores contactados / respondieron / calificados
- Promedios de las métricas orgánicas
- Las impresiones sí pueden sumarse (no son personas únicas)

### Cambios a implementar

#### `src/components/CampanaDetail.tsx`
Agregar una sección de métricas debajo de la lista de creadores. Dos sub-secciones:
1. **Resumen orgánico**: mostrar los campos que confirme el cliente, con promedios calculados del conjunto
2. **Resumen de pauta**: mostrar impresiones totales, CPM promedio, y alcance con nota si corresponde

#### `server/index.js`
El endpoint `GET /api/campaigns/:id` debe computar y devolver un objeto `metricas` con los totales/promedios calculados a partir de los `campaign_creators` y sus evaluaciones. No guardar las métricas calculadas en BigQuery; computarlas al vuelo.

#### `src/data.ts`
Agregar al interface `Campana` un campo opcional:
```ts
metricas?: {
  organica: { totalViews: number; promedioER: number; /* etc */ };
  pauta: { totalImpresiones: number; promedioCPM: number; /* etc */ };
}
```

#### BigQuery — `campaign_creators` tabla
Verificar si ya existen columnas para las métricas de resultado por creator-campaña. Si el cliente pide métricas que aún no tienen columna en BigQuery, crear un nuevo script de migración en `sql/` con los `ALTER TABLE ADD COLUMN` necesarios.

---

## Pregunta 3 — Centro de mensajería con IA

**Pregunta enviada al cliente**:
- ¿Cuáles son las preguntas de calificación que le hacen a un creador en el primer contacto?
- ¿Cuál es el mensaje de presentación inicial que envían?
- ¿Cuáles son las palabras clave o situaciones que deben hacer que el bot transfiera la conversación a alguien del equipo?

### Qué leer en la respuesta

**Sub-pregunta A — Preguntas de calificación**:
Una lista de preguntas tipo formulario que el bot hace al creador en el primer contacto. Ejemplo hipotético: "¿Tenés disponibilidad para la semana del 14/7?", "¿Podés hacer contenido de gastronomía?", etc. Estas preguntas deben poder definirse por campaña (no son globales).

**Sub-pregunta B — Mensaje de presentación inicial**:
El texto del primer mensaje que el bot envía. Probablemente incluye: saludo + nombre de la marca + de qué trata la campaña + invitación a responder. Este campo ya existe como `mensaje_contacto` en la tabla `campaigns` de BigQuery, pero probablemente el cliente lo quiera más estructurado o con variables dinámicas.

**Sub-pregunta C — Keywords de handoff**:
Palabras o frases que, si el creador las menciona, hacen que el bot deje de responder y avise al equipo. Ejemplos probables: "pago", "contrato", "cuánto cobran", "tarifa", "exclusividad", "quiero hablar con alguien".

### Cambios a implementar

#### BigQuery — tabla `campaigns`
Agregar dos columnas nuevas en `sql/add_evaluation_columns.sql` y ejecutar migración:
```sql
ALTER TABLE `hike-agentic-playground.ngr_ugc.campaigns`
  ADD COLUMN IF NOT EXISTS preguntas_calificacion STRING,  -- JSON array de strings
  ADD COLUMN IF NOT EXISTS keywords_handoff STRING;         -- JSON array de strings
```

#### `server/index.js`
- `POST /api/campaigns`: guardar `preguntas_calificacion` y `keywords_handoff` como JSON strings
- `GET /api/campaigns` y `GET /api/campaigns/:id`: parsear y devolver esos campos como arrays

#### `src/data.ts`
Agregar a la interface `Campana`:
```ts
preguntasCalificacion?: string[];
keywordsHandoff?: string[];
```

#### `src/components/NuevaCampanaModal.tsx`
Agregar dos nuevas secciones al formulario de creación de campaña:
1. **Preguntas de calificación**: lista de inputs de texto con botón "Agregar pregunta" y "Eliminar". Debe permitir reordenarlas.
2. **Keywords de handoff**: input de tags (el usuario escribe una palabra, presiona Enter y se agrega como chip). Pre-cargar con las keywords que el cliente haya confirmado.

#### `src/components/CampanaDetail.tsx`
Mostrar en la vista de detalle las preguntas configuradas y las keywords de handoff, en modo solo lectura. Agregar botón para editarlas.

#### `src/components/ChatsTab.tsx`
En el panel de una conversación, mostrar un indicador cuando el bot detectó una keyword de handoff y está esperando intervención humana. Agregar la posibilidad de marcar una conversación como "tomada por humano".

---

## Pregunta 4 — Etiquetas personalizadas

**Pregunta enviada al cliente**: ¿Cuáles son las etiquetas personalizadas que más usan para clasificar creadores? (Ej: "aesthetic", "lifestyle", "deportes", etc.)

### Qué leer en la respuesta

Una lista de etiquetas con sus nombres. Prestar atención a si tienen categorías anidadas (ej: "deportes > fútbol") o son todas al mismo nivel. Lo más probable es que sea una lista plana.

### Cambios a implementar

#### BigQuery — tabla `creators`
Verificar si ya existe una columna `etiquetas` o `tags`. Si no existe, agregar:
```sql
ALTER TABLE `hike-agentic-playground.ngr_ugc.creators`
  ADD COLUMN IF NOT EXISTS etiquetas STRING;  -- JSON array de strings
```

#### `server/index.js`
- `GET /api/creators`: incluir `etiquetas` en la respuesta (parseado como array)
- `PUT /api/creators/:id`: permitir actualizar `etiquetas`
- Agregar endpoint `GET /api/tags` que devuelva todas las etiquetas únicas usadas en el sistema (para autocompletar)

#### `src/data.ts`
Si no está, agregar `etiquetas?: string[]` al interface `UGC`.

#### `src/components/UGCsTab.tsx`
Agregar filtro por etiquetas en la barra de filtros existente. El filtro debe permitir seleccionar múltiples etiquetas (AND u OR, confirmar con el cliente cuál prefieren).

#### `src/components/UGCDrawer.tsx`
Agregar sección de gestión de etiquetas en el panel de detalle:
- Mostrar etiquetas actuales como chips
- Input con autocompletar (sugiere etiquetas existentes) para agregar nuevas
- Botón X en cada chip para eliminar
- Al guardar, hacer PUT al endpoint

#### Seed de etiquetas iniciales
Crear un script `sql/seed-etiquetas.js` que haga UPDATE en todos los creadores existentes para asignarles las etiquetas más evidentes según su categoría de Instagram (`eval_perfil_categoria`). Las etiquetas base que el cliente confirme deben quedar documentadas en ese script como constante.

---

## Pregunta 5 — Datos históricos y Excel de pauta

**Pregunta enviada al cliente**: ¿Tienen una base de datos con los creadores con los que ya trabajaron y sus métricas históricas? Y el Excel de pauta que habías compartido antes, Raissa, ¿sigue siendo el de referencia?

### Qué leer en la respuesta

**Sub-pregunta A — Base de creadores históricos**:
Puede venir como un Excel/CSV con columnas de handle de Instagram/TikTok, métricas orgánicas (views, ER, shares) de contenido que hicieron para NGR, y métricas de pauta (CPM, impresiones, etc.). El formato exacto puede variar.

**Sub-pregunta B — Excel de pauta**:
Raissa ya había enviado un Excel con columnas de evaluación de pauta. Si confirman que es el mismo, usarlo como referencia para las columnas del scoring. Si mandan uno actualizado, usarlo como la nueva referencia.

### Cambios a implementar

#### Script de carga de históricos
Crear `sql/seed-historical-creators.js`. Este script debe:
1. Leer el archivo CSV/Excel que el cliente comparta (acordar el formato: CSV UTF-8 es lo más fácil de parsear)
2. Para cada fila, hacer UPSERT en BigQuery:
   - Si el creador ya existe (match por `username`): actualizar sus campos de evaluación orgánica y de pauta
   - Si no existe: insertarlo con estado `Nuevo` y cargarle las evaluaciones

El script debe loguear cuántos creadores insertó vs actualizó vs falló.

#### `src/components/UGCDrawer.tsx`
Los formularios de evaluación orgánica y de pauta ya existen, pero revisar que los campos coincidan exactamente con las columnas del Excel que el cliente confirme. Si el Excel tiene campos adicionales no contemplados, agregar las columnas en BigQuery y los inputs en el formulario.

#### Sistema de 3 etapas de completitud
Según la reunión del 2/06, los creadores se dividen en tres casos:
1. **Sólo perfil**: creadores nuevos, sólo tienen datos de Kernel
2. **Perfil + orgánico**: ya trabajaron con NGR, tienen historial de contenido orgánico
3. **Perfil + orgánico + pauta**: trabajaron con NGR y su contenido fue pauteado

En `src/components/UGCsTab.tsx`, agregar un filtro o indicador visual que distinga estos tres estados (actualmente `needsInfoUpdate()` en `src/utils.ts` hace algo similar, pero hay que asegurarse que mapea correctamente los tres casos).

---

## Cambios ya definidos que NO dependen de las respuestas

Estos cambios surgieron de la reunión del 17/06 y están completamente especificados. Pueden implementarse en paralelo mientras se espera la respuesta del cliente.

### 1. Agregar TikTok al perfil de cada creador
- `server/kernel/scrapers/`: crear `tiktok-profile.js` análogo a `instagram-profile.js`
- `server/kernel/index.js`: incluir TikTok en el loop de scraping
- `src/components/UGCDrawer.tsx`: mostrar las métricas de TikTok junto a las de Instagram (separadas por tab o sección)
- `src/data.ts`: agregar campos `eval_perfil_tiktok_*` en la interface `EvaluacionPerfil`
- BigQuery: agregar columnas `eval_perfil_tiktok_*` en la tabla `creators`

### 2. Excluir YouTube y Facebook del formulario de búsqueda
- `src/components/NuevaBusquedaModal.tsx`: eliminar las opciones de YouTube y Facebook del selector de plataformas. Dejar solo Instagram y TikTok.

### 3. Idioma predeterminado en español
- `src/components/NuevaBusquedaModal.tsx`: si existe un campo de idioma, establecer "Español" como valor por defecto pero dejarlo editable.

### 4. Nueva pestaña de Recomendaciones
- `src/App.tsx`: agregar un quinto tab "Recomendaciones"
- `src/components/RecomendacionesTab.tsx`: crear este componente. Debe mostrar los top creadores rankeados por score actual, con indicadores de crecimiento reciente (comparar `eval_perfil_seguidores` actual vs histórico si está disponible). La lógica de recomendación puede ser: ordenar por score DESC, filtrar por los que tuvieron mayor crecimiento en seguidores en el último mes.
- `server/index.js`: agregar endpoint `GET /api/recomendaciones` que aplique esta lógica en BigQuery

---

## Estado actual del sistema (referencia para el nuevo chat)

| Funcionalidad | Estado |
|---|---|
| Scraping Instagram (engagement, vistas, seguidores) | ✅ Implementado |
| Posts pineados excluidos del cálculo | ✅ Implementado |
| Formulario evaluación orgánica (carga manual) | ✅ Implementado |
| Formulario evaluación de pauta (carga manual) | ✅ Implementado |
| Score total con desglose | ✅ Implementado (pesos son placeholder) |
| Sistema de etiquetas | ⚠️ Parcial (se muestran, no se gestionan) |
| TikTok en perfil de creador | ❌ No implementado |
| Métricas de resumen a nivel campaña | ❌ No implementado |
| Preguntas de calificación por campaña | ❌ No implementado |
| Keywords de handoff para el bot | ❌ No implementado |
| Centro de mensajería con IA (Evolution API + N8N) | ⚠️ Estructura de chats existe, integración pendiente |
| Pestaña de Recomendaciones | ❌ No implementado |
| Carga de datos históricos desde CSV | ❌ No implementado |
