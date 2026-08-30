/* Hub-specific configuration. Rewritten per hub; the kit reads nothing from here. */

export const SITE = {
  name: 'Take Home',
  tagline: 'Paycheck and tax calculators that show the whole deduction stack',
  description:
    'Free take-home pay calculator with federal, state, FICA and pre-tax ' +
    'deductions itemised line by line. Plus quarterly estimates for the ' +
    'self-employed, capital gains, and W-4 withholding.',
  url: 'https://example.com', // TODO: real domain before launch
  locale: 'en_US',
} as const;

export interface Tool {
  slug: string;
  title: string;
  nav: string;
  blurb: string;
  /** the build plan's tool number, kept for traceability */
  planId: number;
  /** false until the page exists — keeps unbuilt tools out of nav and sitemap */
  built: boolean;
  group: 'paycheck' | 'business' | 'investing';
}

export const TOOLS: Tool[] = [
  {
    slug: 'paycheck-calculator',
    title: 'Take-Home Paycheck Calculator',
    nav: 'Take-home pay',
    blurb: 'Every deduction between gross and net — federal, state, FICA, and anything pre-tax — itemised rather than summed.',
    planId: 8, built: true, group: 'paycheck',
  },
  {
    slug: 'w4-withholding-calculator',
    title: 'W-4 Withholding Calculator',
    nav: 'W-4 withholding',
    blurb: 'Why your refund is so large, and what to change on the form so it stops being an interest-free loan.',
    planId: 12, built: false, group: 'paycheck',
  },
  {
    slug: 'self-employment-tax-calculator',
    title: 'Self-Employment Tax & Quarterly Estimates',
    nav: 'Quarterly taxes',
    blurb: 'SE tax, the deductible half, and what to send in each quarter to land inside the safe harbour.',
    planId: 9, built: false, group: 'business',
  },
  {
    slug: 'sales-tax-calculator',
    title: 'Sales Tax Calculator',
    nav: 'Sales tax',
    blurb: 'Combined state, county and city rates — plus the economic nexus thresholds that decide where you must register.',
    planId: 10, built: false, group: 'business',
  },
  {
    slug: 'capital-gains-tax-calculator',
    title: 'Capital Gains Tax Calculator',
    nav: 'Capital gains',
    blurb: 'Short versus long term, the bracket you actually land in, and cost-basis handling for crypto lots.',
    planId: 11, built: false, group: 'investing',
  },
];

export const toolBySlug = (slug: string): Tool | undefined => TOOLS.find((t) => t.slug === slug);
export const toolsExcept = (slug: string): Tool[] => BUILT.filter((t) => t.slug !== slug);
export const BUILT = TOOLS.filter((t) => t.built);
/** Nav, tiles and the sitemap only ever link to pages that exist. */
export const NAV = BUILT.map((t) => ({ href: `/tools/${t.slug}`, label: t.nav }));
