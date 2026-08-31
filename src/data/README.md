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

---

# Tier C progress — state tables

## Sales tax — VERIFIED for rates, checked 2026-08-31

State and average local rates come from **Tax Foundation, State and Local Sales
Tax Rates as of 1 January 2026**. Twenty-six of fifty-one rows were wrong in the
seed; the material one was **Louisiana's state rate, 4.45% → 5.00%**.

Transaction-count nexus tests were repealed in **Illinois** (Jan 2026),
**Kentucky** (Aug 2026) and **Utah** (Jul 2025), taking the count from 19 to
**16**, which matches the published figure.

**Nexus thresholds are secondary-sourced**, unlike the rates, and are flagged as
such in the row `source`. They decide a legal registration obligation, so
spot-check against state guidance before anyone relies on them.

## Income tax — NOT VERIFIED, and here is the worklist

The consolidated table available is a **2025 vintage** and gives only the top
rate and threshold, not full bracket schedules. The calculator computes from
full brackets, so verifying a top rate does not make the computation verified.
These rows stay `verified: false`.

Cross-checking the seed against that 2025 table: **39 of 51 agree** on
structure, top rate and standard deduction. Of the twelve that differ:

**Not errors — resolved:**

| State | Apparent conflict | Resolution |
|---|---|---|
| CA | ours 12.3%, theirs 13.3% | Both right. 12.3% is the top bracket; 13.3% adds the 1% mental health surtax above $1m, which this model does not apply. Now stated in the row note. |
| IA, LA | ours "progressive", theirs "flat" | Both compute identically — they were single-bracket progressive rows. Normalised to `flat` so the page reports the structure correctly. |

**Genuine vintage drift — needs a 2026 source:**

| State | Seed | 2025 table | Note |
|---|---|---|---|
| IN | 3.05% | 3.00% | Indiana steps down annually |
| GA | 5.19% | 5.39% | Georgia steps down; the seed may already be the 2026 figure |
| KY | $3,160 | $3,270 | standard deduction |
| AR | $2,340 | $2,410 | standard deduction |
| NE | $8,000 | $8,600 | standard deduction |
| OR | $2,745 | $2,800 | standard deduction |
| RI | $10,550 | $10,900 | standard deduction |
| VT | $7,000 | $7,400 | standard deduction |
| WI | $13,230 | $13,560 | standard deduction |

All seven deduction gaps run the same direction, which is the signature of an
older vintage rather than scattered mistakes.

## What finishing income tax actually needs

Full 2026 bracket schedules for the 28 graduated states, from each state's
department of revenue. There is no consolidated machine-readable source, and
extracting thirty bracket tables from prose is how errors get introduced.

### 14 flat states — DONE, checked 2026-08-31

Rates from **Tax Foundation, State Individual Income Tax Rates and Brackets
2026**, corroborated against their **State Tax Changes Taking Effect January 1,
2026** article, which independently names four of the six changes.

Six rates were stale:

| State | Was | 2026 |
|---|---|---|
| Idaho | 5.695% | **5.30%** (retroactive to Jan 2025) |
| Indiana | 3.05% | **2.95%** |
| Kentucky | 4.00% | **3.50%** |
| Mississippi | 4.40% | **4.00%** |
| North Carolina | 4.25% | **3.99%** (final step of the phase-down) |
| Utah | 4.55% | **4.50%** |

**The standard deduction column of that table was not trustworthy** and was only
partly applied. It claimed Illinois, Indiana, Michigan and Pennsylvania "conform
to the federal standard deduction", which is wrong — Pennsylvania allows no
deduction at all and the other three use personal exemptions. That looks like
the extraction filling a gap rather than the table saying it.

Applied: CO, ID and IA (genuine federal conformity, tracking the now-verified
federal figure), plus KY and LA which set their own. **Not applied:** Arizona's
`$8,350`, which is not a federal figure despite Arizona conforming to federal —
flagged in the row note as pending a Department of Revenue check.

Where a state uses personal exemptions this model applies none, so tax is
slightly **overstated** at low incomes in IL, IN and MI. Now stated in each note.

### 9 no-wage-tax states — DONE, checked 2026-08-31

Confirmed none taxes wage income. Three notes were out of date:

- **New Hampshire** — the interest and dividends tax was **fully repealed
  effective 1 January 2025**, so NH now levies no individual income tax at all.
  The seed still described it as being phased out.
