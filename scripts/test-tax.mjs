/* Tax engine checks. Run: npm test */
import { FEDERAL, taxFromBrackets, marginalRate } from '../src/data/federal.ts';
import { STATE_TAX, stateByCode } from '../src/data/states-tax.ts';
import { makeCompute, PERIODS } from '../src/lib/tools/paycheck.ts';

let pass = 0, fail = 0;
const chk = (n, a, e, t = 0.5) => {
  const ok = Math.abs(a - e) <= t; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : `\n      got ${a} expected ~${e}`}`);
};
const compute = makeCompute(STATE_TAX);
const base = { gross: 85000, freq: 'biweekly', status: 'single', st: 'CA', k401: 6, health: 2400, hsa: 0, post: 0, extra: 0 };

// --- bracket engine ---
chk('federal $100k single', taxFromBrackets(100_000, FEDERAL.single.brackets),
  11925*.10 + (48475-11925)*.12 + (100000-48475)*.22);
chk('marginal 22% at $100k', marginalRate(100_000, FEDERAL.single.brackets), 22);

// --- the wage-base distinction (the point of this model) ---
const r = compute(base);
chk('FICA wages = gross - section125 only', r.ficaWages, 85000 - 2400);
chk('401k does NOT reduce FICA wages', r.ficaWages, 82600);
chk('income wages = gross - s125 - 401k', r.federalTaxable + FEDERAL.single.standardDeduction, 85000 - 2400 - 5100);
chk('social security on FICA wages', r.socialSecurity, 82600 * 0.062);
chk('medicare on FICA wages', r.medicare, 82600 * 0.0145);
chk('no additional medicare under threshold', r.additionalMedicare, 0);

// A 401k increase must cut income tax but leave FICA untouched.
const more401k = compute({ ...base, k401: 16 });
chk('more 401k leaves SS unchanged', more401k.socialSecurity, r.socialSecurity, 0.01);
chk('more 401k cuts federal tax', more401k.federalTax < r.federalTax ? 1 : 0, 1, 0);
// Health premium increase must cut BOTH.
const moreHealth = compute({ ...base, health: 6000 });
chk('more s125 cuts SS', moreHealth.socialSecurity < r.socialSecurity ? 1 : 0, 1, 0);

// --- Social Security wage base cap ---
const rich = compute({ ...base, gross: 400_000, health: 0, k401: 0 });
chk('SS caps at wage base', rich.socialSecurity, FEDERAL.fica.socialSecurityWageBase * 0.062);
chk('SS cap flag set', rich.ssCapped ? 1 : 0, 1, 0);
chk('medicare uncapped', rich.medicare, 400_000 * 0.0145);
chk('additional medicare above $200k', rich.additionalMedicare, (400_000 - 200_000) * 0.009);

// --- state handling ---
const tx = compute({ ...base, st: 'TX' });
chk('no-tax state charges zero', tx.stateTax, 0);
chk('no-tax state still owes federal', tx.federalTax > 0 ? 1 : 0, 1, 0);
const ca = compute({ ...base, st: 'CA' });
chk('CA charges state tax', ca.stateTax > 0 ? 1 : 0, 1, 0);
chk('TX nets more than CA', tx.netAnnual > ca.netAnnual ? 1 : 0, 1, 0);

const il = compute({ ...base, st: 'IL' });         // flat 4.95%, no standard deduction
chk('IL flat rate applied', il.stateTax, il.stateTaxable * 0.0495);

// MFJ-doubling shortcut must equal an explicit doubled table.
const mn = stateByCode('MN');
const single = compute({ ...base, gross: 200_000, st: 'MN', status: 'single', k401: 0, health: 0 });
const joint  = compute({ ...base, gross: 200_000, st: 'MN', status: 'married', k401: 0, health: 0 });
chk('MFJ pays less state tax than single at same income',
  joint.stateTax < single.stateTax ? 1 : 0, 1, 0);
chk('MFJ shortcut = half income taxed twice',
  joint.stateTax, taxFromBrackets(joint.stateTaxable / 2, mn.brackets) * 2, 0.01);
chk('MN flagged as doubling', mn.mfjDoubles ? 1 : 0, 1, 0);
// A non-doubling state must be flagged so the page can say so.
chk('NY flagged as approximated for MFJ',
  compute({ ...base, st: 'NY', status: 'married' }).mfjApproximated ? 1 : 0, 1, 0);
chk('MN not flagged as approximated',
  compute({ ...base, st: 'MN', status: 'married' }).mfjApproximated ? 1 : 0, 0, 0);

// --- accounting identity: every dollar accounted for ---
const acct = compute({ ...base, post: 1200 });
const sum = acct.netAnnual + acct.totalTax + acct.section125 + acct.retirement + acct.postTax;
chk('gross fully reconciles', sum, acct.grossAnnual, 0.01);

// --- pay periods ---
for (const [k, n] of Object.entries(PERIODS)) {
  const p = compute({ ...base, freq: k });
  chk(`${k}: net x periods = annual`, p.netPeriod * n, p.netAnnual, 0.01);
}

// --- edges ---
chk('zero income -> zero tax', compute({ ...base, gross: 0 }).totalTax, 0);
chk('zero income -> zero net', compute({ ...base, gross: 0 }).netAnnual, 0);
const lowInc = compute({ ...base, gross: 10_000, health: 0, k401: 0 });
chk('below standard deduction -> no federal tax', lowInc.federalTax, 0);
chk('below standard deduction -> still owes FICA', lowInc.socialSecurity > 0 ? 1 : 0, 1, 0);
chk('100% 401k cannot go negative', compute({ ...base, k401: 90 }).netAnnual >= 0 ? 1 : 0, 1, 0);

// --- effective rate sanity across all 51 states ---
let bad = [];
for (const s of STATE_TAX) {
  const m = compute({ ...base, gross: 85_000, st: s.code });
  if (!(m.effectiveRate >= 0 && m.effectiveRate < 60)) bad.push(`${s.code}:${m.effectiveRate.toFixed(1)}`);
  if (m.netAnnual < 0 || m.netAnnual > m.grossAnnual) bad.push(`${s.code}:net`);
}
chk('all 51 states produce sane rates', bad.length ? 0 : 1, 1, 0);
if (bad.length) console.log('      offenders:', bad.join(' '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
