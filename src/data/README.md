# Tax data — verification procedure

Every figure in `federal.ts` and `states-tax.ts` ships `verified: false` and is
rendered behind an "unverified estimate" notice.

**Do not launch with unverified rows.** This hub carries more risk than the
others in the portfolio: a wrong transfer tax misstates an estimate, but a wrong
bracket misstates somebody's actual filing, and penalties and interest attach to
underpayment.

## Federal — `federal.ts` — VERIFIED, tax year 2026

Checked 2026-08-31 against:

| Field | Source |
|---|---|
| Rate schedules, standard deduction, capital gains rate amounts, child tax credit | **IRS Rev. Proc. 2025-32** (Internal Revenue Bulletin 2025-45) |
| Social Security and Medicare rates, wage base | **IRS Topic 751**; **SSA Contribution and Benefit Base** |
| Additional Medicare and NIIT thresholds | **IRC §3101(b)(2)**, **§1411** — statutory, never indexed |
| Residence gain exclusion | **IRC §121** — statutory, never indexed |
| Other-dependent credit, phase-out starts | IRS Child Tax Credit / Credit for Other Dependents |

Note the head-of-household schedule is not in the IRS newsroom release — it is
in the Revenue Procedure itself, published as HTML in the Bulletin. The PDF is
not machine-readable without a renderer; the IRB HTML is.

**Re-check every November**, when the following year's Revenue Procedure
publishes. `scripts/test-tax.mjs` has a data-pinning block asserting the
headline figures; it is *designed* to fail on a year rollover, which is the
prompt to re-read the source rather than a bug to route around.

## States — `states-tax.ts`

Verify each state against its department of revenue. Work one column at a time
across all 51 rows rather than one state at a time — the source tables are
published whole, and 51 separate lookups is both slower and more error-prone.

Two structural caveats are recorded in the data and surfaced on the pages:

1. **`mfjDoubles: false`** — states using a separate joint-filer table rather
   than doubling the single brackets. The model falls back to the single table,
   which understates bracket width and therefore **overstates** tax. Fix by
   adding explicit married brackets for those states.
2. **`localTax: true`** — states where counties or cities levy their own income
   tax. Not calculated. Pages say so; consider adding a locality layer before
   treating those states as complete.

## Gate

`npm run data:check` runs before every build. It validates bracket ordering,
plausible rate ranges, a null-ceilinged top bracket, and unique slugs. With
`PUBLIC_REQUIRE_VERIFIED=1` it fails the build while anything is unverified —
set that in production.

`npm run data:report` lists what is outstanding, plus both caveat lists.

## Sales tax — `sales-tax.ts`

Verify rates against each state's department of revenue, and nexus thresholds
against the state's remote-seller guidance.

**Scope limit, stated on the page:** this is a state rate plus a typical local
average, not a ZIP-level lookup. A single ZIP can straddle two districts, so a
precise-looking combined rate we cannot source would be worse than an honest
range. Anyone charging tax for real needs a rooftop-accurate rate service.

Nexus thresholds shift as states amend their rules — several have repealed
their transaction-count test since Wayfair, and more will. Re-check annually.

## Capital gains, credits and SE constants — in `federal.ts`

`CAP_GAINS` (long-term brackets, NIIT thresholds, the §121 residence
exclusion), `CREDITS` (child and other-dependant amounts and phase-out
starts), and `SE_TAX` (the 92.35% net earnings rate and the SE rates). All
seeded, all needing the same IRS Revenue Procedure check as the main brackets.
