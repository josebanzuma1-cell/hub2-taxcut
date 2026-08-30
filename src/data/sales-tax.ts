/* State sales tax rates and economic nexus thresholds.

   SEEDED AND UNVERIFIED. Verify against each state's department of revenue.

   Deliberate scope limit: this is STATE rate plus a typical LOCAL average, not
   a ZIP-level lookup. Combined rates vary street to street — a single ZIP can
   straddle two districts — and publishing a precise-looking figure we cannot
   source would be worse than publishing an honest range. Every page says so,
   and shows the local range rather than one number.

   Nexus thresholds are the remote-seller registration triggers established
   after South Dakota v. Wayfair. Most states dropped their transaction-count
   test; where one survives it is recorded here. */

export interface SalesTaxState {
  code: string;
  name: string;
  slug: string;
  /** statewide rate, % */
  stateRate: number;
  /** typical combined local add-on, % */
  avgLocalRate: number;
  /** highest local add-on seen in the state, % */
  maxLocalRate: number;
  /** economic nexus: annual sales into the state, USD */
  nexusSales: number | null;
  /** economic nexus: separate transaction count test, if the state still has one */
  nexusTransactions: number | null;
  note: string;
  verified: boolean;
  source: string;
}

const s = (
  code: string, name: string, stateRate: number, avgLocal: number, maxLocal: number,
  nexusSales: number | null, nexusTransactions: number | null, note: string,
): SalesTaxState => ({
  code, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
  stateRate, avgLocalRate: avgLocal, maxLocalRate: maxLocal,
  nexusSales, nexusTransactions, note,
  verified: false, source: 'seeded estimate — unverified',
});

