# Paper & Ink Design System

**Paper & Ink Reader** is the primary visual and UX reference across the Paper & Ink product suite (**Reader**, **Notes**, and **News**). Shared tokens and reusable primitives live in [`packages/design-system/`](packages/design-system/index.ts), derived directly from Reader's tactile paper palette, serif/sans typographic pairing, rounded physical geometry, and calm navigation conventions.

---

## 1. Visual Philosophy & Product Hierarchy

1. **Paper & Ink Reader (Canonical Reference):** Warm paper canvas, tactile book cards, hairline dividers, uncluttered sticky header, and a distraction-free long-form reading view with floating bottom controls.
2. **Paper & Ink Notes (Studio & Canvas Preservation):** Preserves its three-tier shelf layout, cloth-textured notebook covers, ruled/dotted/blank writing paper, and `perfect-freehand` ink canvas while sharing the warm paper palette, header primitives, Dark Desk theme persistence, and account modal/switcher.
3. **Paper & Ink News (Editorial Redesign):** Replaces bright/generic UI treatments with Reader's warm paper surfaces, `Fraunces` display headlines, `Source Serif 4` article prose, `24px` sheet cards with restrained left-accent category strips, a calm sticky search/filter header, and a Reader-inspired article reading view with a floating bottom control pill and drop-cap prose.

---

## 2. Color & Surface Tokens

Defined in [`packages/design-system/tokens/tokens.css`](packages/design-system/tokens/tokens.css) and mirrored programmatically in [`packages/design-system/tokens/index.ts`](packages/design-system/tokens/index.ts).

### Light ("Warm Paper") Surfaces
| Role | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| Primary background | `--pi-paper` / `--pi-bg` | `#F6EFE4` | Application background across Reader, Notes, News |
| Elevated surface | `--pi-paper-elevated` / `--pi-surface` | `#FBF7F0` | Cards, modals, floating pills, headers |
| Muted surface | `--pi-paper-muted` / `--pi-surface-muted` | `#ECE3D4` | Secondary pills, inactive tabs, subtle wells |
| Primary ink | `--pi-ink` / `--pi-text` | `#1F2A3A` | Headings, UI ink, crisp body text |
| Muted ink | `--pi-ink-muted` / `--pi-text-muted` | `rgba(31, 42, 58, 0.65)` / `0.68` | Subtitles, metadata, reading time, timestamps |
| Hairline borders | `--pi-border` / `--pi-border-strong` | `rgba(31, 42, 58, 0.1)` / `0.18` | Card borders, section dividers, input outlines |

### Brand & Editorial Accents
| Role | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| Terracotta (Primary Accent) | `--pi-terracotta` / `--pi-accent` | `#C4572F` | Primary CTAs, active reading indicators, focus outlines, top-story markers |
| Terracotta Hover | `--pi-terracotta-hover` | `#AE4823` | Hover/pressed state on terracotta controls |
| Sage | `--pi-sage` | `#526B59` | Culture/Nature accents, secondary cover pigments, positive status |
| Tan | `--pi-tan` | `#9D7B52` | Sports/Archive accents, warm trim |
| Wine | `--pi-wine` | `#7A3229` | Editorial politics category strip (News) |

### Reading Themes
- **Warm Paper (`light` / default):** `--pi-bg: #F6EFE4`, `--pi-surface: #FBF7F0`, `--pi-text: #1F2A3A`.
- **Sepia (`[data-theme='sepia']` / `.pi-theme-sepia`):** `--pi-bg: #ECE0CB`, `--pi-surface: #F4EAD7`, `--pi-surface-muted: #E3D4BA`, `--pi-text: #2B241A`. Used across Reader and News article views for extended long-form reading comfort.
- **Dark Desk (`[data-theme='dark']` / `.pi-theme-dark` / `html.dark`):** `--pi-bg: #141A16`, `--pi-surface: #1B231E`, `--pi-surface-muted: #222B25`, `--pi-text: #ECE5D8`, `--pi-border: rgba(236, 229, 216, 0.12)`. Supported consistently across Reader, Notes (persisted per account scope), and News.

### News Category Accents (`news-web/src/design/tokens.css`)
News preserves restrained editorial category differentiation via desaturated tones that shift harmoniously in `html.dark`:
- **Top Story:** `#C4572F` (dark: `#E07046`)
- **Tech:** `#2D5A7B` (dark: `#689BC0`)
- **Politics:** `#7A3229` (dark: `#D46A5E`)
- **Culture:** `#526B59` (dark: `#7EA088`)
- **Sports:** `#9D7B52` (dark: `#C6A06F`)
- **Science:** `#3E6659` (dark: `#6DA392`)

