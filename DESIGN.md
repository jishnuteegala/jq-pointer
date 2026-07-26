---
name: jq-pointer
description: Paste JSON, click the value you want, get the jq expression that extracts it.
colors:
  text: "#1a1d29"
  heading: "#0d0f17"
  bg: "#eceef3"
  bg-accent: "#e4e7ef"
  surface: "#ffffff"
  surface-sunken: "#f6f7fb"
  border: "#e2e5ee"
  border-strong: "#c3c8d6"
  accent: "#5b53e0"
  accent-strong: "#4a42cf"
  accent-soft: "#eeecfc"
  accent-contrast: "#ffffff"
  danger: "#c0362c"
  danger-surface: "#fdf1f0"
  success: "#1a7f47"
  mono: "#3d2f6b"
  muted: "#5a6173"
typography:
  h1:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  tagline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "SF Mono, JetBrains Mono, Fira Code, ui-monospace, Cascadia Code, Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  full: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-copied:
    backgroundColor: "{colors.success}"
    textColor: "{colors.accent-contrast}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.mono}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.full}"
  path-output:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.mono}"
    rounded: "{rounded.md}"
---

# Design System: jq-pointer

## 1. Overview

**Creative North Star: "The Well-Made Instrument"**

jq-pointer looks like a precision tool, not a landing page. Everything lives in a single narrow reading column (max-width 46rem) on a cool blue-grey field, with a soft radial glow behind the header that gives the page air without decoration. Surfaces are flat and calm at rest; the interface earns attention only where the user is working. It rejects the marketing-tool aesthetic entirely: no hero metrics, no feature-card grids, no gradient-text headlines, no tracked-uppercase eyebrow above every section.

The palette is a restrained cool-neutral system tinted toward a single indigo accent. That accent is the tool's one voice: it marks selection, focus, links, and the primary action, and nothing else competes with it. Monospace carries every piece of user data (JSON input, jq paths, chips, breadcrumbs) so the document and the answer always read as code, while Inter carries the surrounding chrome. The system flips wholesale under `prefers-color-scheme: dark`, trading the light field for a near-black one and lifting the accent to a brighter indigo so it stays legible.

Depth is quiet and structural rather than decorative: small ambient shadows separate the input, tree, and result surfaces from the page, and the tree's inner content is where the density lives. The register is a developer's instrument, confident and legible, that stays out of the way until pointed at.

**Key Characteristics:**

- Single narrow column, flat surfaces, generous vertical rhythm.
- One indigo accent, used sparingly for state and action only.
- Monospace for all data, Inter for all chrome.
- Full automatic light/dark parity.
- Depth from small ambient shadows, never from borders-plus-glow.

## 2. Colors

A cool blue-grey neutral base tinted toward one indigo accent, with reserved danger and success signals.

### Primary

