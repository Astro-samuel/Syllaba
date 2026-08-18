---
name: Syllaba
description: Free, open-source syllabus-to-calendar and grade tracker for students
colors:
  bg: "#E5EBF4"
  sidebar: "#EAEFF7"
  card: "#FFFFFF"
  navy: "#1D1F2D"
  navy-hover: "#282B3D"
  text: "#1E202C"
  muted: "#64748B"
  border: "#D8E0EE"
  accent-purple: "#7C67E6"
  accent-purple-tint: "#B5A6F8"
  accent-peach: "#d9a155ff"
  accent-peach-tint: "#FCE7C7"
  accent-lime: "#7A8C10"
  accent-lime-tint: "#E2F86B"
  accent-cyan: "#3DA8AF"
  accent-cyan-tint: "#C3F3F6"
  accent-pink: "#E66B87"
  accent-pink-tint: "#FFD2DD"
typography:
  display:
    fontFamily: "Syne, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.navy-hover}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  nav-item-active:
    backgroundColor: "{colors.navy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
---

# Design System: Syllaba

## 1. Overview

**Creative North Star: "The Kept Planner"**

Syllaba should feel like a well-kept paper planner turned digital — a calm surface a student trusts enough to stop double-checking the original syllabus PDF against. The system is light, airy, and unhurried: a soft blue-grey backdrop, white cards that hold real weight (deep, diffuse shadows rather than borders), and a single confident navy used sparingly for anything that matters right now (active nav, primary actions, today's date). Category and course identity are carried by a small family of pastel tints, never by gradients or neon.

This explicitly rejects two other directions the app could have taken: the "hacker dashboard" look (dark backgrounds, neon glow badges, glassmorphism) reads as a dev tool, not a study tool, and undermines the calm-and-trustworthy brand; and the "gamified edtech" look (bright primary colors, cartoon mascots, badge-spam) reads as childish and erodes trust for a tool students rely on to not miss a deadline. Playful moments — the streak flame, confetti on completion — are earned rewards inside the calm system, not the dominant tone.

**Key Characteristics:**
- Soft cool-grey canvas (`#E5EBF4`) with pure white cards floating on it via shadow, not border
- One authority color (navy `#1D1F2D`) for anything active/primary; everything else stays quiet
- Pastel tint family (purple/peach/lime/cyan/pink) for course color-coding and type badges — always paired with text, never color-only
- Generous corner radii (16–24px) throughout — soft, planner-like, never sharp
- Left sidebar for primary navigation (mirrors Upahead's app shell, since this positions itself as Upahead's free alternative)

## 2. Colors

A single cool-neutral base carries the whole app; color is spent deliberately on the navy authority tone and the pastel course/type tags.

### Primary
- **Ink Navy** (`#1D1F2D`): the one saturated-dark color in the system. Used for the active sidebar item, primary buttons, headings, today's date marker, and the sidebar logo mark. If it's the most important thing on screen, it's navy.

### Secondary
- **Violet Tint** (`#B5A6F8` / deep `#7C67E6`): default course-color and primary accent for extraction/AI-related moments (the sparkle, the review-modal accent dot).

### Tertiary
- **Peach, Lime, Cyan, Pink tints**: the remaining course-color palette a student picks when importing a syllabus (`#FCE7C7`/`#D9A155`, `#E2F86B`/`#7A8C10`, `#C3F3F6`/`#3DA8AF`, `#FFD2DD`/`#E66B87`). Each tint always pairs with its own darker "ink" shade for the label text sitting on it, so contrast never depends on the base tint alone.

### Neutral
- **Canvas** (`#E5EBF4`): the app background — a soft blue-grey, never pure white, so white cards visibly float.
- **Sidebar Wash** (`#EAEFF7`): a half-step lighter than canvas, just enough to separate the nav rail from the content well without a hard line.
- **Card White** (`#FFFFFF`): every content surface.
- **Body Text** (`#1E202C`): default text ink.
- **Muted Text** (`#64748B`): secondary labels, timestamps, helper copy — must still clear 4.5:1 on white.
- **Hairline** (`#D8E0EE`): dividers and card borders where a shadow alone isn't enough definition (tables, list rows).

### Named Rules
**The One Authority Rule.** Navy appears on at most one primary element per view — the active nav item, or the one primary CTA. It never appears twice competing for attention in the same glance.

**The Tint-Plus-Text Rule.** No pastel tint carries meaning alone. Every course/type badge pairs its background tint with visible text (course code, type name) — never a bare color dot standing in for a category.

## 3. Typography

**Display Font:** Syne (with system sans-serif fallback)
**Body Font:** Plus Jakarta Sans (with system sans-serif fallback)

**Character:** Syne's geometric, slightly architectural caps give page titles and the wordmark presence without shouting; Plus Jakarta Sans carries everything a student actually reads — dense, legible, humanist enough to feel warm at small sizes.

### Hierarchy
- **Display** (800, `clamp(1.5rem, 3vw, 2rem)`, 1.1): page titles ("Academic Timeline", course names in headers).
- **Title** (700, 0.875rem–1rem, 1.3): card headers, assignment titles, section labels.
- **Body** (500, 0.8125rem–0.875rem, 1.5): assignment metadata, descriptions, form labels. Capped near 65–75ch anywhere it runs as prose (empty states, sync modal copy).
- **Label** (700, 0.625rem–0.6875rem, uppercase, +0.04em tracking): table headers, type/weight badges, nav micro-labels.

### Named Rules
**The Two-Family Rule.** Syne only for display-weight titles; Plus Jakarta Sans for everything else, including numbers. No third family, no monospace flourish — the previous dark theme's Space Grotesk mono accents are retired along with it.

## 4. Elevation

Layered, not flat: white cards lift off the grey canvas with a soft, wide, low-opacity shadow — never a hard drop shadow, never a border standing in for depth. Depth signals hierarchy (a card is "above" the canvas); it does not signal interactivity on its own (hover states shift shadow reach slightly, not darkness).

### Shadow Vocabulary
- **card** (`box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05)`): resting state for every white card, sidebar streak pill, and modal.
- **card-lg** (`box-shadow: 0 20px 40px -10px rgba(0,0,0,0.08)`): hover/active state for interactive cards, and the default for modals (they sit above everything).
- **card-sm** (`box-shadow: 0 2px 10px rgba(0,0,0,0.03)`): tight inline elements — the streak pill, small floating badges — that don't need the full card shadow.

### Named Rules
**The No-Border-As-Depth Rule.** A card's edge is defined by its shadow against the canvas, not by a stroke. Borders (`#D8E0EE`) are reserved for elements that sit flat on white (table rows, dividers) and need a line because there's no canvas contrast to lean on.

## 5. Components

### Buttons
- **Shape:** 16px radius (`rounded-2xl`), never pill-shaped except tags/badges.
- **Primary:** navy background, white text, 700 weight, `12px 20px` padding. Hover shifts to `#282B3D`, no shadow change — the color shift is the feedback.
- **Secondary / Ghost:** transparent or white background, muted text, hover fills with a faint navy-tinted grey (`bg-slate-300/30`) and text darkens to navy. No border by default.

### Chips / Badges
- **Style:** pastel tint background at the token's exact value, ink-colored text (the tint's paired dark shade), `rounded-full`, `700` weight, 10–11px uppercase label sizing.
- **State:** course-color badges are always-on identity, not interactive; type badges (exam/homework/etc.) follow the same recipe keyed to assignment type rather than course.

