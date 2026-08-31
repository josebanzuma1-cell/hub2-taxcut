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
const B = FEDERAL.single.brackets;
chk('federal $100k single stacks three brackets', taxFromBrackets(100_000, B),
  B[0].upTo * 0.10 + (B[1].upTo - B[0].upTo) * 0.12 + (100_000 - B[1].upTo) * 0.22);
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


// ============ Tool 9: self-employment ============
import { makeCompute as makeSE } from '../src/lib/tools/self-employment.ts';
import { SE_TAX, CAP_GAINS, CREDITS, longTermGainsTax } from '../src/data/federal.ts';
const se = makeSE(STATE_TAX);
const seBase = { profit: 90000, w2: 0, status: 'single', st: 'CA', qbi: true, prior: 0, priorAgi: 0 };

const s1 = se(seBase);
chk('SE: net earnings are 92.35% of profit', s1.netEarnings, 90000 * 0.9235);
chk('SE: social security portion', s1.ssPortion, 90000 * 0.9235 * 0.124);
chk('SE: medicare portion', s1.medicarePortion, 90000 * 0.9235 * 0.029);
chk('SE: half is deductible', s1.deductibleHalf, s1.seTax / 2);
chk('SE: quarterly is a quarter of total', s1.quarterly * 4, s1.totalTax, 0.01);

// W-2 wages consume the SS wage base first.
const s2 = se({ ...seBase, w2: 200_000 });
chk('SE: w2 above wage base leaves no SS portion', s2.ssPortion, 0);
chk('SE: medicare still charged', s2.medicarePortion > 0 ? 1 : 0, 1, 0);
chk('SE: flag set when base consumed', s2.ssFullyUsedByW2 ? 1 : 0, 1, 0);
const s3 = se({ ...seBase, w2: 150_000 });
chk('SE: partial wage base remaining', s3.ssPortion,
  Math.min(90000 * 0.9235, FEDERAL.fica.socialSecurityWageBase - 150_000) * 0.124);

// QBI must reduce tax, and safe harbour must pick the lesser route.
chk('SE: QBI lowers federal tax', se({ ...seBase, qbi: false }).federalTax > s1.federalTax ? 1 : 0, 1, 0);
const sh = se({ ...seBase, prior: 8_000, priorAgi: 90_000 });
chk('SE: safe harbour uses 100% under $150k AGI', sh.safeHarborRate, 100);
chk('SE: safe harbour takes the lesser', sh.safeHarborTotal, Math.min(8000, sh.totalTax * 0.9), 0.01);
const shHigh = se({ ...seBase, prior: 8_000, priorAgi: 200_000 });
chk('SE: safe harbour uses 110% above $150k AGI', shHigh.safeHarborRate, 110);
chk('SE: zero profit -> zero tax', se({ ...seBase, profit: 0 }).totalTax, 0);


// ============ Tool 11: capital gains ============
import { makeCompute as makeCG } from '../src/lib/tools/capital-gains.ts';
const cg = makeCG(STATE_TAX);
const cgBase = { basis: 20000, sale: 65000, income: 85000, held: 'long', status: 'single', st: 'TX', home: false, costs: 0 };

const g1 = cg(cgBase);
chk('CG: gross gain = sale - basis - costs', g1.grossGain, 45000);
chk('CG: no state tax in TX', g1.stateGainsTax, 0);
// ordinary taxable = 85000 - 15000 = 70000; 0% band ends at 48350, so all gain is 15%
chk('CG: long-term stacks above ordinary income', g1.federalGainsTax, 45000 * 0.15);
chk('CG: short-term costs more than long-term', cg({ ...cgBase, held: 'short' }).federalGainsTax > g1.federalGainsTax ? 1 : 0, 1, 0);
chk('CG: holding a year saves money', g1.savedByHolding > 0 ? 1 : 0, 1, 0);

// A gain straddling the 0% and 15% bands must not be taxed at one flat rate.
const straddle = cg({ ...cgBase, income: 30000, basis: 0, sale: 60000 });
const ordTaxable = 30000 - FEDERAL.single.standardDeduction;
chk('CG: straddling gain taxed in two bands', straddle.federalGainsTax,
  longTermGainsTax(ordTaxable, 60000, 'single'), 0.01);
chk('CG: straddling rate is below 15%', straddle.effectiveOnGain < 15 ? 1 : 0, 1, 0);

