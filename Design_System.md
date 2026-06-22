# Sistema de Diseño — UGC Flow

Este documento establece las directrices visuales, de componentes y de estilo para el proyecto **UGC Flow**. Está diseñado para garantizar una interfaz moderna, profesional y consistente, adaptada tanto para **Light Mode** como para **Dark Mode**, utilizando **Tailwind CSS v4** y la tipografía **DM Sans**.

---

## 1. Filosofía de Diseño

El sistema de diseño de UGC Flow busca transmitir **profesionalismo, modernidad y agilidad**. 
* **Estructura Limpia:** Amplios espacios en blanco, alineación rigurosa y grillas ordenadas para dashboards claros.
* **Profundidad y Elevación:** Uso de sombras sutiles en lugar de bordes gruesos para separar capas visuales.
* **Esquinas Suaves:** Bordes redondeados consistentes (`rounded-xl` y `rounded-2xl`) para una estética amigable pero profesional.
* **Interactividad Responsiva:** Transiciones fluidas en estados hover/active y micro-animaciones en botones e interactivos.

---

## 2. Paleta de Colores — Ámbar Puro

El sistema usa la estrategia **Restrained**: el naranja de marca `#fc9a00` (H≈72 en OKLCH) actúa como único acento real. Los neutrales dejan de ser Slate frío (H≈264) y se tiñen hacia el mismo hue del naranja con chroma mínimo (0.005–0.016), creando cohesión subconsciente sin añadir un segundo color. El resultado: el naranja deja de "flotar" sobre un chrome frío y la interfaz pasa de genérica a coherente.

> **Regla invariable:** No volver jamás a Slate (`H≈257-265`) para superficies y texto. El hue de los neutrales es siempre **H 68–74** (ámbar), con chroma bajísimo. El naranja es el único color de acento.

### A. Brand y Acentos

| Token CSS | Valor | Uso |
| :--- | :--- | :--- |
| `--color-brand` | `#fc9a00` | Botones primarios, nav activo, foco, sliders, badges de campaña |
| `--color-brand-hover` | `#e08500` | Estado hover del brand |
| `--color-brand-light` | `#fff7e6` | Fondo de chips, badges seleccionados, highlight de filtros activos |
| `--color-brand-border` | `#fcd580` | Borde de elementos brand-tinted |
| `--color-brand-muted` | `#f98631` | Avatar gradient, elementos secundarios cálidos |
| `--color-danger` | `#db3c3c` | Acciones destructivas, estados de error |
| `--color-danger-hover` | `#c02b2b` | Hover de peligro |

### B. Neutrales — Modo Claro (Ámbar Puro)

Todos los valores en OKLCH. El chroma es lo suficientemente bajo como para que el tinte no sea obvio, pero suficiente para que el ojo sienta coherencia con el naranja.

| Token CSS | Valor OKLCH | Descripción |
| :--- | :--- | :--- |
| `--color-bg-app` | `oklch(97.5% 0.010 74)` | Fondo general de la app — blanco cálido muy suave |
| `--color-surface` | `oklch(99.5% 0.005 74)` | Cards, modales, drawers — casi blanco con aliento ámbar |
| `--color-surface-alt` | `oklch(96.8% 0.013 73)` | Fondo de tab bar, tabla header, footers — un tono más denso |
| `--color-border` | `oklch(90.5% 0.016 73)` | Bordes estándar de cards, inputs, tablas |
| `--color-border-subtle` | `oklch(94.8% 0.009 74)` | Divisores interiores, separadores suaves |
| `--color-text-1` | `oklch(16% 0.022 68)` | Texto principal — near-black cálido |
| `--color-text-2` | `oklch(44% 0.015 70)` | Texto secundario — gris cálido medio |
| `--color-text-3` | `oklch(70% 0.010 72)` | Texto muted — gris cálido claro |

### C. Neutrales — Modo Oscuro

El dark mode mantiene superficies frescas (azul-oscuro). En dark mode, el calor lo aporta el naranja contra el fondo oscuro — no es necesario tintar las superficies.

| Token CSS | Valor | Descripción |
| :--- | :--- | :--- |
| `--color-bg-app` | `#090A0F` | Negro profundo con matiz azulado |
| `--color-surface` | `#13151E` | Superficies elevadas |
| `--color-surface-alt` | `#1A1D29` | Superficies secundarias |
| `--color-border` | `#222635` | Bordes en dark |
| `--color-border-subtle` | `#1B1E2B` | Bordes sutiles en dark |
| `--color-text-1` | `#F8FAFC` | Texto principal en dark |
| `--color-text-2` | `#94A3B8` | Texto secundario en dark |
| `--color-text-3` | `#475569` | Texto muted en dark |