- **Indigo Accent** (#5b53e0): The single voice of the system. Selection highlight, focus rings, links, primary button fill, chip and breadcrumb accents. In dark mode it lifts to a brighter indigo (#8b83ff) to hold contrast on the near-black field.
- **Indigo Deep** (#4a42cf): The pressed/hover state of the accent: primary button hover, active chip and breadcrumb text.
- **Indigo Wash** (#eeecfc): A pale accent tint for selected rows, chips, and active breadcrumbs, so selection reads without shouting.

### Neutral

- **Ink** (#1a1d29): Default body and label text.
- **Heading Ink** (#0d0f17): Headings and strong labels, a shade darker than body.
- **Field** (#eceef3): The page background, a cool blue-grey.
- **Field Accent** (#e4e7ef): The header's radial-glow tint, a half-step off the field.
- **Surface** (#ffffff): Raised surfaces: inputs, the tree, cards.
- **Sunken Surface** (#f6f7fb): Recessed surfaces such as the path-output well.
- **Border** (#e2e5ee): Default hairline dividers and container edges.
- **Border Strong** (#c3c8d6): Interactive field borders (textarea, filter input, breadcrumb items).
- **Muted** (#5a6173): Secondary text, placeholders, tree values, footer.
- **Mono Ink** (#3d2f6b): Monospace data text, a desaturated indigo-violet that keeps code visually distinct from prose.

### Signal

- **Danger** (#c0362c) on **Danger Surface** (#fdf1f0): Parse errors, unsupported paths, copy failures.
- **Success** (#1a7f47): The "Copied" confirmation state on the primary button.

### Named Rules

**The One Voice Rule.** The indigo accent is the only chromatic voice. It appears on selection, focus, links, and the single primary action, kept to a small fraction of any screen. Danger and success are signals, not decoration, and never appear except in response to a real state.

## 3. Typography

**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif)
**Mono Font:** SF Mono (with JetBrains Mono, Fira Code, ui-monospace, Cascadia Code, Menlo, Consolas, monospace)

**Character:** A single humanist sans for all chrome paired with a monospace for all user data. The contrast axis is prose-versus-code, not two similar sans families: if it's the document or the answer, it's monospace; if it's the interface talking, it's Inter.

### Hierarchy

- **H1** (700, 2.25rem, line-height 1.15, letter-spacing -0.02em): The single page title.
- **H2** (600, 1.0625rem, line-height 1.15): Section headings on the design-system page.
- **Tagline** (400, 0.875rem, line-height 1.6, muted): The one positioning line under the title, sentence case. No tracked-uppercase kicker sits above the heading.
- **Body** (400, 1rem, line-height 1.6): Intro and prose; the intro reads at ink weight and caps at ~40rem for readable measure.
- **Label** (600, 0.875rem, sentence case): Input labels. There is no all-caps label form.
- **Mono** (400, 0.875rem, line-height 1.6): All JSON input, jq paths, chips, breadcrumbs, and tree rows.

### Named Rules

**The Data-Is-Mono Rule.** Every value that comes from or goes to the user's document (input JSON, output paths, chips, breadcrumbs, filter text) is set in the monospace stack. Chrome is never monospace; data is never proportional.

## 4. Elevation

The system is flat by default and lifts surfaces with small, tightly-diffused ambient shadows rather than borders or glows. Three shadow steps separate the input and result surfaces from the page; the tree also carries a subtle inset shadow on its path-output well to read as recessed. In dark mode the shadows deepen to hold separation against the near-black field.

### Shadow Vocabulary

- **Ambient Low** (`box-shadow: 0 1px 2px rgb(15 18 30 / 0.06)`): Resting lift for buttons and fields.
- **Ambient Mid** (`box-shadow: 0 1px 2px rgb(15 18 30 / 0.06), 0 4px 12px rgb(15 18 30 / 0.06)`): The tree container.
- **Ambient High** (`box-shadow: 0 2px 4px rgb(15 18 30 / 0.05), 0 12px 32px rgb(15 18 30 / 0.1)`): The heaviest lift, reserved for the most raised surfaces.
- **Focus Ring** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 30%, transparent)`): The accent glow on focused inputs.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Elevation is small and ambient, never a decorative drop shadow, and never a 1px border paired with a wide soft glow.

## 5. Components

Radii come from a four-step scale: sm 6px, md 10px, lg 14px, full 999px (pill). Cards and the tree top out at lg; pills are reserved for chips.

### Buttons

- **Shape:** Gently curved (md, 10px).
- **Primary:** Indigo accent fill (#5b53e0) with white text, 600 weight, minimum 44px height, padding 0.5rem 1.5rem, resting Ambient Low shadow.
- **Hover / Active:** Hover deepens to Indigo Deep (#4a42cf); active nudges down 1px and drops the shadow.
- **Copied:** Swaps to Success green (#1a7f47) for the 2-second confirmation.
- **Disabled:** 0.45 opacity, no shadow, default cursor.

### Chips (selection tokens)

- **Style:** Pill (full radius), Indigo Wash background, Indigo Deep text, hairline accent-tinted border, monospace.
- **State:** Each chip carries a round remove control; a text-only "clear" action sits alongside. Coarse pointers enlarge the remove target to 1.75rem.

### Cards / Containers

- **Corner Style:** Tree uses lg (14px); the path-output well and fields use md (10px).
- **Background:** Surface white for raised containers; Sunken Surface for the recessed path well.
- **Shadow Strategy:** Ambient Mid for the tree; inset hairline shadow for the path well.
- **Border:** Default hairline Border on containers; no border-plus-glow pairing.

### Inputs / Fields

- **Style:** Surface white, Border Strong hairline, md radius, monospace, Ambient Low shadow. The JSON textarea is vertically resizable with an 8.5rem floor.
- **Hover:** Border shifts to the accent.
- **Focus:** Accent border plus the Focus Ring glow; the default 2px outline is suppressed in favour of the ring.

### Navigation (breadcrumb)

- **Style:** A row of monospace ancestor buttons that widen the selection. Resting state is muted text on Surface with a Border Strong hairline; hover shifts to accent text, accent border, and Indigo Wash fill; the active item carries Indigo Wash fill with Indigo Deep text at 600 weight.

### Signature Component: the value tree

The virtualized JSON tree is the heart of the tool. Rows are fixed 28px, monospace, with a muted toggle, a bold label, and a muted, ellipsized value. Hover tints a row to Sunken Surface. A **highlighted** (selected/matched) row takes an Indigo Wash background with a 2px inset accent bar on its leading edge; a **focused** row takes a 2px inset accent ring. Selection and keyboard focus are always visible.

## 6. Do's and Don'ts

### Do:

- **Do** keep the indigo accent (#5b53e0) to selection, focus, links, and the single primary action; treat its rarity as the point.
- **Do** set every piece of user data (JSON, jq paths, chips, breadcrumbs, tree rows) in the monospace stack, and all chrome in Inter.
- **Do** lift surfaces with the small ambient shadow steps (Ambient Low/Mid/High); keep surfaces flat at rest.
- **Do** keep to the single 46rem column and the existing spacing scale (0.25rem to 3rem) for vertical rhythm.
- **Do** write plain, located status text ("matches 3 of 12 elements", "No nodes match this filter") and gate all motion behind `prefers-reduced-motion: no-preference`.
- **Do** maintain full light/dark parity: any new token must define both scheme values.

### Don't:

- **Don't** add hero metrics, identical feature-card grids, or any tracked-uppercase eyebrow/kicker above a heading; this is a tool, not a marketing landing page. Positioning is carried by one sentence-case tagline, never an all-caps label.
- **Don't** use gradient text or `background-clip: text` for emphasis; emphasis is weight and size.
- **Don't** pair a 1px border with a wide soft drop shadow on the same element, and don't over-round: cards top out at 14px, pills are for chips only.
- **Don't** use a colored `border-left`/`border-right` greater than 1px as an accent stripe; the tree's selection bar is a 2px inset box-shadow, not a border.
- **Don't** introduce a second accent hue or use danger/success colours for anything but real error and confirmation states.
- **Don't** set user data in a proportional font or chrome in monospace.
