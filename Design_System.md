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

## 2. Paleta de Colores

Para mantener la profesionalidad con el color de marca `#fc9a00` (un naranja/ámbar vibrante) y los colores secundarios llamativos (`#f98631` y `#db3c3c`), los balanceamos con una paleta neutra fría y elegante (Slate) y usaremos los colores brillantes de forma táctica en acentos, botones primarios e indicadores de estado.

### A. Primarios y Secundarios (Acentos)

| Rol | Valor Hex | Muestra | Uso Principal |
| :--- | :--- | :--- | :--- |
| **Primary (Brand)** | `#fc9a00` | 🟧 | Botones primarios, enlaces activos, branding, bordes de foco. |
| **Primary Hover** | `#e08500` | 🟧 | Estado hover del botón primario. |
| **Secondary Accent** | `#f98631` | 📙 | Elementos interactivos secundarios, tabs activos secundarios. |
| **Destructive/Alert** | `#db3c3c` | 🟥 | Acciones destructivas (eliminar), estados de rechazo/error. |

### B. Neutros (Superficies y Texto)

#### ☀️ Modo Claro (Light Mode)
* **Background General:** `#F8F9FA` (`bg-slate-50`)
* **Superficies (Cards, Modales):** `#FFFFFF` (`bg-white`)
* **Texto Principal:** `#0F172A` (`text-slate-900` / `text-slate-950`)
* **Texto Secundario:** `#475569` (`text-slate-600`)
* **Bordes / Divisiones:** `#E2E8F0` (`border-slate-200`)
* **Bordes Sutiles:** `#F1F5F9` (`border-slate-100`)

#### 🌙 Modo Oscuro (Dark Mode)
* **Background General:** `#090A0F` (Negro profundo con matiz azulado)
* **Superficies (Cards, Modales):** `#13151E` (Gris oscuro azulado satinado)
* **Texto Principal:** `#F8FAFC` (`text-slate-50`)
* **Texto Secundario:** `#94A3B8` (`text-slate-400`)
* **Bordes / Divisiones:** `#222635` (Gris-azul oscuro para líneas limpias)
* **Bordes Sutiles:** `#1B1E2B` (Bordes secundarios de menor contraste)

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

Con la llegada de **Tailwind CSS v4**, la configuración se realiza directamente mediante la directiva `@theme` dentro de tu archivo CSS principal (ej: `src/index.css`), sin necesidad de un archivo `tailwind.config.js`.

Aquí tienes cómo estructurar tus variables en `src/index.css` para soportar todo lo anterior:

```css
@import "tailwindcss";

@theme {
  /* Fuentes */
  --font-sans: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'DM Mono', monospace;

  /* Colores de Marca */
  --color-brand-primary: #fc9a00;
  --color-brand-primary-hover: #e08500;
  --color-brand-secondary: #f98631;
  --color-brand-danger: #db3c3c;
  --color-brand-danger-hover: #c02b2b;

  /* Colores del Sistema (Claro por defecto) */
  --color-bg-app: #F8F9FA;
  --color-surface-app: #FFFFFF;
  --color-border-app: #E2E8F0;
  --color-border-subtle: #F1F5F9;
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;

  /* Bordes redondeados */
  --radius-xl: 12px;
  --radius-2xl: 16px;

  /* Sombras personalizadas */
  --shadow-premium-light: 0 4px 20px -4px rgba(0, 0, 0, 0.05);
  --shadow-btn-primary: 0 4px 12px -2px rgba(252, 154, 0, 0.15);
}

/* Modificadores para Modo Oscuro (usando la clase 'dark' en el html/body) */
.dark {
  --color-bg-app: #090A0F;
  --color-surface-app: #13151E;
  --color-border-app: #222635;
  --color-border-subtle: #1B1E2B;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --shadow-premium-light: none;
}

@layer base {
  body {
    background-color: var(--color-bg-app);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    transition: background-color 0.3s ease, color 0.3s ease;
  }
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