### D. Colores fijos intencionales (no usar CSS vars aquí)

Los siguientes colores son **fijos** — no deben reemplazarse por CSS vars — porque deben ser legibles con los fondos pasteles de las tarjetas de campañas en ambos modos:

| Uso | Color fijo | Por qué es fijo |
| :--- | :--- | :--- |
| Texto heading en tarjetas de campaña | `#111827` | Siempre oscuro sobre pasteles claros |
| Texto secondary en tarjetas de campaña | `#6b7280` | Siempre gris medio sobre pasteles claros |
| Hover verde (ícono chat) | `#ecfdf5` / `#059669` | Color semántico de "mensaje/éxito" |
| Hover rojo (ícono eliminar) | `#fff1f2` / `#e11d48` | Color semántico de "peligro" |
| Colores de canal (WhatsApp/Instagram/Email) | brand hex de cada plataforma | Identidad de terceros |

---

## 3. Tipografía

El proyecto utiliza **DM Sans** para toda la interfaz (títulos, cuerpo, etiquetas) y **DM Mono** para elementos que contengan código o datos técnicos estructurados.

```css
/* Definición de la Jerarquía Tipográfica */
--font-sans: 'DM Sans', system-ui, sans-serif;
--font-mono: 'DM Mono', monospace;
```

### Escala de Tamaños y Pesos

| Nivel | Tamaño | Tailwind Class | Peso (Weight) | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Display Title** | 30px / 1.875rem | `text-3xl` | Bold (700) | Pantallas de bienvenida o KPIs gigantes. |
| **Page Title (H1)** | 24px / 1.5rem | `text-2xl` | Bold (700) | Títulos principales de páginas. |
| **Section Title (H2)** | 20px / 1.25rem | `text-xl` | SemiBold (600) | Títulos de secciones o modales. |
| **Sub-header (H3)** | 16px / 1rem | `text-base` | Medium (500) | Títulos de tarjetas o campos de formulario. |
| **Body (Normal)** | 14px / 0.875rem | `text-sm` | Regular (400) | Texto principal de descripción y tablas. |
| **Caption / Small** | 12px / 0.75rem | `text-xs` | Medium / Regular | Metadatos, etiquetas de estado, timestamps. |

---

## 4. Estados y Semáforo (UGC Status Colors)

Para el flujo de campañas y aprobación de UGC, se establecen los siguientes esquemas de colores semánticos. Se aconseja usar combinaciones de fondo suave con texto oscuro para mantener una buena legibilidad.

| Estado | Significado | Modo Claro (Light) | Modo Oscuro (Dark) |
| :--- | :--- | :--- | :--- |
| **Aprobado / Activo** | UGC validado o campaña publicada. | `bg-emerald-50 text-emerald-700` | `bg-emerald-500/10 text-emerald-400` |
| **Pendiente / Revisión** | UGC por revisar o campaña en espera. | `bg-amber-50 text-amber-700` | `bg-amber-500/10 text-amber-400` |
| **Rechazado / Cancelado** | UGC no apto o campaña detenida. | `bg-rose-50 text-rose-700` | `bg-rose-500/10 text-rose-400` |
| **Borrador / Draft** | Campaña/UGC aún no enviado. | `bg-slate-100 text-slate-700` | `bg-slate-800 text-slate-300` |

---

## 5. Especificaciones de Componentes

### A. Botones (Buttons)
Los botones deben tener esquinas redondeadas suavizadas (`rounded-xl` / `12px`), transiciones rápidas (`transition-all duration-200`) y sombras sutiles.

* **Botón Primario (Call to Action):**
  * Fondo: `#fc9a00` | Hover: `#e08500` | Texto: Blanco (`text-white`)
  * Sombras: `shadow-md shadow-orange-500/10`
* **Botón Secundario (Borde / Outline):**
  * Light: Fondo blanco, borde `slate-200`, texto `slate-700`. Hover: Fondo `slate-50`.
  * Dark: Fondo transparente, borde `slate-700`, texto `slate-300`. Hover: Fondo `slate-800`.
  * Sombra: `shadow-sm`
* **Botón de Peligro / Eliminar (Danger):**
  * Fondo: `#db3c3c` | Hover: `#c02b2b` | Texto: Blanco
  * Sombra: `shadow-md shadow-red-500/10`

