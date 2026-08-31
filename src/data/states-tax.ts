/* State income tax parameters, 50 states + DC.

   ALL ROWS SEEDED AND UNVERIFIED. Every one must be checked against that
   state's department of revenue before launch. State income tax is the most
   error-prone data in the portfolio: rates change mid-year, brackets are
   indexed differently in every state, and several states layer local income
   taxes on top that this model does not attempt to compute.

   Structural simplification, stated openly on every page that uses it:
   progressive states store the single-filer brackets. `mfjDoubles` records
   whether married-filing-jointly brackets are simply double the single ones —
   true in most states, false where the state uses its own table. Where it is
   false the married calculation falls back to the single table, which
   understates the bracket width and therefore OVERSTATES tax. Fix by adding
   explicit married brackets for those states before launch. */
import type { Bracket } from './federal';

export interface StateTax {
  code: string;
  name: string;
  slug: string;
  kind: 'none' | 'flat' | 'progressive';
  /** flat states only */
  flatRate?: number;
  /** progressive states only — single-filer table */
  brackets?: Bracket[];
  /** are MFJ brackets exactly double the single brackets? */
  mfjDoubles?: boolean;
  standardDeduction: { single: number; married: number };
  /** counties or cities levy their own income tax on top */
  localTax: boolean;
  note: string;
  verified: boolean;
  source: string;
}

const none = (code: string, name: string, note: string): StateTax => ({
  code, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  kind: 'none', standardDeduction: { single: 0, married: 0 },
  localTax: false, note,
  // Confirmed that none of the nine taxes wage income. Washington and New
  // Hampshire are the ones that moved recently — see their notes.
  verified: {
    checkedOn: '2026-08-31',
    source: 'Tax Foundation, State Individual Income Tax Rates and Brackets 2026; ' +
      '2026 State Tax Competitiveness Index',
    by: 'BAMU',
  },
  source: 'Tax Foundation 2026 — no wage income tax confirmed',
});

const flat = (
  code: string, name: string, flatRate: number,
  sd: [number, number], localTax: boolean, note: string,
): StateTax => ({
  code, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  kind: 'flat', flatRate,
  standardDeduction: { single: sd[0], married: sd[1] },
  localTax, note,
  // Rates checked for all fourteen single-rate states. Deductions checked where
  // the state sets its own or conforms to the (now verified) federal figure;
  // the exceptions are named in each row note.
  verified: {
    checkedOn: '2026-08-31',
    source: 'Tax Foundation, State Individual Income Tax Rates and Brackets 2026; ' +
      'corroborated by State Tax Changes Taking Effect January 1, 2026',
    by: 'BAMU',
  },
  source: 'Tax Foundation 2026 single-rate table — rate verified',
});

const prog = (
  code: string, name: string, brackets: Bracket[], mfjDoubles: boolean,
  sd: [number, number], localTax: boolean, note: string,
): StateTax => ({
  code, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  kind: 'progressive', brackets, mfjDoubles,
  standardDeduction: { single: sd[0], married: sd[1] },
  localTax, note,
  // Bracket schedules checked for all 28 graduated states. Standard
  // deductions were NOT taken from the same source — its deduction column
  // proved unreliable for the single-rate states — so they remain seeded.
  verified: {
    checkedOn: '2026-08-31',
    source: 'Tax Foundation, State Individual Income Tax Rates and Brackets 2026 ' +
      '(bracket schedules only; standard deductions still unverified)',
    by: 'BAMU',
  },
  source: 'Tax Foundation 2026 — brackets verified, standard deduction seeded',
});

const b = (upTo: number | null, rate: number): Bracket => ({ upTo, rate });

