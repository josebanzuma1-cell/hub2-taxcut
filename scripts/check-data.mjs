/* Data verification gate. Runs before every build.

   Default: reports unverified rows and passes, so local development is not
   blocked by a data set that is deliberately incomplete.
   With PUBLIC_REQUIRE_VERIFIED=1: fails the build. Set this in production.

   Tax data raises the stakes over other hubs: a wrong bracket misstates
   somebody's actual filing, not an estimate. */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('./federal')) return next(pathToFileURL(path.join(root, 'src/data/federal.ts')).href, ctx);
    if (spec.startsWith('./types')) return next(pathToFileURL(path.join(root, 'src/data/types.ts')).href, ctx);
    return next(spec, ctx);
  },
});

const { FEDERAL } = await import(pathToFileURL(path.join(root, 'src/data/federal.ts')).href);
const { STATE_TAX } = await import(pathToFileURL(path.join(root, 'src/data/states-tax.ts')).href);

const strict = process.env.PUBLIC_REQUIRE_VERIFIED === '1';
const report = process.argv.includes('--report');
const problems = [];
let unverified = 0;

// --- federal ---
if (!FEDERAL.verified) { unverified++; console.log(`  federal (tax year ${FEDERAL.year}): UNVERIFIED`); }
else console.log(`  federal (tax year ${FEDERAL.year}): verified`);

for (const status of ['single', 'married', 'head']) {
  const b = FEDERAL[status].brackets;
  if (!b?.length) { problems.push(`federal/${status}: no brackets`); continue; }
  if (b[b.length - 1].upTo !== null) problems.push(`federal/${status}: top bracket must have upTo: null`);
  let prev = 0;
  for (const x of b) {
    if (x.rate < 0 || x.rate > 60) problems.push(`federal/${status}: implausible rate ${x.rate}`);
    if (x.upTo !== null && x.upTo <= prev) problems.push(`federal/${status}: brackets out of order at ${x.upTo}`);
    if (x.upTo !== null) prev = x.upTo;
  }
}

// --- states ---
const bad = STATE_TAX.filter((s) => !s.verified);
unverified += bad.length;
console.log(`  states: ${STATE_TAX.length - bad.length}/${STATE_TAX.length} verified`);
if (report && bad.length) console.log(`    unverified: ${bad.map((s) => s.code).join(', ')}`);

const slugs = new Set();
for (const s of STATE_TAX) {
  if (slugs.has(s.slug)) problems.push(`states: duplicate slug "${s.slug}"`);
  slugs.add(s.slug);
  if (s.kind === 'flat' && !(s.flatRate > 0)) problems.push(`${s.code}: flat state without a rate`);
  if (s.kind === 'progressive') {
    const b = s.brackets ?? [];
    if (!b.length) problems.push(`${s.code}: progressive state without brackets`);
    if (b.length && b[b.length - 1].upTo !== null) problems.push(`${s.code}: top bracket must have upTo: null`);
    let prev = 0;
    for (const x of b) {
      if (x.rate < 0 || x.rate > 20) problems.push(`${s.code}: implausible rate ${x.rate}`);
      if (x.upTo !== null && x.upTo <= prev) problems.push(`${s.code}: brackets out of order at ${x.upTo}`);
      if (x.upTo !== null) prev = x.upTo;
    }
  }
}

if (report) {
  const approx = STATE_TAX.filter((s) => s.kind === 'progressive' && !s.mfjDoubles);
  console.log(`    married brackets approximated in: ${approx.map((s) => s.code).join(', ')}`);
  console.log(`    local income tax not modelled in: ${STATE_TAX.filter((s) => s.localTax).map((s) => s.code).join(', ')}`);
}

if (problems.length) {
  console.error('\nData problems:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

if (unverified > 0) {
  const msg = `${unverified} data set(s) still unverified — see src/data/README.md`;
  if (strict) { console.error(`\nBUILD BLOCKED: ${msg}`); process.exit(1); }
  console.log(`\n  Warning: ${msg}`);
  console.log('  Pages render an "unverified estimate" notice. Set PUBLIC_REQUIRE_VERIFIED=1 to block production builds.');
}
