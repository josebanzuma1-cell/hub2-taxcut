/* Tool 8 — Take-home paycheck.

   The nuance most paycheck calculators get wrong: pre-tax deductions do not
   all reduce the same wage base.

   - Section 125 items (health, dental, vision premiums, FSA, payroll HSA)
     reduce BOTH income-tax wages and FICA wages.
   - Traditional 401(k) reduces income-tax wages ONLY. Social Security and
     Medicare are still charged on it. Treating 401(k) as reducing FICA
     overstates take-home by roughly 7.65% of the contribution.

   Getting that backwards is worth hundreds of dollars a year in a projection,
   which is why the two are separated here rather than summed into one
   "pre-tax" figure. */
import { FEDERAL, taxFromBrackets, marginalRate } from '@data/federal';
import type { FilingStatus } from '@data/federal';
import type { StateTax } from '@data/states-tax';
import type { FieldSpec, Values } from '@kit/calc/url-state';

export const PERIODS = {
  weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, annual: 1,
} as const;
export type PeriodKey = keyof typeof PERIODS;

export const FIELDS: FieldSpec[] = [
  { key: 'gross',  type: 'number', default: 85_000, min: 0, max: 10_000_000, dp: 0 },
  { key: 'freq',   type: 'text',   default: 'biweekly' },
  { key: 'status', type: 'text',   default: 'single' },
  { key: 'st',     type: 'text',   default: 'CA' },
  { key: 'k401',   type: 'number', default: 6,      min: 0, max: 90,      dp: 2 },
  { key: 'health', type: 'number', default: 2_400,  min: 0, max: 200_000, dp: 0 },
  { key: 'hsa',    type: 'number', default: 0,      min: 0, max: 20_000,  dp: 0 },
  { key: 'post',   type: 'number', default: 0,      min: 0, max: 500_000, dp: 0 },
  { key: 'extra',  type: 'number', default: 0,      min: 0, max: 100_000, dp: 0 },
];

export const D = FIELDS.reduce<Record<string, number | string | boolean>>(
  (m, f) => ((m[f.key] = f.default), m), {});

export interface PaycheckModel {
  periodsPerYear: number;
  grossAnnual: number;
  grossPeriod: number;
  section125: number;
  retirement: number;
  ficaWages: number;
  federalTaxable: number;
  stateTaxable: number;
  federalTax: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  stateTax: number;
  postTax: number;
  extraWithholding: number;
  totalTax: number;
  netAnnual: number;
  netPeriod: number;
  effectiveRate: number;
  marginalFederal: number;
  ssCapped: boolean;
  stateName: string;
  stateKind: StateTax['kind'];
  stateHasLocalTax: boolean;
  mfjApproximated: boolean;
}

function stateTaxFor(st: StateTax, taxable: number, status: FilingStatus): number {
  if (st.kind === 'none' || taxable <= 0) return 0;
  if (st.kind === 'flat') return taxable * ((st.flatRate ?? 0) / 100);
  const brackets = st.brackets ?? [];
  // Where MFJ brackets are double the single table, halve the income, tax it
  // on the single table, and double the result — arithmetically identical and
  // avoids storing a second table for 22 of the 30 progressive states.
  if (status === 'married' && st.mfjDoubles) {
    return taxFromBrackets(taxable / 2, brackets) * 2;
  }
  return taxFromBrackets(taxable, brackets);
}

export function makeCompute(states: StateTax[]) {
  return function compute(v: Values): PaycheckModel {
    const grossAnnual = Math.max(0, Number(v.gross) || 0);
    const freq = (String(v.freq) in PERIODS ? String(v.freq) : 'biweekly') as PeriodKey;
    const periodsPerYear = PERIODS[freq];
    const status: FilingStatus =
      v.status === 'married' ? 'married' : v.status === 'head' ? 'head' : 'single';
    const st = states.find((s) => s.code === v.st) ?? states[0];

    // Section 125: reduces income-tax wages AND FICA wages.
    const section125 = Math.min(grossAnnual, (Number(v.health) || 0) + (Number(v.hsa) || 0));
    // 401(k): reduces income-tax wages only. Still subject to FICA.
    const retirement = Math.min(
      Math.max(0, grossAnnual - section125),
      grossAnnual * ((Number(v.k401) || 0) / 100),
    );

    const ficaWages = Math.max(0, grossAnnual - section125);
    const incomeWages = Math.max(0, grossAnnual - section125 - retirement);

    const fed = FEDERAL[status];
    const federalTaxable = Math.max(0, incomeWages - fed.standardDeduction);
    const federalTax = taxFromBrackets(federalTaxable, fed.brackets);

    const { fica } = FEDERAL;
    const ssBase = Math.min(ficaWages, fica.socialSecurityWageBase);
    const socialSecurity = ssBase * (fica.socialSecurityRate / 100);
    const medicare = ficaWages * (fica.medicareRate / 100);
    const addlThreshold = fica.additionalMedicareThreshold[status];
    const additionalMedicare = Math.max(0, ficaWages - addlThreshold) * (fica.additionalMedicareRate / 100);

    const stateSd = status === 'married' ? st.standardDeduction.married : st.standardDeduction.single;
    const stateTaxable = Math.max(0, incomeWages - stateSd);
    const stateTax = stateTaxFor(st, stateTaxable, status);

    const postTax = Math.max(0, Number(v.post) || 0);
    const extraWithholding = Math.max(0, Number(v.extra) || 0);

    const totalTax = federalTax + socialSecurity + medicare + additionalMedicare + stateTax + extraWithholding;
    const netAnnual = Math.max(0, grossAnnual - section125 - retirement - totalTax - postTax);

    return {
      periodsPerYear,
      grossAnnual,
      grossPeriod: grossAnnual / periodsPerYear,
      section125, retirement, ficaWages, federalTaxable, stateTaxable,
      federalTax, socialSecurity, medicare, additionalMedicare, stateTax,
      postTax, extraWithholding, totalTax,
      netAnnual,
      netPeriod: netAnnual / periodsPerYear,
      effectiveRate: grossAnnual > 0 ? (totalTax / grossAnnual) * 100 : 0,
      marginalFederal: marginalRate(federalTaxable, fed.brackets),
      ssCapped: ficaWages > fica.socialSecurityWageBase,
      stateName: st.name,
      stateKind: st.kind,
      stateHasLocalTax: st.localTax,
      mfjApproximated: status === 'married' && st.kind === 'progressive' && !st.mfjDoubles,
    };
  };
}