### B. Tarjetas (Cards)
Las tarjetas son los contenedores clave del dashboard de campañas y UGCs.
* **Esquinas:** `rounded-2xl` (`16px`).
* **Estilo Light:** Fondo `#FFFFFF`, sombra sutil `shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]` (o `shadow-sm`), sin borde o borde sutil `border border-slate-100`.
* **Estilo Dark:** Fondo `#13151E`, borde muy fino `border border-slate-800/80`, sin sombra o sombra difusa negra.
* **Hover (Interactivas):** Transformación leve hacia arriba (`hover:-translate-y-1`) y aumento del contraste de la sombra.

### C. Campos de Formulario (Inputs)
* **Radio de esquina:** `rounded-xl` (`12px`).
* **Borde base:** `border-slate-200` (Light) | `border-slate-800` (Dark).
* **Foco (Focus State):** Borde primary (`#fc9a00`) y anillo de foco exterior (`ring-2 ring-orange-500/20` o similar).
* **Fondo:** `#FFFFFF` (Light) | `#1A1D29` (Dark).

### D. Modales y Cajones (Modals & Drawers)
* **Overlay (Fondo de atrás):** Fondo oscuro con efecto traslúcido: `bg-slate-950/40 backdrop-blur-md` (Light) | `bg-black/60 backdrop-blur-md` (Dark).
* **Cuerpo del Modal:** Esquinas `rounded-2xl` (`16px`).
* **Entrada de Animación:** 
    * Modales: Escala sutil (`scale-95` a `scale-100`) con `duration-200 ease-out`.
    * Drawers: Deslizamiento desde la derecha (`translate-x-full` a `translate-x-0`).

---

## 6. Configuración de Tailwind CSS v4

Tailwind CSS v4 usa la directiva `@theme` en `src/index.css`. Los tokens de color son CSS custom properties resueltas nativamente por el browser. OKLCH es soportado en todos los browsers modernos (Chrome 111+, Firefox 113+, Safari 15.4+).

Los nombres exactos de tokens que usa el código son los siguientes. **No crear aliases ni nombres alternativos.**

```css
@import "tailwindcss";

@theme {
  /* Fuentes */
  --font-sans: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'DM Mono', monospace;

  /* Brand */
  --color-brand:           #fc9a00;
  --color-brand-hover:     #e08500;
  --color-brand-light:     #fff7e6;
  --color-brand-border:    #fcd580;
  --color-brand-muted:     #f98631;
  --color-danger:          #db3c3c;
  --color-danger-hover:    #c02b2b;

  /* Neutrales Light — Ámbar Puro (H 68-74, chroma 0.005-0.022) */
  --color-bg-app:          oklch(97.5% 0.010 74);
  --color-surface:         oklch(99.5% 0.005 74);
  --color-surface-alt:     oklch(96.8% 0.013 73);
  --color-border:          oklch(90.5% 0.016 73);
  --color-border-subtle:   oklch(94.8% 0.009 74);
  --color-text-1:          oklch(16%   0.022 68);
  --color-text-2:          oklch(44%   0.015 70);
  --color-text-3:          oklch(70%   0.010 72);

  /* Sombras */
  --shadow-card:           0 1px 8px -2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  --shadow-card-hover:     0 4px 20px -4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06);
  --shadow-btn-brand:      0 4px 14px -3px rgba(252,154,0,0.30);
  --shadow-drawer:         -8px 0 40px -8px rgba(0,0,0,0.15);
  --shadow-modal:          0 20px 60px -10px rgba(0,0,0,0.25);
}

/* Dark mode — superficies oscuras frescas, el calor lo da el naranja */
.dark {
  --color-bg-app:          #090A0F;
  --color-surface:         #13151E;
  --color-surface-alt:     #1A1D29;
  --color-border:          #222635;
  --color-border-subtle:   #1B1E2B;
  --color-text-1:          #F8FAFC;
  --color-text-2:          #94A3B8;
  --color-text-3:          #475569;
}
```

---

## 7. Directrices de Implementación

1. **Usa variables semánticas:** En lugar de escribir clases como `bg-white dark:bg-zinc-900`, prioriza clases semánticas mapeadas o configura tus colores usando las variables `--color-surface-app`.
2. **Sombras sutiles:** Nunca uses sombras duras oscuras en modo claro. Prefiere opacidades muy bajas (entre 3% y 6%). En modo oscuro, las sombras apenas son visibles, por lo que el contraste se define mediante un borde sutil (`border-slate-800`).
3. **Micro-interacciones:** Cualquier botón debe responder con un cambio de escala rápido o traducción sutil:
   ```html
   <button class="bg-brand-primary hover:bg-brand-primary-hover shadow-btn-primary text-white rounded-xl px-4 py-2 transition-all duration-200 active:scale-[0.98]">
     Nuevo UGC
   </button>
   ```
