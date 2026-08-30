# Porting this build to the next hub

Each hub is its own workspace and its own repo. The reusable half is
`src/kit/` — copy that one folder and you inherit the design system, the
calculator engine, the charts and the page furniture. Everything else is
hub-specific and gets rewritten.

## What to copy

```
src/kit/                    <- copy wholesale, do not edit per hub
  styles/tokens.css         <- edit ONLY --c-accent* and the fonts
  styles/base.css
  styles/forms.css
  styles/components.css
  styles/surfaces.css      <- dark header, hero band, tiles, trust strip
  calc/engine.ts            <- mount(), input binding, debounce, URL state
  calc/finance.ts           <- pmt, amortize, futureValue, npv, irr
  calc/format.ts            <- currency/percent/months formatters
  calc/chart.ts             <- hand-rolled SVG line + stacked bar
  calc/url-state.ts
  components/*.astro        <- Field, SelectField, Segmented, Chart,
                               Logo, DataNote, ToolShell, RelatedTools
scripts/alias-loader.mjs    <- lets plain `node` run the model modules
astro.config.mjs
tsconfig.json               <- keep the @kit/* @data/* path aliases
```

Also copy `scripts/check-data.mjs` if the hub has programmatic data.

## What to rewrite

| File | What changes |
|---|---|
| `src/lib/site.ts` | Name, tagline, the `TOOLS` registry. This is the single source for nav, cards, footer and internal links. |
| `src/lib/tools/*.ts` | One module per calculator: `FIELDS`, `D`, `compute()`. |
| `src/pages/**` | Page shells and prose. |
| `src/data/*` | Programmatic data sets. |
| `src/layouts/BaseLayout.astro` | Footer links and JSON-LD. Structure stays. |
| `--c-accent*`, `--c-deep*`, `--c-pop*` in `tokens.css` | The palette. `--c-deep` is the hero/header band, `--c-pop` the CTA that has to pop against it.
| `src/kit/components/Logo.astro`, `public/favicon.svg` | The mark. It fills from `--c-accent`, so the SVG only needs redrawing if the hub wants a different symbol. |

## The pattern for a new calculator

Four files, always in this order:

**1. Model** — `src/lib/tools/<name>.ts`

```ts
export const FIELDS: FieldSpec[] = [
  { key: 'loan', type: 'number', default: 400_000, min: 1_000, max: 10_000_000, dp: 0 },
];
export const D = FIELDS.reduce((m, f) => ((m[f.key] = f.default), m), {});
export interface MyModel { monthlyPayment: number; /* ... */ }
export function compute(v: Values): MyModel { /* pure function, no DOM */ }
```

Keep `compute` pure and DOM-free. That is what makes it testable with
`node --import ./scripts/alias-loader.mjs`, and testing the model is the
only thing standing between you and publishing wrong numbers at scale.

**2. Page** — `src/pages/tools/<slug>.astro`

```astro
<ToolShell title="..." intro="..." breadcrumbs={[...]} calcId="x">
  <form slot="controls" id="x-form"> <Field name="loan" value={D.loan} ... /> </form>
  <div slot="results" class="results">
    <b data-out="monthlyPayment" data-fmt="currency">—</b>
  </div>
  <section class="prose"> ... 800–1,500 words ... </section>
</ToolShell>
```

**3. Island** — a `<script>` at the bottom of the page

```ts
import { mount } from '@kit/calc/engine';
import { FIELDS, compute } from '../../lib/tools/<name>';
document.getElementById('x-form')?.addEventListener('submit', e => e.preventDefault());
mount<MyModel>({ id: 'x', fields: FIELDS, compute, onRender(m) { /* charts, tables */ } });
```

**4. Register** it in `src/lib/site.ts` so it appears in nav, cards and footer.

## Traps this build already hit

Four bugs found here. All four will recur in Hub 2 if you forget them.

1. **Never name a component prop `slot`.** `slot` is Astro's reserved
   slot-assignment attribute. Any `<Thing slot="x" />` passed as a component's
   child is routed to a named slot — and silently discarded if none matches.
   No error, no output. Cost an entire ad tier here before it was spotted.

2. **The engine root must enclose every `data-out`.** `mount()` queries within
   `[data-calc]`. Scope it to just the controls/results grid and any figure in
   a section below stays an em dash forever. `ToolShell` puts it on the
   outermost `.page` div.

3. **Prose figures drift from the model.** The worked examples in the copy were
   wrong until the model tests printed the real numbers. Any figure you state
   in prose, print from the model first, then paste it.

4. **`npx astro` resolves the wrong Astro** if the shell's working directory is
   not the project. Use `./node_modules/.bin/astro` or `npm run build`.

## Advertising

This hub ships with no ad slots. If a later hub needs them, the original
reserved-height `AdSlot` component and its `--ad-h-*` tokens are recoverable
from git history at commit `bdc82c3`. The rule if you bring it back: fix the
container height in CSS before any ad script runs — never let a unit size
itself, or CLS goes with it.

## Checklist before launching a hub

- [ ] `npm run build` passes
- [ ] `node --import ./scripts/alias-loader.mjs scripts/test-finance.mjs` passes
- [ ] Every tool page has 800–1,500 words of prose
- [ ] Exactly one `<h1>` per page; canonical on every page
- [ ] All data rows `verified: true`, `PUBLIC_REQUIRE_VERIFIED=1` set in prod
- [ ] `SITE.url` set to the real domain (also in `robots.txt`)
- [ ] Every prose figure re-checked against model output

## Page furniture

Three band treatments, so every page reads as part of one system:

- **Homepage** — `.band`, a full-bleed `--c-deep` hero with a centred headline
  (wrap the emphasised word in `<em>` for the --c-pop highlight), the `.picker`
  selector + CTA, then `.trust` and `.tiles`.
- **Tool pages** — `.tool-band`, a soft mint gradient behind the breadcrumbs and
  h1 only. The calculator stays on plain ground: a results card has to read as
  an instrument, not another marketing panel.
- **Index and static pages** — `.page-band`, the same gradient, applied by
  wrapping the breadcrumbs and `.tool-hero` and reopening `.page` after it.

The `.trust` strip carries **verifiable properties of the product only** —
counts, guarantees you actually make. No ratings, no review counts, no
testimonials. Comparison sites lean hard on social proof; inventing it is how a
site loses the trust the strip is there to build.

5. **Don't use `perl -0pi -e 's|...|...|'` on markdown tables.** The `|`
   delimiter terminates at the first pipe in the replacement, silently
   truncating it and fusing the remainder into the next line. It corrupted this
   file's heading twice. Use `node -e` with explicit string ops for anything
   containing pipes.