### Cards / Containers
- **Corner Style:** 24px (`rounded-3xl`) for primary content cards, 16px for nested/smaller cards (calendar day cells, table cells).
- **Background:** white, always, on the grey canvas.
- **Shadow Strategy:** `card` at rest, `card-lg` on hover for interactive cards (see Elevation).
- **Border:** none by default; only where the card sits on white-on-white (rare) or holds tabular data.
- **Internal Padding:** 24px standard, 16px for dense/nested cards.

### Inputs / Fields
- **Style:** `rounded-xl`, `bg-slate-50` fill, no visible border at rest — the tonal fill against the white card is the affordance.
- **Focus:** background lifts to white plus a 2px navy-tinted ring; no color-shifting border animation.
- **Error / Disabled:** error text in rose-600 below the field, never a red border alone; disabled fields drop to 50% opacity with `cursor-not-allowed`.

### Navigation
- **Style:** fixed-width (256px) left sidebar on the grey-tinted `#EAEFF7` wash, not white — it reads as a distinct rail, not another card. Nav items are full-width pill-radius (16px) buttons; the active item is filled navy with white text and `card` shadow, inactive items are muted text with a faint grey hover fill. Logo mark sits top-left as a 36px navy rounded-square monogram. Streak and plan-tier status live pinned to the sidebar's bottom edge, separated by a hairline.

### Calendar Month Grid (signature component)
The month grid renders as individually-rounded day cells (16px radius, faint fill, subtle hover lift) inside the main `card`, with a companion "day detail" card pinned to the right on desktop (stacks below on mobile) rather than a floating popover — selecting a date is a persistent choice, not a transient hover state, so the detail panel stays visible while you scan the month. Today's date and the selected date both get a filled navy circle (today always navy; selection gets a navy ring when it isn't also today). Each day's assignments render as small tinted pill labels in the course color, capped at 2 visible with a "+N more" count; the day-count badge (course color, top-right of the cell) previews load before a click. This mirrors Google Calendar's and Upahead's month-first, click-to-inspect interaction model — the concept they share — without copying Google's exact popover mechanic.

## 6. Do's and Don'ts

### Do:
- **Do** keep the canvas at `#E5EBF4` and let every content surface be pure white `#FFFFFF` lifted by shadow — that contrast is the entire depth system.
- **Do** reserve navy (`#1D1F2D`) for exactly one primary/active element per screen (One Authority Rule).
- **Do** pair every pastel tint with its own dark "ink" shade for text, never white-on-tint or tint-as-the-only-signal.
- **Do** use 16–24px corner radii consistently; this is a soft, planner-like system, not a sharp one.
- **Do** mirror Upahead's app-shell shape (left sidebar nav, month calendar, timeline-first dashboard) since Syllaba is explicitly positioned as its free alternative and switching users should feel at home immediately.

### Don't:
- **Don't** reintroduce the dark neon "hacker dashboard" aesthetic (glass panels, glow badges, gradient text, purple/cyan neon) — that was the previous direction and reads as a dev tool, undermining the calm/trustworthy brand.
- **Don't** use gradient text or `background-clip: text` anywhere; emphasis comes from weight and the single navy accent, never a gradient.
- **Don't** use a colored `border-left` stripe as a card accent (the old assignment-card treatment). Full-card tint or a leading dot/icon carries identity instead.
- **Don't** let muted text (`#64748B`) drop below 4.5:1 contrast on white; if a use case needs lighter, darken it, don't lighten the background.
- **Don't** add a third typeface or a monospace accent family — Syne for display, Plus Jakarta Sans for everything else, full stop.