export const SALES_TAX: SalesTaxState[] = [
  s('AL', 'Alabama',        4.00, 5.29, 7.50, 250_000, null, 'Simplified remote seller programme available.'),
  s('AK', 'Alaska',         0.00, 1.82, 7.50, 100_000, null, 'No state sales tax, but many boroughs and cities levy their own.'),
  s('AZ', 'Arizona',        5.60, 2.80, 5.60, 100_000, null, 'Transaction privilege tax rather than a true sales tax.'),
  s('AR', 'Arkansas',       6.50, 2.95, 6.13, 100_000, 200,  'Transaction count test still applies.'),
  s('CA', 'California',     7.25, 1.60, 4.75, 500_000, null, 'Highest statewide base rate in the country.'),
  s('CO', 'Colorado',       2.90, 4.90, 8.30, 100_000, null, 'Home-rule cities administer their own tax; among the most complex states to comply in.'),
  s('CT', 'Connecticut',    6.35, 0.00, 0.00, 100_000, 200,  'No local sales tax. Both thresholds must be met.'),
  s('DE', 'Delaware',       0.00, 0.00, 0.00, null,    null, 'No sales tax at any level. A gross receipts tax applies to sellers.'),
  s('DC', 'District of Columbia', 6.00, 0.00, 0.00, 100_000, 200, 'No local add-on.'),
  s('FL', 'Florida',        6.00, 1.00, 2.00, 100_000, null, 'Transaction count test repealed.'),
  s('GA', 'Georgia',        4.00, 3.40, 5.00, 100_000, 200,  'Transaction count test still applies.'),
  s('HI', 'Hawaii',         4.00, 0.50, 0.50, 100_000, 200,  'General excise tax on the seller, commonly passed through.'),
  s('ID', 'Idaho',          6.00, 0.03, 3.00, 100_000, null, 'Local option tax limited to resort communities.'),
  s('IL', 'Illinois',       6.25, 2.60, 4.75, 100_000, 200,  'Sourcing rules differ for in-state and remote sellers.'),
  s('IN', 'Indiana',        7.00, 0.00, 0.00, 100_000, null, 'No local sales tax.'),
  s('IA', 'Iowa',           6.00, 0.94, 1.00, 100_000, null, 'Local option tax of 1% in most jurisdictions.'),
  s('KS', 'Kansas',         6.50, 2.25, 4.10, 100_000, null, 'Reduced rate applies to groceries.'),
  s('KY', 'Kentucky',       6.00, 0.00, 0.00, 100_000, 200,  'No local sales tax.'),
  s('LA', 'Louisiana',      4.45, 5.10, 7.00, 100_000, null, 'Highest average combined rate; parishes administer locally.'),
  s('ME', 'Maine',          5.50, 0.00, 0.00, 100_000, null, 'No local sales tax.'),
  s('MD', 'Maryland',       6.00, 0.00, 0.00, 100_000, 200,  'No local sales tax.'),
  s('MA', 'Massachusetts',  6.25, 0.00, 0.00, 100_000, null, 'No local sales tax.'),
  s('MI', 'Michigan',       6.00, 0.00, 0.00, 100_000, 200,  'No local sales tax.'),
  s('MN', 'Minnesota',      6.875, 1.20, 2.00, 100_000, null, 'Clothing is exempt.'),
  s('MS', 'Mississippi',    7.00, 0.06, 1.00, 250_000, null, 'Very limited local add-on.'),
  s('MO', 'Missouri',       4.225, 4.20, 6.13, 100_000, null, 'Wide variation between localities.'),
  s('MT', 'Montana',        0.00, 0.00, 3.00, null,    null, 'No general sales tax; resort communities may levy a local tax.'),
  s('NE', 'Nebraska',       5.50, 1.45, 2.50, 100_000, 200,  'Transaction count test still applies.'),
  s('NV', 'Nevada',         6.85, 1.39, 1.53, 100_000, 200,  'Transaction count test still applies.'),
  s('NH', 'New Hampshire',  0.00, 0.00, 0.00, null,    null, 'No sales tax at any level.'),
  s('NJ', 'New Jersey',     6.625, 0.00, 0.00, 100_000, 200, 'Reduced rate in Urban Enterprise Zones.'),
  s('NM', 'New Mexico',     4.875, 2.85, 4.31, 100_000, null, 'Gross receipts tax on the seller.'),
  s('NY', 'New York',       4.00, 4.53, 4.88, 500_000, 100,  'Both tests must be met — sales AND transaction count.'),
  s('NC', 'North Carolina', 4.75, 2.25, 2.75, 100_000, null, 'Transaction count test repealed.'),
  s('ND', 'North Dakota',   5.00, 2.05, 3.50, 100_000, null, 'Transaction count test repealed.'),
  s('OH', 'Ohio',           5.75, 1.50, 2.25, 100_000, 200,  'Transaction count test still applies.'),
  s('OK', 'Oklahoma',       4.50, 4.50, 7.00, 100_000, null, 'Groceries exempted from the state rate.'),
  s('OR', 'Oregon',         0.00, 0.00, 0.00, null,    null, 'No sales tax. A corporate activity tax applies to large sellers.'),
  s('PA', 'Pennsylvania',   6.00, 0.34, 2.00, 100_000, null, 'Only Philadelphia and Allegheny County add local tax.'),
  s('RI', 'Rhode Island',   7.00, 0.00, 0.00, 100_000, 200,  'No local sales tax.'),
  s('SC', 'South Carolina', 6.00, 1.50, 3.00, 100_000, null, 'Transaction count test repealed.'),
  s('SD', 'South Dakota',   4.20, 1.91, 4.50, 100_000, null, 'The state behind the Wayfair decision; count test since repealed.'),
  s('TN', 'Tennessee',      7.00, 2.55, 2.75, 100_000, null, 'Among the highest average combined rates.'),
  s('TX', 'Texas',          6.25, 1.95, 2.00, 500_000, null, 'Single local use tax rate option for remote sellers.'),
  s('UT', 'Utah',           6.10, 1.15, 2.95, 100_000, 200,  'Transaction count test still applies.'),
  s('VT', 'Vermont',        6.00, 0.36, 1.00, 100_000, 200,  'Transaction count test still applies.'),
  s('VA', 'Virginia',       5.30, 0.47, 1.70, 100_000, 200,  'Statewide rate includes a 1% local component.'),
  s('WA', 'Washington',     6.50, 2.90, 4.10, 100_000, null, 'Destination sourcing; rates change frequently.'),
  s('WV', 'West Virginia',  6.00, 0.55, 1.00, 100_000, 200,  'Transaction count test still applies.'),
  s('WI', 'Wisconsin',      5.00, 0.70, 1.75, 100_000, null, 'County tax of 0.5% in most counties.'),
  s('WY', 'Wyoming',        4.00, 1.44, 2.00, 100_000, null, 'Transaction count test repealed.'),
];

export const salesStateByCode = (code: string): SalesTaxState | undefined =>
  SALES_TAX.find((x) => x.code === code);
export const unverifiedSalesTax = (): SalesTaxState[] => SALES_TAX.filter((x) => !x.verified);
