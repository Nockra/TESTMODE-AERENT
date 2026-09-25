import { S } from '../state.js';
import { esc, usd, duration, remaining } from '../util.js';
import { modal } from '../ui.js';
import { fmt } from '../data.js';
import { runPlan } from '../tx.js';
import { loadAll } from '../data.js';

/** Confirm sheet for filling or cancelling a request. */
export function offerAction(kind, o) {
  const fill = kind === 'fillOffer';
  const rows = fill
    ? [['You send', `${fmt(o.amountNum)} ${o.t.symbol}`], ['You are paid now', `${fmt(o.feeNum)} ${o.c.symbol}`],
       ['Their collateral', `${fmt(o.collNum)} ${o.c.symbol}${o.coverage ? `, ${Math.round(o.coverage * 100)}% of value` : ''}`],
       ['Term', duration(o.duration)], ['Returned to you', `${fmt(o.amountNum)} ${o.t.symbol} at the end, or their collateral if they default`]]
    : [['Returned to you', `${fmt(o.collNum + o.feeNum)} ${o.c.symbol}`], ['Request', `#${o.id} closes`], ['Expires', remaining(o.expiresAt)]];
  const title = fill ? `Fill request for ${fmt(o.amountNum)} ${o.t.symbol}` : 'Cancel your request';
  modal(title, `<div class="sum">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>
    <div data-steps style="margin:14px 0"></div><button class="btn btn-lime btn-lg btn-block" data-go>${fill ? 'Fill request' : 'Cancel request'}</button>`,
    (el, close) => {
      el.querySelector('[data-go]').onclick = async e => {
        e.currentTarget.disabled = true;
        const steps = S.src.plans[kind]({ offer: o, symbol: o.t.symbol, account: S.account });
        const ok = await runPlan(el.querySelector('[data-steps]'), steps, { title });
        if (ok) { await loadAll(); setTimeout(close, 700); } else e.currentTarget.disabled = false;
      };
    });
}
