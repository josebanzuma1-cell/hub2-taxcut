/* Tool 12 — W-4 withholding.

   Answers "why is my refund so large" by comparing two numbers people rarely
   see side by side: what will actually be withheld this year at the current
   W-4 settings, and what will actually be owed.

   A refund is not a windfall. It is the amount you overpaid, returned without
   interest, having been unavailable to you for up to sixteen months. The tool
   is built to make that arithmetic concrete and then say what to change. */
import { FEDERAL, CREDITS, taxFromBrackets, marginalRate } from '@data/federal';
import type { FilingStatus } from '@data/federal';
import type { FieldSpec, Values } from '@kit/calc/url-state';
import { PERIODS } from './paycheck';
import type { PeriodKey } from './paycheck';

export const FIELDS: FieldSpec[] = [
  { key: 'gross',  type: 'number', default: 85_000, min: 0, max: 10_000_000, dp: 0 },
  { key: 'freq',   type: 'text',   default: 'biweekly' },
  { key: 'status', type: 'text',   default: 'single' },
  { key: 'kids',   type: 'number', default: 0, min: 0, max: 20, dp: 0 },
  { key: 'deps',   type: 'number', default: 0, min: 0, max: 20, dp: 0 },
  { key: 'other',  type: 'number', default: 0, min: 0, max: 10_000_000, dp: 0 },
  { key: 'ded',    type: 'number', default: 0, min: 0, max: 1_000_000, dp: 0 },
  { key: 'k401',   type: 'number', default: 6, min: 0, max: 90, dp: 2 },
  { key: 'held',   type: 'number', default: 0, min: 0, max: 1_000_000, dp: 0 },
  { key: 'extra',  type: 'number', default: 0, min: 0, max: 100_000, dp: 0 },
];

export const D = FIELDS.reduce<Record<string, number | string | boolean>>(
  (m, f) => ((m[f.key] = f.default), m), {});

export interface W4Model {
  periodsPerYear: number;
  taxableIncome: number;
  taxBeforeCredits: number;
  credits: number;
  creditsPhasedOut: boolean;
  liability: number;
  withheldAnnual: number;
  withheldPerPeriod: number;
  difference: number;
  isRefund: boolean;
  perPaycheckSwing: number;
  /** interest-free loan: average balance the government held, times a rate */
  lostInterest: number;
  suggestedExtra: number;
  suggestedCredits: number;
  marginalRate: number;
  effectiveRate: number;
  monthsHeld: number;
}

/** Average return on money you could have kept, used only to size the cost of
 *  over-withholding. Deliberately conservative. */
const OPPORTUNITY_RATE = 4.0;

export function compute(v: Values): W4Model {
  const gross = Math.max(0, Number(v.gross) || 0);
  const freq = (String(v.freq) in PERIODS ? String(v.freq) : 'biweekly') as PeriodKey;
  const periodsPerYear = PERIODS[freq];
  const status: FilingStatus =
    v.status === 'married' ? 'married' : v.status === 'head' ? 'head' : 'single';
  const kids = Math.max(0, Math.round(Number(v.kids) || 0));
  const deps = Math.max(0, Math.round(Number(v.deps) || 0));
  const otherIncome = Math.max(0, Number(v.other) || 0);
  const extraDeductions = Math.max(0, Number(v.ded) || 0);
  const k401 = Math.max(0, Number(v.k401) || 0);
  const extra = Math.max(0, Number(v.extra) || 0);

  const retirement = gross * (k401 / 100);
  const fed = FEDERAL[status];
  const agi = Math.max(0, gross - retirement + otherIncome);
  const taxableIncome = Math.max(0, agi - fed.standardDeduction - extraDeductions);
  const taxBeforeCredits = taxFromBrackets(taxableIncome, fed.brackets);

  // Credits phase out above a threshold at $50 per $1,000 of excess.
  const rawCredits = kids * CREDITS.childTaxCredit + deps * CREDITS.otherDependentCredit;
  const phaseStart = CREDITS.phaseOutStart[status];
  const excess = Math.max(0, agi - phaseStart);
  const reduction = Math.ceil(excess / 1_000) * 50;
  const credits = Math.max(0, rawCredits - reduction);

  const liability = Math.max(0, taxBeforeCredits - credits);

  // If no current withholding is supplied, assume the employer is withholding
  // roughly the liability before credits — which is what the default W-4
  // produces when dependents are not claimed on it. That is precisely the
  // situation that generates large refunds.
  const suppliedHeld = Math.max(0, Number(v.held) || 0);
  const withheldAnnual = (suppliedHeld > 0 ? suppliedHeld : taxBeforeCredits) + extra;

  const difference = withheldAnnual - liability;
  const isRefund = difference > 0;

  // Money withheld through the year is refunded after filing. Averaged over the
  // year the government holds about half of it, for roughly 18 months to the
  // refund date on the earliest dollar — call it 12 months average.
  const monthsHeld = 12;
  const lostInterest = Math.max(0, difference) * 0.5 * (OPPORTUNITY_RATE / 100) * (monthsHeld / 12);

  return {
    periodsPerYear,
    taxableIncome,
    taxBeforeCredits,
    credits,
    creditsPhasedOut: rawCredits > 0 && credits < rawCredits,
    liability,
    withheldAnnual,
    withheldPerPeriod: withheldAnnual / periodsPerYear,
    difference,
    isRefund,
    perPaycheckSwing: Math.abs(difference) / periodsPerYear,
    lostInterest,
    // To stop over-withholding, claim the credits on W-4 step 3.
    suggestedCredits: credits,
    // If under-withheld, line 4(c) is the direct fix.
    suggestedExtra: difference < 0 ? Math.abs(difference) / periodsPerYear : 0,
    marginalRate: marginalRate(taxableIncome, fed.brackets),
    effectiveRate: gross > 0 ? (liability / gross) * 100 : 0,
    monthsHeld,
  };
}
