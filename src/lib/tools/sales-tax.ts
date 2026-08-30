/* Tool 10 — Sales tax, plus an economic nexus check.

   Two calculations that look similar and are not:
   - Adding tax to a pre-tax amount: total = amount x (1 + rate)
   - Backing tax out of a tax-inclusive total: amount = total / (1 + rate)
   Subtracting the rate from the total is the classic error and always
   understates the tax.

   The nexus check answers the question a seller actually has: "am I required
   to register in this state?" Post-Wayfair that turns on sales volume and, in
   19 states, a separate transaction count. */
import type { SalesTaxState } from '@data/sales-tax';
import type { FieldSpec, Values } from '@kit/calc/url-state';

export const FIELDS: FieldSpec[] = [
  { key: 'amount', type: 'number', default: 100, min: 0, max: 100_000_000, dp: 2 },
  { key: 'st',     type: 'text',   default: 'CA' },
  { key: 'mode',   type: 'text',   default: 'add' },
  { key: 'local',  type: 'text',   default: 'avg' },
  { key: 'sales',  type: 'number', default: 0,   min: 0, max: 1_000_000_000, dp: 0 },
  { key: 'txns',   type: 'number', default: 0,   min: 0, max: 10_000_000,    dp: 0 },
];

export const D = FIELDS.reduce<Record<string, number | string | boolean>>(
  (m, f) => ((m[f.key] = f.default), m), {});

export interface SalesTaxModel {
  stateName: string;
  stateRate: number;
  localRate: number;
  combinedRate: number;
  minCombined: number;
  maxCombined: number;
  preTax: number;
  tax: number;
  total: number;
  isRemoving: boolean;
  noSalesTax: boolean;
  hasLocalVariation: boolean;
  /* nexus */
  nexusSales: number | null;
  nexusTransactions: number | null;
  salesMet: boolean;
  txnsMet: boolean;
  nexusTriggered: boolean;
  nexusChecked: boolean;
  salesRemaining: number;
  note: string;
}

export function makeCompute(states: SalesTaxState[]) {
  return function compute(v: Values): SalesTaxModel {
    const st = states.find((s) => s.code === v.st) ?? states[0];
    const amount = Math.max(0, Number(v.amount) || 0);
    const isRemoving = v.mode === 'remove';
    const localChoice = String(v.local);

    const localRate =
      localChoice === 'none' ? 0 : localChoice === 'max' ? st.maxLocalRate : st.avgLocalRate;
    const combinedRate = st.stateRate + localRate;
    const f = combinedRate / 100;

    // Removing tax divides; adding multiplies. Getting these the wrong way
    // round is the single most common sales-tax mistake.
    const preTax = isRemoving ? amount / (1 + f) : amount;
    const tax = isRemoving ? amount - preTax : amount * f;
    const total = preTax + tax;

    const sales = Math.max(0, Number(v.sales) || 0);
    const txns = Math.max(0, Number(v.txns) || 0);
    const nexusChecked = sales > 0 || txns > 0;
    const salesMet = st.nexusSales !== null && sales >= st.nexusSales;
    const txnsMet = st.nexusTransactions !== null && txns >= st.nexusTransactions;

    return {
      stateName: st.name,
      stateRate: st.stateRate,
      localRate,
      combinedRate,
      minCombined: st.stateRate,
      maxCombined: st.stateRate + st.maxLocalRate,
      preTax, tax, total,
      isRemoving,
      noSalesTax: st.stateRate === 0 && st.maxLocalRate === 0,
      hasLocalVariation: st.maxLocalRate > 0,
      nexusSales: st.nexusSales,
      nexusTransactions: st.nexusTransactions,
      salesMet, txnsMet,
      nexusTriggered: salesMet || txnsMet,
      nexusChecked,
      salesRemaining: st.nexusSales !== null ? Math.max(0, st.nexusSales - sales) : 0,
      note: st.note,
    };
  };
}