### Reader Acrylic Shelves (`reader-web/src/index.css`)
Reader uses translucent pigments (`~56%–62%` alpha with subtle depth) for physical shelf ledges:
- `--pi-acrylic-terracotta: rgba(196, 87, 47, 0.56)`
- `--pi-acrylic-sage: rgba(88, 118, 96, 0.56)`
- `--pi-acrylic-navy: rgba(31, 42, 58, 0.62)`
- `--pi-acrylic-tan: rgba(171, 136, 92, 0.56)`

---

## 3. Typography

All three apps load Google Fonts (`Fraunces`, `Source Serif 4`, `Lora`, `Figtree`, `JetBrains Mono`) in their `index.html`:

| Role | Token | Font Family | Usage |
| :--- | :--- | :--- | :--- |
| Display / Editorial Headlines | `--pi-font-display` | `'Fraunces', Georgia, serif` | App wordmarks, story titles, book titles, modal headings, News drop-cap |
| Long-Form Reading | `--pi-font-serif` | `'Source Serif 4', 'Lora', Georgia, serif` | Book prose, news article body, handwritten transcription view, quotes |
| UI & Chrome | `--pi-font-sans` | `'Figtree', system-ui, -apple-system, sans-serif` | Navigation, chips, form controls, timestamps, metadata |
| Technical / Code / Counters | `--pi-font-mono` | `'JetBrains Mono', ui-monospace, monospace` | Page counters, telemetry percentages, `@username` handles |

Note: Notes also retains `'Newsreader'` in its notebook cover/paper styling (`notes-web/src/design/tokens.css`) for continuity with its notebook aesthetic while aligning UI chrome with `Figtree` and `Fraunces`.

---

## 4. Radii, Spacing, Shadows & Motion

- **Corner Radii (`tokens.css` & `tokens/index.ts`):**
  - Sheet / Feature Card: `--pi-radius-sheet: 24px` (`radii.sheet: 24`)
  - Standard Card / Modal / Popover: `--pi-radius-card: 16px` (`radii.card: 16`)
  - Control / Input / Compact Button: `--pi-radius-control: 12px` (`radii.control: 12`)
  - Pill / Badge / Avatar / Search Capsule: `--pi-radius-pill: 9999px` (`radii.pill: 9999`)
- **Spacing Scale (`tokens/index.ts`):** `xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`, `2xl: 48px`.
- **Elevation Shadows (`tokens.css`):**
  - `--pi-shadow-soft`: `0 2px 10px -2px rgba(31, 42, 58, 0.06)` (controls, sticky headers)
  - `--pi-shadow-card`: `0 8px 24px -6px rgba(31, 42, 58, 0.1)` (cards, popovers)
  - `--pi-shadow-float`: `0 18px 40px -12px rgba(31, 42, 58, 0.18)` (modals, floating bottom reader bars)
- **Motion:** `--pi-ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--pi-duration-fast: 150ms`, `--pi-duration-base: 220ms`, with subtle press feedback (`active:scale-[0.98]`).
- **Focus Ring:** `.pi-focus-ring:focus-visible` renders a `2px solid var(--pi-accent)` outline with `2px` offset.

---

## 5. Shared UI Primitives (`packages/design-system/`)

Exported from [`packages/design-system/index.ts`](packages/design-system/index.ts):
- **`Button`** (`primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`; built-in `loading` spinner)
- **`IconButton`** (`ghost`, `surface`, `active`; accessible `aria-label` required)
- **`Card`** (`elevated`, `muted`, `outlined`; rounded `16px` / `24px`)
- **`Badge`** (subtle pill status tags and topic labels)
- **`Input`** (warm elevated input with inline label, helper, and error feedback)
- **`Modal`** (backdrop blur, escape/click-outside dismissal, warm elevated dialog frame)
- **`Divider`** (hairline horizontal or vertical separator)
- **`ErrorBoundary`** (resilient fallback panel matching Paper Cream / Dark Desk)
- **`AppSwitcher`** (adaptive navigation control: displays the active app badge alone when hosted standalone, or opens a suite switcher showing each configured app's `icon.png`, tagline, and link)
- **`AuthModal`** & **`AccountMenu`** (username + name + password + optional avatar sign-up, sign-in, profile photo/name editing, sign-out)
- **`PostOnboardingAuthView`** (Reader-styled welcome card shown after onboarding when signed out, offering Sign In, Create Account, and Continue as Guest)

---

## 6. Responsive & Iconography Rules

- **Icons:** Lucide stroke icons (`lucide-react`) across controls with balanced `1.75` stroke weight; application branding uses each app's own PNG icon (`./icon.png` in production builds).
- **Layout & Navigation:**
  - Desktop (`>= 1024px`): spacious max-width grids (`max-w-5xl` / `max-w-6xl`), inline navigation pills, sticky top header (`backdrop-blur-md`).
  - Tablet & Mobile (`375px–1023px`): fluid 1-to-2 column cards, horizontally scrollable filter chips, safe touch targets (`>= 36px–44px`), and zero horizontal overflow (`overflow-x-hidden`).
