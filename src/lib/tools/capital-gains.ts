/* Tool 11 — Capital gains.

   The thing most gains calculators get wrong: long-term gain is not taxed at
   one rate. It stacks on top of your ordinary income, so a single sale can
   straddle 0%, 15% and 20%. Applying one flat rate to the whole gain is wrong
   in both directions depending on income.

   Short-term gain is different again — it is ordinary income, taxed at your
   marginal rate, which is why the one-year holding line is worth so much. */
import {
  FEDERAL, CAP_GAINS, taxFromBrackets, marginalRate, longTermGainsTax,
} from '@data/federal';
import type { FilingStatus } from '@data/federal';
import type { StateTax } from '@data/states-tax';
import type { FieldSpec, Values } from '@kit/calc/url-state';

export const FIELDS: FieldSpec[] = [
  { key: 'basis',  type: 'number', default: 20_000, min: 0, max: 100_000_000, dp: 0 },
  { key: 'sale',   type: 'number', default: 65_000, min: 0, max: 100_000_000, dp: 0 },
  { key: 'income', type: 'number', default: 85_000, min: 0, max: 50_000_000,  dp: 0 },
  { key: 'held',   type: 'text',   default: 'long' },
  { key: 'status', type: 'text',   default: 'single' },
  { key: 'st',     type: 'text',   default: 'CA' },
  { key: 'home',   type: 'bool',   default: false },
  { key: 'costs',  type: 'number', default: 0,      min: 0, max: 10_000_000,  dp: 0 },
];

export const D = FIELDS.reduce<Record<string, number | string | boolean>>(
  (m, f) => ((m[f.key] = f.default), m), {});

export interface CapGainsModel {
  grossGain: number;
  sellingCosts: number;
  exclusionApplied: number;
  taxableGain: number;
  isLong: boolean;
  ordinaryTaxable: number;
  federalGainsTax: number;
  niit: number;
  stateGainsTax: number;
  totalTax: number;
  netProceeds: number;
  effectiveOnGain: number;
  marginalOrdinary: number;
  gainsRate: number;
  shortTermTax: number;
  savedByHolding: number;
  niitApplies: boolean;
  isLoss: boolean;
  stateName: string;
  stateNote: string;
  /** state has no wage tax but does tax gains — the model cannot compute it */
  untaxedGainCaveat: boolean;
}

export function makeCompute(states: StateTax[]) {
  return function compute(v: Values): CapGainsModel {
    const basis = Math.max(0, Number(v.basis) || 0);
    const sale = Math.max(0, Number(v.sale) || 0);
    const sellingCosts = Math.max(0, Number(v.costs) || 0);
    const income = Math.max(0, Number(v.income) || 0);
    const isLong = v.held !== 'short';
    const status: FilingStatus =
      v.status === 'married' ? 'married' : v.status === 'head' ? 'head' : 'single';
    const st = states.find((s) => s.code === v.st) ?? states[0];
    const isHome = Boolean(v.home);

    const grossGain = sale - sellingCosts - basis;
    const exclusionApplied = isHome && grossGain > 0
      ? Math.min(grossGain, CAP_GAINS.homeSaleExclusion[status])
      : 0;
    const taxableGain = Math.max(0, grossGain - exclusionApplied);
    const isLoss = grossGain < 0;

    const fed = FEDERAL[status];
    const ordinaryTaxable = Math.max(0, income - fed.standardDeduction);
    const marginalOrdinary = marginalRate(ordinaryTaxable, fed.brackets);

    // Short-term is ordinary income: tax the stack, subtract the base.
    const shortTermTax = taxableGain > 0
      ? taxFromBrackets(ordinaryTaxable + taxableGain, fed.brackets)
        - taxFromBrackets(ordinaryTaxable, fed.brackets)
      : 0;
    const longTermTax = longTermGainsTax(ordinaryTaxable, taxableGain, status);

    const federalGainsTax = isLong ? longTermTax : shortTermTax;

    // NIIT applies to the lesser of net investment income or MAGI above the
    // threshold — so a modest gain for a high earner is fully exposed, while a
    // large gain for a low earner is only partly exposed.
    const magi = income + taxableGain;
    const overThreshold = Math.max(0, magi - CAP_GAINS.niitThreshold[status]);
    const niitBase = Math.min(taxableGain, overThreshold);
    const niit = niitBase * (CAP_GAINS.niitRate / 100);

    // Almost every state taxes capital gains as ordinary income.
    let stateGainsTax = 0;
    if (st.kind === 'flat') stateGainsTax = taxableGain * ((st.flatRate ?? 0) / 100);
    else if (st.kind === 'progressive') {
      const stateSd = status === 'married' ? st.standardDeduction.married : st.standardDeduction.single;
      const stateBase = Math.max(0, income - stateSd);
      const mfjTable = status === 'married' ? st.marriedBrackets : undefined;
      const table = mfjTable?.length ? mfjTable : (st.brackets ?? []);
      const half = status === 'married' && !mfjTable?.length && st.mfjDoubles;
      const withGain = half
        ? taxFromBrackets((stateBase + taxableGain) / 2, table) * 2
        : taxFromBrackets(stateBase + taxableGain, table);
      const without = half
        ? taxFromBrackets(stateBase / 2, table) * 2
        : taxFromBrackets(stateBase, table);
      stateGainsTax = Math.max(0, withGain - without);
    }

    const totalTax = federalGainsTax + niit + stateGainsTax;

    return {
      grossGain, sellingCosts, exclusionApplied, taxableGain, isLong,
      ordinaryTaxable, federalGainsTax, niit, stateGainsTax, totalTax,
      netProceeds: sale - sellingCosts - totalTax,
      effectiveOnGain: taxableGain > 0 ? (totalTax / taxableGain) * 100 : 0,
      marginalOrdinary,
      gainsRate: taxableGain > 0
        ? marginalRate(ordinaryTaxable + taxableGain, CAP_GAINS.brackets[status])
        : 0,
      shortTermTax: shortTermTax + niit + stateGainsTax,
      savedByHolding: Math.max(0, shortTermTax - longTermTax),
      niitApplies: niit > 0,
      isLoss,
      stateName: st.name,
      stateNote: st.note,
      // A no-income-tax state that nonetheless taxes capital gains: Washington
      // is currently the only one. Reporting zero would be plainly wrong, so
      // the page says the model cannot compute it rather than implying nil.
      untaxedGainCaveat: st.kind === 'none' && /capital gains/i.test(st.note) && taxableGain > 0 && isLong,
    };
  };
}
