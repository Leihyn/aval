# DESIGN_SYSTEM.md

Every value below is extracted from `frontend/src/index.css` and `frontend/src/App.tsx`
as shipped, not proposed. If a token is listed here it is in the built CSS; the
verification commands at the bottom re-derive that claim from `dist/`.

---

## Identity

**World statement.** A settlement desk at 2am: the money has left, it has not arrived,
and someone has to decide whether to act on a fact nobody else can see yet.

**Accents — two, and they are semantic, never decorative.** The product's whole argument
is a split between two audiences, so the palette encodes that split rather than
prettifying it. A surface is tinted only when it belongs to one of the two:

- `#34d399` **SIGNAL** (emerald) — what the counterparty learns
- `#56b6f0` **LEDGER** (sky) — what the public blockchain learns

Nothing else in the interface is allowed to be emerald or sky. Amber and rose exist
only as states (`warn`, `danger`), never as identity.

**Signature element — the split rule.** Each pane is capped by a two-pixel border in its
own accent (`border-t-2 border-t-signal-400` / `border-t-ledger-400`). Placed side by
side the two caps form a single two-tone line across the top of the page's central
section, previewing the product's argument before a word is read. The same motif is the
logo: a filled block beside an open outline containing nothing.

**Background.** Flat near-black `#05060a`, a blue-cast black for "Midnight". No gradient,
no glow, no texture. The interface should feel like an instrument that is switched on.

**Typography domain.** Institutional finance / trading terminal. System sans for prose;
true monospace with tabular figures for every value a viewer compares side by side. No
web fonts — the page loads and renders fully offline.

---

## Tokens

All tokens live in a Tailwind v4 `@theme` block in `frontend/src/index.css`. Tailwind
generates the utility names from the token names, so `--color-base-900` is `bg-base-900`
and `--radius-card` is `rounded-card`.

### Surfaces — a strict elevation ladder

Each step up the ladder is lighter than the one below it. Depth is only ever a surface
step or a one-pixel border.

| Token | Value | Role |
|---|---|---|
| `--color-base-950` | `#05060a` | page ground |
| `--color-base-900` | `#0a0b12` | public surface (right pane, comparison) |
| `--color-base-850` | `#0e1018` | private surface (left pane) — one step above public |
| `--color-base-800` | `#141723` | hairlines, inner row rules |
| `--color-base-700` | `#1e2130` | borders |
| `--color-base-600` | `#2a2e40` | hover borders, control borders |

### Text

| Token | Value | Contrast on `base-900` | Role |
|---|---|---|---|
| `--color-ink-100` | `#eceef5` | 17.4:1 | values, emphasis, headings |
| `--color-ink-300` | `#a8adc0` | 8.8:1 | body prose, labels |
| `--color-ink-500` | `#757b94` | 4.7:1 | glosses, eyebrows, footnotes |

`ink-500` is the dimmest text permitted. It clears 4.5:1 on `base-950`, `base-900` and
`base-850`; it is **not** used on `base-800` (4.3:1) or on any accent-tinted fill.

### Semantic accents

| Token | Value | Role |
|---|---|---|
| `--color-signal-400` | `#34d399` | counterparty knowledge; primary action |
| `--color-signal-900` | `#06281d` | ready-state banner fill |
| `--color-ledger-400` | `#56b6f0` | public-chain knowledge; links |
| `--color-ledger-900` | `#062033` | reserved |
| `--color-warn-400` | `#f0b356` | a compared field that differs |
| `--color-danger-400` | `#f2607a` | rejected proof, failed runtime, privacy-claim failure |
| `--color-danger-900` | `#2a0d15` | danger fill |

### Type scale — five steps, no others

Declared with Tailwind v4 per-step line-height and letter-spacing modifiers.

| Utility | Size | Line height | Tracking | Role |
|---|---|---|---|---|
| `text-micro` | 11px | 1.25 | +0.12em | field labels, eyebrows, glosses (uppercase unless overridden) |
| `text-body` | 13px | 1.6 | — | dense prose inside panes |
| `text-value` | 14px | 1.45 | — | monospace figures compared side by side |
| `text-read` | 15px | 1.65 | — | the one paragraph a viewer actually reads; button label |
| `text-lede` | 17px | 1.4 | −0.01em | a verdict — the answer, not the explanation |
| `text-display` | `clamp(1.5rem, 1.15rem + 1.5vw, 2rem)` | 1.1 | −0.02em | the wordmark |

The one deliberate exception is the threshold `<input>`, pinned to `text-base` (16px) so
iOS does not zoom the viewport on focus. Never lower it.

### Spacing rhythm

Base unit 4px (Tailwind default). The page uses a restricted set: `2 · 3 · 4 · 5 · 6 · 8`
(8/12/16/20/24/32px). Section gap is `gap-4`; pane padding is `p-4 sm:p-5`; the gap
between a label and its control is `mt-2`; the gap between blocks inside a pane is `mt-6`.

### Radii — exactly two

| Token | Value | Applies to |
|---|---|---|
| `--radius-card` | 14px | panes, the comparison section |
| `--radius-control` | 8px | buttons, inputs, banners, inline sockets |

> **Trap, and the reason this file exists.** `rounded-[--radius-card]` is Tailwind **v3**
> syntax. Under v4 it compiles to the literal `border-radius: --radius-card`, which is
> invalid CSS — the browser discards the declaration and the element renders square, with
> no error anywhere. This project shipped in exactly that state until design-forge caught
> it in the built CSS. Use the theme-generated `rounded-card` / `rounded-control`, or the
> v4 escape `rounded-(--radius-card)`. Never the bracket form.

