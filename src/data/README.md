# Tax data — verification procedure

Every figure in `federal.ts` and `states-tax.ts` ships `verified: false` and is
rendered behind an "unverified estimate" notice.

**Do not launch with unverified rows.** This hub carries more risk than the
others in the portfolio: a wrong transfer tax misstates an estimate, but a wrong
bracket misstates somebody's actual filing, and penalties and interest attach to
underpayment.

## Federal — `federal.ts`

| Field | Source |
|---|---|
| brackets, standardDeduction | IRS Revenue Procedure for the tax year |
| socialSecurityWageBase | Social Security Administration annual announcement |
| medicareRate, additionalMedicareRate, thresholds | IRS Publication 15 |

Re-check every November, when the following year's figures publish. Update
`year` and set `verified: true` only for figures actually checked.

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