// Whole gain inside the 0% band.
chk('CG: low income, small gain is untaxed federally', cg({ ...cgBase, income: 20000, basis: 0, sale: 5000 }).federalGainsTax, 0);

// NIIT
const cgRich = cg({ ...cgBase, income: 300000, basis: 0, sale: 100000 });
chk('CG: NIIT applies above threshold', cgRich.niitApplies ? 1 : 0, 1, 0);
chk('CG: NIIT is lesser of gain and excess MAGI', cgRich.niit, Math.min(100000, 300000 + 100000 - 200000) * 0.038, 0.01);
chk('CG: no NIIT for modest income', g1.niit, 0);

// Home sale exclusion
const home = cg({ ...cgBase, basis: 200000, sale: 500000, home: true, status: 'single' });
chk('CG: home exclusion caps at 250k single', home.exclusionApplied, 250000);
chk('CG: only the excess is taxable', home.taxableGain, 300000 - 250000);
chk('CG: married exclusion is 500k', cg({ ...cgBase, basis: 200000, sale: 800000, home: true, status: 'married' }).exclusionApplied, 500000);

// Losses and edges
const loss = cg({ ...cgBase, sale: 5000 });
chk('CG: loss flagged', loss.isLoss ? 1 : 0, 1, 0);
chk('CG: loss produces no tax', loss.totalTax, 0);
chk('CG: selling costs reduce the gain', cg({ ...cgBase, costs: 5000 }).grossGain, 40000);
chk('CG: state taxes gains as income', cg({ ...cgBase, st: 'CA' }).stateGainsTax > 0 ? 1 : 0, 1, 0);

// ============ Tool 10: sales tax ============
import { makeCompute as makeST } from '../src/lib/tools/sales-tax.ts';
import { SALES_TAX } from '../src/data/sales-tax.ts';
const stx = makeST(SALES_TAX);
const stBase = { amount: 100, st: 'CA', mode: 'add', local: 'avg', sales: 0, txns: 0 };

const t1 = stx(stBase);
const CA = SALES_TAX.find((x) => x.code === 'CA');
chk('ST: combined = state + local', t1.combinedRate, CA.stateRate + CA.avgLocalRate, 0.001);
chk('ST: adding tax multiplies', t1.tax, 100 * (t1.combinedRate / 100), 0.01);
chk('ST: total = pre-tax + tax', t1.total, t1.preTax + t1.tax, 0.01);

// Removing tax must divide, not subtract. This is the classic error.
const rem = stx({ ...stBase, amount: t1.total, mode: 'remove' });
chk('ST: removing tax round-trips to the original', rem.preTax, 100, 0.01);
chk('ST: removing is not naive subtraction', Math.abs(rem.tax - t1.total * (t1.combinedRate / 100)) > 0.001 ? 1 : 0, 1, 0);

chk('ST: no-tax state charges nothing', stx({ ...stBase, st: 'OR' }).tax, 0);
chk('ST: no-tax state flagged', stx({ ...stBase, st: 'OR' }).noSalesTax ? 1 : 0, 1, 0);
chk('ST: local=none uses state rate only', stx({ ...stBase, local: 'none' }).combinedRate, CA.stateRate, 0.001);
chk('ST: local=max uses the ceiling', stx({ ...stBase, local: 'max' }).combinedRate, CA.stateRate + CA.maxLocalRate, 0.001);

// Nexus
chk('ST: nexus not triggered below threshold', stx({ ...stBase, sales: 50000 }).nexusTriggered ? 1 : 0, 0, 0);
chk('ST: nexus triggered at CA threshold', stx({ ...stBase, sales: 500000 }).nexusTriggered ? 1 : 0, 1, 0);
chk('ST: transaction test triggers where it exists', stx({ ...stBase, st: 'GA', txns: 250 }).nexusTriggered ? 1 : 0, 1, 0);
chk('ST: transaction count irrelevant where repealed', stx({ ...stBase, st: 'CA', txns: 99999 }).nexusTriggered ? 1 : 0, 0, 0);
chk('ST: remaining to threshold', stx({ ...stBase, sales: 400000 }).salesRemaining, 100000);