### Shadows

**Philosophy: none.** There is no `shadow-*`, no `drop-shadow-*` and no `backdrop-blur`
anywhere in the product. Every step of depth is a one-pixel border or a surface-elevation
step. The only `box-shadow` byte in the built CSS is Tailwind's own preflight reset
(`:-moz-ui-invalid{box-shadow:none}`), which draws nothing.

This is a deliberate rejection, not an omission: glow and bloom read as marketing, and
this surface has to read as an instrument.

---

## Craft

**Elevation ladder (CF-2).** `base-950` ground → `base-900` public pane → `base-850`
private pane → `base-800` inner rules. Private sits one step above public on purpose:
raised reads as enclosed, flat reads as exposed.

**Hover recipe.** Colour shift only, 150ms `ease-out`. Never scale, never lift, never
glow. Solid button: `hover:bg-signal-400/90`. Secondary button: `hover:bg-base-700`.
Input: `hover:border-base-600`. Link: `hover:underline`.

**Active recipe.** `active:scale-[0.99]` on buttons — a 1% press, the only transform in
the product. No spring, no bounce.

**Focus-visible recipe.** One ring everywhere, defined once in `index.css`:
`outline: 2px solid var(--color-signal-400); outline-offset: 2px; border-radius:
var(--radius-control)`, applied via `:where(button, input, a, [tabindex]):focus-visible`.
A single focus colour across both accent territories is intentional — focus is a property
of the user, not of the pane they are in.

**Disabled recipe.** `disabled:opacity-40 disabled:cursor-not-allowed`. Both action
buttons are disabled until `boot === 'ready'`, so a WASM failure can never present a
control that silently does nothing.

**Glass recipe.** None. `backdrop-blur` is on the rejection list and is absent from the
build.

**Tabular figures.** `.tnum { font-variant-numeric: tabular-nums }` on every number a
viewer compares: ledger values, both comparison columns, the threshold input, the
verdict count. Without it the two hex columns fail to align and the identity claim stops
being checkable by eye.

**Density.** Public-ledger rows are a `[14.5rem_1fr]` grid at `sm`+ with `py-2` and a
one-pixel rule between rows — a table, not a card list. Glosses are `hidden sm:block`:
below 640px the labels stand alone and the pane stays scannable.

**Absence is rendered, not described.** A viewer scanning five field names does not
notice that a sixth is missing, so `amount` is drawn as a real row with a dashed empty
socket where the value would be. The set of private inputs is checked against the live
ledger object on every render (`Object.hasOwn`); if one ever appeared, the pane flips to
a `danger` "Privacy claim failed" state naming the leaked field. The claim is falsifiable
on screen rather than asserted in prose.

---

## Primitives

| Primitive | Class set |
|---|---|
| **Pane** | `flex flex-col rounded-card border-x border-b border-t-2 border-base-700 border-t-{accent}` + surface; header strip `flex items-center gap-2 border-b border-base-800 px-4 py-3 sm:px-5`; body `flex flex-1 flex-col p-4 sm:p-5` |
| **Primary button** | `h-11 rounded-control bg-signal-400 px-4 text-read font-medium text-base-950 transition-[background-color,transform] duration-150 ease-out hover:bg-signal-400/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40` |
| **Secondary button** | `h-11 rounded-control border border-base-600 bg-base-800 px-4 text-value font-medium text-ink-100 …hover:bg-base-700 active:scale-[0.99]` |
| **Input** | `h-11 rounded-control border border-base-700 bg-base-950 px-3 font-mono text-base text-ink-100 transition-colors duration-150 ease-out hover:border-base-600` + `.tnum` |
| **Micro label** | `text-micro uppercase text-ink-500` (or `text-ink-300` when it labels a value) |
| **Status banner** | `rounded-control border border-{tone}/25 bg-{tone}-900/40 px-4 py-2.5 text-body` |
| **Empty socket** | `inline-block rounded-control border border-dashed border-base-600 px-2 py-0.5 font-mono text-value text-ink-500` |

All interactive controls are 44px tall (`h-11`). Do not shrink them.

---

## Motion

One keyframe, used once: a result arriving.

```css
@keyframes f-rise {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: none; }
}
.f-rise { animation: f-rise 180ms ease-out both; }
```

Applied to the proof verdict and the comparison result. Default transition for everything
else is `150ms ease-out` on colour only. No stagger, no page-load animation, no spring.

`prefers-reduced-motion: reduce` collapses every animation and transition to `0.01ms`
globally — including `f-rise`.

---

## Rejection list (binding)

No neon. No gradients. No glassmorphism or blur. No emoji. No purple-to-pink crypto
palette. No rounded-everything. No bounce or spring on functional controls. No hero
illustration. No marketing copy in the product surface. **No number the contract did not
actually produce** — every figure on screen is read back from a real circuit execution,
and the comparison verdict counts its own diff rather than asserting a result.

---

## Verification

These re-derive the claims above from the built output rather than trusting this file.

```bash
cd frontend && npm run build

# Radii resolve to var(), never to a bare custom-property name
grep -o 'border-radius:[^;}]*' dist/assets/index-*.css | sort -u

# No bare custom-property values anywhere (the v3/v4 syntax trap)
grep -oE '(border-radius|color|background-color|font-size):--[a-z-]+' dist/assets/index-*.css

# Shadow philosophy: the only hit is Tailwind's preflight reset
grep -o '.\{40\}box-shadow.\{40\}' dist/assets/index-*.css

# The five type steps exist
grep -oE '\.text-(micro|body|value|read|lede|display)\{[^}]*\}' dist/assets/index-*.css
```
