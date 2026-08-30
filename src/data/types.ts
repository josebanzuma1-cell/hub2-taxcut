/* Shared shapes for the programmatic data sets.

   Every numeric field that a visitor could act on carries provenance. The
   `verified` flag is not decoration: pages render an explicit "unverified
   estimate" notice until it is true, and `npm run data:check` will fail a
   production build if PUBLIC_REQUIRE_VERIFIED=1 and any published row is
   still unverified.

   The reason is narrow and practical. Publishing a wrong transfer tax rate
   across 50 state pages is both a content-quality problem and the kind of
   thing a visitor makes a real financial decision on. Seeded values
   are a scaffold for the page template, not a data set. */

export interface StateData {
  code: string;
  name: string;
  slug: string;
  /** state-level real estate transfer tax as % of price; null = none imposed */
  transferTaxPct: number | null;
  /** counties/cities frequently add their own — noted per state */
  transferTaxNote: string;
  transferTaxPaidBy: 'buyer' | 'seller' | 'negotiable' | 'varies';
  /** typical deed + mortgage recording charge, flat dollars */
  recordingFee: number;
  /** states where an attorney is customarily required at closing */
  attorneyState: boolean;
  attorneyFee: number;
  /** average effective property tax, % of market value per year */
  propertyTaxPct: number;
  /** average annual homeowners premium */
  insuranceAnnual: number;
  verified: boolean;
  source: string;
}

export interface MetroData {
  slug: string;
  name: string;
  stateCode: string;
  /** median sale price */
  medianPrice: number;
  /** median household income, used for the affordability ratio */
  medianIncome: number;
  /** local effective property tax rate, % of value per year */
  propertyTaxPct: number;
  insuranceAnnual: number;
  /** median monthly rent, 2-bed — powers the rent-vs-buy cross-link */
  medianRent: number;
  verified: boolean;
  source: string;
}

/** Sources to verify against. Listed here so the check script can print them. */
export const SOURCES = {
  transferTax: 'State departments of revenue; ALTA state-by-state closing customs',
  propertyTax: 'Census Bureau American Community Survey, Table B25103 (median real estate taxes)',
  insurance: 'NAIC Homeowners Insurance Report (average annual premium by state)',
  price: 'FHFA House Price Index / Census ACS Table B25077 (median home value)',
  income: 'Census ACS Table B19013 (median household income)',
  rent: 'Census ACS Table B25064 (median gross rent)',
} as const;
