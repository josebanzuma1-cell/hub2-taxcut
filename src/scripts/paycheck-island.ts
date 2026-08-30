/* Client island for the take-home calculator. Shared by the generic tool page
   and all 51 state pages. */
import { mount } from '@kit/calc/engine';
import { stackedBarChart } from '@kit/calc/chart';
import { currency, currency2, currencyCompact } from '@kit/calc/format';
import { FIELDS, makeCompute } from '../lib/tools/paycheck';
import type { PaycheckModel } from '../lib/tools/paycheck';
import { STATE_TAX } from '../data/states-tax';

document.getElementById('pay-form')?.addEventListener('submit', (e) => e.preventDefault());

/* The state table is imported rather than inlined into each page's HTML.
   All 51 states are needed for the switcher regardless, so importing puts it
   in one shared JS chunk the browser caches once, instead of repeating ~3kB
   gzipped inside all 51 state pages. */
const states = STATE_TAX;

/* Each /paycheck-calculator/[state] page renders its own state as selected,
   but the engine seeds values from FIELDS defaults and would immediately
   overwrite that with the generic default — silently showing California's tax
   on all 51 state pages. Rebind the default to the page's own state so the
   server-rendered selection survives, and so a clean URL stays clean. */
const rawDefault = document.getElementById('pay-default-state')?.textContent;
let pageState = '';
try { pageState = rawDefault ? JSON.parse(rawDefault) : ''; } catch { pageState = ''; }

const fields = pageState
  ? FIELDS.map((f) => (f.key === 'st' ? { ...f, default: pageState } : f))
  : FIELDS;

const per = (v: number, n: number) => currency2(v / n);

function renderTable(m: PaycheckModel) {
  const body = document.querySelector('#pay-table tbody');
  if (!body) return;
  const n = m.periodsPerYear;
  const rows: Array<[string, string, number]> = [
    ['Gross pay', '—', m.grossAnnual],
    ['Health, HSA and FSA premiums', 'Income tax and FICA', -m.section125],
    ['401(k) contribution', 'Income tax only', -m.retirement],
    ['Federal income tax', '—', -m.federalTax],
    ['Social Security', '—', -m.socialSecurity],
    ['Medicare', '—', -m.medicare],
  ];
  if (m.additionalMedicare > 0) rows.push(['Additional Medicare (0.9%)', '—', -m.additionalMedicare]);
  rows.push([`State income tax — ${m.stateName}`, '—', -m.stateTax]);
  if (m.extraWithholding > 0) rows.push(['Extra withholding (W-4 4c)', '—', -m.extraWithholding]);
  if (m.postTax > 0) rows.push(['Post-tax deductions', '—', -m.postTax]);

  body.innerHTML = rows
    .filter((r) => r[2] !== 0)
    .map(([label, reduces, amount]) => `<tr>
        <td>${label}</td>
        <td style="text-align:left;color:var(--c-ink-3);font-size:var(--t-xs)">${reduces}</td>
        <td>${per(amount, n)}</td>
        <td>${currency(amount)}</td>
      </tr>`).join('')
    + `<tr style="background:var(--c-accent-soft)">
        <th style="text-align:left">Take-home pay</th><th></th>
        <th>${currency2(m.netPeriod)}</th><th>${currency(m.netAnnual)}</th>
      </tr>`;
}

mount<PaycheckModel>({
  id: 'pay',
  fields,
  compute: makeCompute(states),
  debounceMs: 80,
  onRender(m) {
    renderTable(m);

    const pre = document.getElementById('pay-pretax');
    if (pre) pre.textContent = currency(m.section125 + m.retirement);

    const el = document.getElementById('chart-pay');
    if (el) {
      stackedBarChart(el, {
        groups: [{
          label: 'Gross pay',
          segments: [
            { value: m.netAnnual, color: 'var(--c-series-1)', name: 'Take-home' },
            { value: m.federalTax, color: 'var(--c-series-2)', name: 'Federal' },
            { value: m.socialSecurity + m.medicare + m.additionalMedicare, color: '#8a6fb0', name: 'FICA' },
            { value: m.stateTax, color: 'var(--c-series-3)', name: 'State' },
            { value: m.section125 + m.retirement, color: '#5aa17f', name: 'Pre-tax' },
            { value: m.postTax + m.extraWithholding, color: '#9aa3b5', name: 'Other' },
          ].filter((s) => s.value > 0),
        }],
        yFormat: currencyCompact,
        height: 190,
      });
    }

    const notes = document.getElementById('pay-notes');
    if (!notes) return;
    const items: string[] = [];
    if (m.stateKind === 'none') {
      items.push(`<li><strong>${m.stateName} has no state income tax.</strong> Everything withheld here is federal or FICA.</li>`);
    }
    if (m.stateHasLocalTax) {
      items.push(`<li><strong>Local income tax is not included.</strong> Counties or cities in ${m.stateName} levy their own income tax on top of the state figure. Your actual take-home will be lower than shown.</li>`);
    }
    if (m.mfjApproximated) {
      items.push(`<li><strong>Married brackets are approximated for ${m.stateName}.</strong> This state uses its own joint-filer table rather than doubling the single brackets, so the state tax shown is overstated. Treat it as an upper bound.</li>`);
    }
    if (m.ssCapped) {
      items.push(`<li><strong>You have hit the Social Security wage base.</strong> Withholding stops for the rest of the year once you pass it, so later paychecks are larger than earlier ones. This model spreads it evenly.</li>`);
    }
    if (m.additionalMedicare > 0) {
      items.push(`<li><strong>Additional Medicare applies.</strong> An extra 0.9% is withheld on wages above the threshold for your filing status.</li>`);
    }
    notes.innerHTML = items.length
      ? `<div class="note note--warn"><strong class="note__title">Worth knowing for your situation</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
      : '';
  },
});
