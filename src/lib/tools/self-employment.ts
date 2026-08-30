/* Tool 9 — Self-employment tax and quarterly estimates.

   Three things this gets right that quick estimators usually skip:

   1. SE tax is charged on 92.35% of net profit, not 100%. The 7.65% haircut
      mirrors the employer-side FICA a W-2 worker never sees.
   2. W-2 wages consume the Social Security wage base FIRST. Someone with a job
      and a side business may owe no SS portion at all on the business income,
      only Medicare — a difference of 12.4% on the overlap.
   3. Half of SE tax is deductible against income tax, which lowers the income
      tax owed on the same profit. */
import { FEDERAL, SE_TAX, taxFromBrackets, marginalRate } from '@data/federal';
import type { FilingStatus } from '@data/federal';
import type { StateTax } from '@data/states-tax';
import type { FieldSpec, Values } from '@kit/calc/url-state';

export const FIELDS: FieldSpec[] = [
  { key: 'profit', type: 'number', default: 90_000, min: 0, max: 10_000_000, dp: 0 },
  { key: 'w2',     type: 'number', default: 0,      min: 0, max: 10_000_000, dp: 0 },
  { key: 'status', type: 'text',   default: 'single' },
  { key: 'st',     type: 'text',   default: 'CA' },
  { key: 'qbi',    type: 'bool',   default: true },
  { key: 'prior',  type: 'number', default: 0,      min: 0, max: 5_000_000, dp: 0 },
  { key: 'priorAgi', type: 'number', default: 0,    min: 0, max: 50_000_000, dp: 0 },
];

export const D = FIELDS.reduce<Record<string, number | string | boolean>>(
  (m, f) => ((m[f.key] = f.default), m), {});

export interface SEModel {
  profit: number;
  kept: number;
  netEarnings: number;
  ssPortion: number;
  medicarePortion: number;
  additionalMedicare: number;
  seTax: number;
  deductibleHalf: number;
  qbiDeduction: number;
  federalTaxable: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalFederal: number;
  quarterly: number;
  safeHarborTotal: number;
  safeHarborQuarterly: number;
  safeHarborRate: number;
  usesSafeHarbor: boolean;
  ssBaseRemaining: number;
  ssFullyUsedByW2: boolean;
  stateName: string;
}

export function makeCompute(states: StateTax[]) {
  return function compute(v: Values): SEModel {
    const profit = Math.max(0, Number(v.profit) || 0);
    const w2 = Math.max(0, Number(v.w2) || 0);
    const status: FilingStatus =
      v.status === 'married' ? 'married' : v.status === 'head' ? 'head' : 'single';
    const st = states.find((s) => s.code === v.st) ?? states[0];
    const wantQbi = Boolean(v.qbi);
    const prior = Math.max(0, Number(v.prior) || 0);
    const priorAgi = Math.max(0, Number(v.priorAgi) || 0);

    const { fica } = FEDERAL;
    const netEarnings = profit * (SE_TAX.netEarningsRate / 100);

    // W-2 wages fill the Social Security wage base before self-employment income.
    const ssBaseRemaining = Math.max(0, fica.socialSecurityWageBase - w2);
    const ssSubject = Math.min(netEarnings, ssBaseRemaining);
    const ssPortion = ssSubject * (SE_TAX.socialSecurityRate / 100);
    const medicarePortion = netEarnings * (SE_TAX.medicareRate / 100);

    const addlThreshold = fica.additionalMedicareThreshold[status];
    const combinedForAddl = w2 + netEarnings;
    const additionalMedicare =
      Math.max(0, combinedForAddl - addlThreshold) * (SE_TAX.additionalMedicareRate / 100);

    const seTax = ssPortion + medicarePortion + additionalMedicare;
    const deductibleHalf = seTax * (SE_TAX.deductibleShare / 100);

    // QBI: a flat 20% of profit here. Real §199A has wage and property limits and
    // a phase-out for specified service businesses; the page says so.
    const agi = profit + w2 - deductibleHalf;
    const fed = FEDERAL[status];
    const beforeQbi = Math.max(0, agi - fed.standardDeduction);
    const qbiDeduction = wantQbi ? Math.min(profit * 0.2, beforeQbi * 0.2) : 0;

    const federalTaxable = Math.max(0, beforeQbi - qbiDeduction);
    const federalTax = taxFromBrackets(federalTaxable, fed.brackets);

    const stateSd = status === 'married' ? st.standardDeduction.married : st.standardDeduction.single;
    const stateTaxable = Math.max(0, agi - stateSd);
    let stateTax = 0;
    if (st.kind === 'flat') stateTax = stateTaxable * ((st.flatRate ?? 0) / 100);
    else if (st.kind === 'progressive') {
      stateTax = status === 'married' && st.mfjDoubles
        ? taxFromBrackets(stateTaxable / 2, st.brackets ?? []) * 2
        : taxFromBrackets(stateTaxable, st.brackets ?? []);
    }

    const totalTax = seTax + federalTax + stateTax;

    // Safe harbour: pay the lesser of 90% of this year, or 100% of last year —
    // 110% if last year's AGI was above $150,000. Meeting it avoids the
    // underpayment penalty even if this year turns out much bigger.
    const safeHarborRate = priorAgi > 150_000 ? 110 : 100;
    const priorBased = prior * (safeHarborRate / 100);
    const currentBased = totalTax * 0.9;
    const safeHarborTotal = prior > 0 ? Math.min(priorBased, currentBased) : currentBased;

    return {
      profit,
      kept: Math.max(0, profit - totalTax),
      netEarnings, ssPortion, medicarePortion, additionalMedicare, seTax,
      deductibleHalf, qbiDeduction, federalTaxable, federalTax, stateTax, totalTax,
      effectiveRate: profit > 0 ? (totalTax / profit) * 100 : 0,
      marginalFederal: marginalRate(federalTaxable, fed.brackets),
      quarterly: totalTax / 4,
      safeHarborTotal,
      safeHarborQuarterly: safeHarborTotal / 4,
      safeHarborRate,
      usesSafeHarbor: prior > 0 && priorBased < currentBased,
      ssBaseRemaining,
      ssFullyUsedByW2: ssBaseRemaining <= 0,
      stateName: st.name,
    };
  };
}