- **Washington** — SB 5813 (May 2025) replaced the flat 7% capital gains excise
  tax with a **graduated** structure, adding a higher rate above $1 million.
- **Tennessee** — Hall tax phased out in 2021. Already correct.

**A modelling gap this surfaced.** Washington has no wage tax but does tax
long-term capital gains above roughly $270,000. The capital gains calculator
treats `kind: 'none'` states as having no state tax, so it was reporting **$0**
for a Washington resident who genuinely owes 7%+. Reporting zero there is not a
simplification, it is wrong.

Rather than silently leave it, the model now sets `untaxedGainCaveat` when a
no-wage-tax state nonetheless taxes gains, and the page says the state figure is
understated instead of implying nil. Driven off the row note rather than a
hardcoded state code, so it will catch the next state to do this.

Computing Washington's tax properly needs its own bracket data and threshold —
worth doing, and out of scope for confirming the nine.

### 28 graduated states — bracket schedules DONE, checked 2026-08-31

Full single-filer schedules from **Tax Foundation, State Individual Income Tax
Rates and Brackets 2026**, pulled in three batches and validated structurally
(open-ended top band, ascending thresholds, monotonic rates, plausible range).

Six states already matched the seed exactly — AL, CT, DE, DC, HI, KS — which is
a useful reliability signal for the rest.

Substantive 2026 changes found:

| State | Change |
|---|---|
| Ohio | Moved to a **flat 2.75%** above $26,050. Top rate was 3.5%. |
| Oklahoma | **Six brackets collapsed into three**, top rate 4.75% → 4.5% |
| Montana | Top rate 5.9% → **5.65%**, lower band widened to $47,500 |
| Nebraska | Top rate 5.2% → **4.55%**, mid-phase-down |
| New York | Lower-bracket rates cut; bottom band now 3.9% |
| Maryland | **Two new top brackets** added at $500k and $1m |
| California | Now carries the 13.3% band (the 1% mental health surtax), so the model reports the full rate a Californian pays |
| AR, ME, MN, MO, NM, OR, RI, SC, VT, WI | Threshold indexation, and SC's top rate 6.2% → 6.0% |

Ohio's move alone changes an $85,000 earner's state tax from about $2,300 to
**$1,415**.

**Standard deductions were deliberately NOT taken from this source.** Its
deduction column proved unreliable for the single-rate states — it claimed four
states conform to the federal standard deduction when they allow none at all —
so the graduated states' deductions remain seeded. That is the largest
remaining gap in this hub.

### Still outstanding

1. **Standard deductions for the 28 graduated states** — needs a source other
   than the one whose deduction column already failed once.
2. **Married brackets in 8 states** (DE, DC, MD, NJ, NY, ND, VT, WI) are
   approximated by the single table, which **overstates** their tax. Arguably
   higher value than deduction precision, since it affects every joint filer in
   those states.
3. **Washington's capital gains tax** is not computed — see the note above.

Also outstanding, and arguably more important than bracket precision: the eight
states where married brackets are approximated by the single table (DE, DC, MD,
NJ, NY, ND, VT, WI), which **overstates** their tax.

## Married brackets — DONE, checked 2026-08-31

All eight states that publish their own joint-filer schedule now carry an
explicit `marriedBrackets` table: **DE, DC, MD, NJ, NY, ND, VT, WI**. None of
them was a simple doubling, and New Jersey's has an **extra 2.45% band that
single filers do not get**.

What the approximation was costing, on $85,000 married:

| State | Was (single table) | Now | Correction |
|---|---|---|---|
| New Jersey | $2,811 | **$1,558** | −$1,253 |
| Vermont | $2,582 | **$2,126** | −$457 |
| New York | $3,153 | **$2,986** | −$168 |
| Wisconsin | $2,206 | **$2,151** | −$55 |
| DE, DC, MD, ND | unchanged at this income | | |

Delaware and DC genuinely apply the *same* schedule to both statuses, which is
now explicit rather than assumed. Maryland's tables diverge only above $100,000,
and North Dakota's zero band runs to $80,975 for joint filers — so many married
couples there owe no state income tax at all.

Both the paycheck and capital gains models prefer an explicit table over the
doubling shortcut, and `mfjApproximated` is now false for every state.
