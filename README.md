# Tax Cut — Hub 2: Tax & Paycheck

Take-home pay calculator with all 50 states and DC. Hub 2 of the utility site
portfolio. Astro 5, static, one vanilla-TS island per page, no UI framework.

The shared half of `src/kit/` is byte-identical to Hub 1's; the palette, layout
layer and logo are deliberately per-hub. See `PORTING.md` for the boundary.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3026
npm run build        # runs the data gate, then builds to dist/
npm test             # tax engine checks — run after touching any model
npm run data:report  # verification coverage + known caveats
```

## What is here

**All five plan tools are live** (8, 9, 10, 11, 12), plus 51 state pages — 62
pages total:

| Tool | Plan | What it does |
|---|---|---|
| Take-home paycheck | 8 | Gross to net with every deduction itemised, 51 states |
| W-4 withholding | 12 | Withheld vs owed, and which W-4 line to change |
| Self-employment | 9 | SE tax, deductible half, quarterly estimates, safe harbour |
| Sales tax | 10 | Add/remove tax, plus economic nexus thresholds |
| Capital gains | 11 | Short vs long term, bracket stacking, NIIT, home exclusion |

## The thing this hub gets right

Pre-tax deductions do not all reduce the same wage base, and most paycheck
calculators treat them as one bucket:

- **Section 125** (health premiums, FSA, payroll HSA) reduces income-tax wages
  **and** FICA wages.
- **Traditional 401(k)** reduces income-tax wages **only** — Social Security and
  Medicare are charged on the full contribution.

Treating the second like the first overstates take-home by 7.65% of the
contribution. The breakdown table names which base each line reduces so a user
can check it against a real pay stub.

## Before launch — required

1. **Verify the tax data.** Everything in `src/data/` is seeded for tax year
   2025 and marked `verified: false`. See `src/data/README.md` for per-field
   sources. Then set `PUBLIC_REQUIRE_VERIFIED=1` in production so the build
   fails while anything is unverified. This matters more here than in other
   hubs: a wrong bracket misstates somebody's actual filing.
2. **Close the two structural gaps**, both surfaced on the pages today:
   - Local income tax is not calculated in 12 states (IN, KY, MI, PA, AL, DE,
     MD, MO, NY, OH, OR, WV).
   - Married brackets are approximated in 8 states (DE, DC, MD, NJ, NY, ND, VT,
     WI) that use a separate joint-filer table. This **overstates** their tax.
3. **Set the domain** — `SITE.url`, `astro.config.mjs`, and `public/robots.txt`.
4. **Re-check every November**, when the following tax year publishes.

## Architecture

```
src/kit/            hub-agnostic, byte-identical to Hub 1 — see PORTING.md
src/lib/site.ts     name, tool registry, built flags
src/lib/tools/      pure DOM-free compute() per calculator
src/data/           federal + state tax parameters, each carrying provenance
src/scripts/        islands shared across more than one page
src/pages/          page shells and prose
```

Models are pure functions, so `npm test` exercises them under plain node with no
browser. 97 checks currently, including an accounting identity that every dollar
of gross is accounted for, and a sweep asserting all 51 states produce sane
rates.

## Performance

A state page is ~5 kB gzipped of HTML plus one ~8 kB gzipped JS chunk shared and
cached across all 51 of them. No third-party scripts, no ads.