export const STATE_TAX: StateTax[] = [
  none('AK', 'Alaska', 'No state income tax.'),
  none('FL', 'Florida', 'No state income tax.'),
  none('NV', 'Nevada', 'No state income tax.'),
  none('SD', 'South Dakota', 'No state income tax.'),
  none('TN', 'Tennessee', 'No tax on wages. The Hall tax on interest and dividends was fully phased out in 2021.'),
  none('TX', 'Texas', 'No state income tax.'),
  none('WY', 'Wyoming', 'No state income tax.'),
  none('NH', 'New Hampshire', 'No tax on wages. The interest and dividends tax was fully repealed effective 1 January 2025, so New Hampshire now levies no individual income tax at all.'),
  none('WA', 'Washington', 'No tax on wages. A separate capital gains excise tax applies to long-term gains above roughly $270,000 (indexed annually); SB 5813 replaced the flat 7% with a graduated structure adding a higher rate above $1 million.'),

  flat('AZ', 'Arizona', 2.50, [15_000, 30_000], false, 'Flat rate on Arizona taxable income. Arizona conforms to the federal standard deduction; the value here follows that conformity and is pending a direct check against the Department of Revenue.'),
  flat('CO', 'Colorado', 4.40, [16_100, 32_200], false, 'Flat rate; Colorado starts from federal taxable income.'),
  flat('ID', 'Idaho', 5.30, [16_100, 32_200], false, 'Flat rate on Idaho taxable income.'),
  flat('IL', 'Illinois', 4.95, [0, 0],           false, 'Flat rate. Illinois allows no standard deduction — it uses a personal exemption instead, which this model does not apply, so tax is slightly overstated at low incomes.'),
  flat('IN', 'Indiana', 2.95, [0, 0],           true,  'Flat state rate, plus a county income tax everywhere in the state. Indiana uses personal exemptions rather than a standard deduction; not modelled here.'),
  flat('KY', 'Kentucky', 3.50, [3_360, 3_360],   true,  'Flat rate; some cities and counties add an occupational tax.'),
  flat('MI', 'Michigan', 4.25, [0, 0],           true,  'Flat rate; two dozen cities levy their own income tax. Michigan uses personal exemptions rather than a standard deduction; not modelled here.'),
  flat('MS', 'Mississippi', 4.00, [2_300, 4_600],   false, 'Flat rate on income above an exempt amount.'),
  flat('NC', 'North Carolina', 3.99, [12_750, 25_500], false, 'Flat rate, scheduled to continue stepping down.'),
  flat('PA', 'Pennsylvania', 3.07, [0, 0],           true,  'Flat rate on gross compensation — Pennsylvania allows no standard deduction and no personal exemption. Most municipalities add a local earned income tax.'),
  flat('UT', 'Utah', 4.50, [0, 0],           false, 'Flat rate; Utah uses a taxpayer tax credit rather than a deduction.'),
  flat('GA', 'Georgia', 5.19, [12_000, 24_000], false, 'Flat rate, stepping down annually.'),

  prog('AL', 'Alabama', [b(500, 2), b(3_000, 4), b(null, 5)], true, [3_000, 8_500], true,
       'Some municipalities levy an occupational tax on wages.'),
  prog('AR', 'Arkansas', [b(4_600, 2), b(null, 3.9)], true, [2_340, 4_680], false,
       'Rates apply to Arkansas net taxable income.'),
  prog('CA', 'California', [b(11_079, 1), b(26_264, 2), b(41_452, 4), b(57_542, 6), b(72_724, 8), b(371_479, 9.3), b(445_771, 10.3), b(742_953, 11.3), b(1_000_000, 12.3), b(null, 13.3)], true, [5_540, 11_080], false,
       'Brackets include the 1% mental health services surtax as the 13.3% top band above $1 million, so the top rate shown is the full 13.3% a Californian actually pays. SDI is withheld separately and is not modelled.'),
  prog('CT', 'Connecticut', [b(10_000, 2), b(50_000, 4.5), b(100_000, 5.5), b(200_000, 6), b(250_000, 6.5), b(500_000, 6.9), b(null, 6.99)], true, [0, 0], false,
       'Connecticut uses personal exemptions that phase out with income rather than a standard deduction.'),
  prog('DE', 'Delaware', [b(2_000, 0), b(5_000, 2.2), b(10_000, 3.9), b(20_000, 4.8), b(25_000, 5.2), b(60_000, 5.55), b(null, 6.6)], false, [3_250, 6_500], true,
       'Wilmington levies a city wage tax.'),
  prog('DC', 'District of Columbia', [b(10_000, 4), b(40_000, 6), b(60_000, 6.5), b(250_000, 8.5), b(500_000, 9.25), b(1_000_000, 9.75), b(null, 10.75)], false, [15_000, 30_000], false,
       'DC brackets are the same for single and joint filers.'),
  prog('HI', 'Hawaii', [b(9_600, 1.4), b(14_400, 3.2), b(19_200, 5.5), b(24_000, 6.4), b(36_000, 6.8), b(48_000, 7.2), b(125_000, 7.6), b(175_000, 7.9), b(225_000, 8.25), b(275_000, 9), b(325_000, 10), b(null, 11)], true, [4_400, 8_800], false,
       'Hawaii has one of the widest bracket structures in the country.'),
  flat('IA', 'Iowa', 3.80, [16_100, 32_200], false, 'Iowa completed its move to a single flat rate.'),
  prog('KS', 'Kansas', [b(23_000, 5.2), b(null, 5.58)], true, [3_605, 8_240], false,
       'Two brackets following recent consolidation.'),
  flat('LA', 'Louisiana', 3.00, [12_875, 25_750], false, 'Louisiana moved to a flat rate with a large standard deduction.'),
  prog('ME', 'Maine', [b(27_399, 5.8), b(64_849, 6.75), b(null, 7.15)], true, [15_000, 30_000], false,
       'Standard deduction phases out at higher incomes.'),
  prog('MD', 'Maryland', [b(1_000, 2), b(2_000, 3), b(3_000, 4), b(100_000, 4.75), b(125_000, 5), b(150_000, 5.25), b(250_000, 5.5), b(500_000, 5.75), b(1_000_000, 6.25), b(null, 6.5)], false, [2_700, 5_450], true,
       'Every Maryland county levies a local income tax of roughly 2.25%–3.20% on top. Not included here.'),
  prog('MA', 'Massachusetts', [b(1_083_150, 5), b(null, 9)], true, [0, 0], false,
       'Flat 5% plus a 4% surtax on income above $1 million.'),
  prog('MN', 'Minnesota', [b(33_310, 5.35), b(109_430, 6.8), b(203_150, 7.85), b(null, 9.85)], true, [14_950, 29_900], false,
       'Minnesota indexes brackets annually.'),
  prog('MO', 'Missouri', [b(1_348, 0), b(2_696, 2), b(4_044, 2.5), b(5_392, 3), b(6_740, 3.5), b(8_088, 4), b(9_436, 4.5), b(null, 4.7)], true, [15_000, 30_000], true,
       'Kansas City and St. Louis levy a 1% earnings tax.'),
  prog('MT', 'Montana', [b(47_500, 4.7), b(null, 5.65)], true, [15_000, 30_000], false,
       'Montana cut its top rate and widened the lower band for 2026.'),
  prog('NE', 'Nebraska', [b(4_130, 2.46), b(24_760, 3.51), b(null, 4.55)], true, [8_000, 16_000], false,
       'Nebraska is mid-phase-down; the top rate continues to fall in later years.'),
  prog('NJ', 'New Jersey', [b(20_000, 1.4), b(35_000, 1.75), b(40_000, 3.5), b(75_000, 5.525), b(500_000, 6.37), b(1_000_000, 8.97), b(null, 10.75)], false, [0, 0], false,
       'New Jersey uses personal exemptions rather than a standard deduction, and has a separate joint-filer table.'),
  prog('NM', 'New Mexico', [b(5_500, 1.5), b(16_500, 3.2), b(33_500, 4.3), b(66_500, 4.7), b(210_000, 4.9), b(null, 5.9)], true, [15_000, 30_000], false,
       'New Mexico follows the federal standard deduction.'),
  prog('NY', 'New York', [b(8_500, 3.9), b(11_700, 4.4), b(13_900, 5.15), b(80_650, 5.4), b(215_400, 5.9), b(1_077_550, 6.85), b(5_000_000, 9.65), b(25_000_000, 10.3), b(null, 10.9)], false, [8_000, 16_050], true,
       'New York cut its lower-bracket rates for 2026. New York City and Yonkers levy their own income tax on residents, which is not included here.'),
  prog('ND', 'North Dakota', [b(48_475, 0), b(244_825, 1.95), b(null, 2.5)], false, [15_000, 30_000], false,
       'North Dakota has the lowest top rate of any state that taxes wages.'),
  prog('OH', 'Ohio', [b(26_050, 0), b(null, 2.75)], true, [0, 0], true,
       'Ohio moved to a flat 2.75% on nonbusiness income above $26,050 effective January 2026, so the schedule is now a zero band and a single rate. Most Ohio municipalities levy an income tax of 1%-3% on top, which is not included here.'),
  prog('OK', 'Oklahoma', [b(3_750, 0), b(4_900, 2.5), b(7_200, 3.5), b(null, 4.5)], true, [6_350, 12_700], false,
       'Oklahoma collapsed six brackets into three and cut the top rate to 4.5%, effective January 2026.'),
  prog('OR', 'Oregon', [b(4_550, 4.75), b(11_400, 6.75), b(125_000, 8.75), b(null, 9.9)], true, [2_745, 5_495], true,
       'The Portland metro area levies additional local income taxes.'),
  prog('RI', 'Rhode Island', [b(82_050, 3.75), b(186_450, 4.75), b(null, 5.99)], true, [10_550, 21_150], false,
       'Standard deduction phases out at higher incomes.'),
  prog('SC', 'South Carolina', [b(3_640, 0), b(18_230, 3), b(null, 6)], true, [15_000, 30_000], false,
       'South Carolina follows the federal standard deduction.'),
  prog('VT', 'Vermont', [b(49_400, 3.35), b(119_700, 6.6), b(249_700, 7.6), b(null, 8.75)], false, [7_000, 14_050], false,
       'Vermont has its own joint-filer table.'),
  prog('VA', 'Virginia', [b(3_000, 2), b(5_000, 3), b(17_000, 5), b(null, 5.75)], true, [8_500, 17_000], false,
       'Virginia brackets have not been indexed for many years.'),
  prog('WV', 'West Virginia', [b(10_000, 2.22), b(25_000, 2.96), b(40_000, 3.33), b(60_000, 4.44), b(null, 4.82)], true, [0, 0], true,
       'Some municipalities levy a flat city service fee rather than an income tax.'),
  prog('WI', 'Wisconsin', [b(15_110, 3.5), b(51_950, 4.4), b(332_720, 5.3), b(null, 7.65)], false, [13_230, 24_490], false,
       'Wisconsin has a separate joint-filer table and a phasing standard deduction.'),
];

export const stateBySlug = (slug: string): StateTax | undefined =>
  STATE_TAX.find((s) => s.slug === slug);
export const stateByCode = (code: string): StateTax | undefined =>
  STATE_TAX.find((s) => s.code === code);
export const unverifiedStateTax = (): StateTax[] => STATE_TAX.filter((s) => !s.verified);