// ============ Tool 12: W-4 ============
import { compute as w4 } from '../src/lib/tools/w4.ts';
const wBase = { gross: 85000, freq: 'biweekly', status: 'single', kids: 0, deps: 0, other: 0, ded: 0, k401: 6, held: 0, extra: 0 };

const w1 = w4(wBase);
chk('W4: no dependents means no credits', w1.credits, 0);
chk('W4: liability equals tax before credits when none', w1.liability, w1.taxBeforeCredits, 0.01);
chk('W4: balanced when withholding matches liability', Math.abs(w1.difference) < 0.01 ? 1 : 0, 1, 0);

// The refund case: employer withholds as if no dependents, taxpayer has two kids.
const kids = w4({ ...wBase, kids: 2 });
chk('W4: two kids is twice the child credit', kids.credits, CREDITS.childTaxCredit * 2);
chk('W4: credits create a refund', kids.isRefund ? 1 : 0, 1, 0);
chk('W4: refund equals the credits not claimed on the W-4', kids.difference, CREDITS.childTaxCredit * 2, 0.01);
chk('W4: per-paycheck swing', kids.perPaycheckSwing, (CREDITS.childTaxCredit * 2) / 26, 0.01);
chk('W4: lost interest is positive when over-withheld', kids.lostInterest > 0 ? 1 : 0, 1, 0);
chk('W4: suggested credits equal the credit total', kids.suggestedCredits, CREDITS.childTaxCredit * 2);

// Under-withholding suggests extra per paycheck.
const under = w4({ ...wBase, held: 5000 });
chk('W4: under-withholding flagged', under.isRefund ? 1 : 0, 0, 0);
chk('W4: suggested extra covers the shortfall', under.suggestedExtra * 26, Math.abs(under.difference), 0.01);

// Credit phase-out
const phased = w4({ ...wBase, gross: 250000, kids: 2 });
chk('W4: credits phase out at high income', phased.creditsPhasedOut ? 1 : 0, 1, 0);
chk('W4: phase-out reduces $50 per $1,000', phased.credits,
  Math.max(0, CREDITS.childTaxCredit * 2 - Math.ceil((250000 - 250000 * 0.06 - CREDITS.phaseOutStart.single) / 1000) * 50), 1);
chk('W4: zero income is safe', w4({ ...wBase, gross: 0 }).liability, 0);

// ============ data pinning ============
// These assert the published figures themselves rather than the arithmetic.
// They SHOULD fail when the tax year rolls over — that failure is the prompt
// to re-read the Revenue Procedure, not a bug to route around.
chk('data: tax year', FEDERAL.year, 2026, 0);
chk('data: single standard deduction', FEDERAL.single.standardDeduction, 16_100, 0);
chk('data: married standard deduction', FEDERAL.married.standardDeduction, 32_200, 0);
chk('data: head of household standard deduction', FEDERAL.head.standardDeduction, 24_150, 0);
chk('data: top of 12% bracket, single', FEDERAL.single.brackets[1].upTo, 50_400, 0);
chk('data: top of 12% bracket, married', FEDERAL.married.brackets[1].upTo, 100_800, 0);
chk('data: 37% starts at, single', FEDERAL.single.brackets[5].upTo, 640_600, 0);
chk('data: social security wage base', FEDERAL.fica.socialSecurityWageBase, 184_500, 0);
chk('data: capital gains 0% ceiling, single', CAP_GAINS.brackets.single[0].upTo, 49_450, 0);
chk('data: capital gains 15% ceiling, married', CAP_GAINS.brackets.married[1].upTo, 613_700, 0);
chk('data: child tax credit', CREDITS.childTaxCredit, 2_200, 0);
chk('data: sales tax rows carry provenance', SALES_TAX.every((x) => x.verified && x.verified.source) ? 1 : 0, 1, 0);
chk('data: 16 states keep a transaction-count nexus test', SALES_TAX.filter((x) => x.nexusTransactions).length, 16, 0);
chk('data: Louisiana state sales rate', SALES_TAX.find((x) => x.code === 'LA').stateRate, 5.00, 0.001);
chk('data: five states levy no state sales tax', SALES_TAX.filter((x) => x.stateRate === 0).length, 5, 0);
chk('data: every dataset carries provenance', [FEDERAL, CAP_GAINS, CREDITS, SE_TAX].every((d) => d.verified && d.verified.checkedOn && d.verified.source && d.verified.by) ? 1 : 0, 1, 0);


console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);