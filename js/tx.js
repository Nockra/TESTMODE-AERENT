// Transaction runner. Every action is shown as named steps with explicit states, and pending hashes survive reloads.
import { S, emit } from './state.js';
import { icon } from './icons.js';
import { esc, load, save, sleep, short } from './util.js';
import { explainRevert } from './abi.js';
import { revertData } from './rpc.js';
import { toast } from './ui.js';
import { switchNetwork, connect } from './walletflow.js';

const KEY = 'aerent.activity.v3';
let activity = load(KEY, []);
export const getActivity = () => activity.filter(a => a.net === S.netKey);
export function addActivity(item) {
  activity.unshift({ id: crypto.randomUUID?.() || String(Date.now() + Math.random()), time: Date.now(), net: S.netKey, ...item });
  activity = activity.slice(0, 200);
  save(KEY, activity);
  emit('activity');
  return activity[0];
}
function patch(id, fields) {
  const a = activity.find(x => x.id === id);
  if (a) Object.assign(a, fields);
  save(KEY, activity);
  emit('activity');
}
export function clearActivity() { activity = activity.filter(a => a.net !== S.netKey); save(KEY, activity); emit('activity'); }

export function friendlyError(err) {
  if (err?.friendly) return err.message;
  const code = err?.code ?? err?.cause?.code;
  const text = String(err?.message || err || '').toLowerCase();
  if (code === 4001 || code === 'ACTION_REJECTED' || text.includes('user rejected') || text.includes('user denied')) return 'You rejected the request in your wallet.';
  const reason = explainRevert(revertData(err));
  if (reason) return reason;
  if (text.includes('insufficient funds')) return 'Not enough ETH on Robinhood Chain to pay gas. Open Get ETH to bridge some.';
  if (text.includes('transfer amount exceeds balance') || text.includes('insufficient balance')) return 'Your wallet balance is too low for this transaction.';
  if (err?.message && err.message.length < 140 && !text.includes('0x')) return err.message;
  return 'The transaction could not be completed.';
}

/** Recover pending transactions after a refresh. */
export async function resumePending() {
  for (const a of getActivity().filter(x => x.status === 'pending' && x.hash)) {
    waitReceipt(a.hash).then(r => {
      patch(a.id, { status: r?.status === '0x1' ? 'confirmed' : r ? 'failed' : 'pending' });
      if (r) emit('chain');
    });
  }
}

async function waitReceipt(hash, timeout = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    let r = await S.rpc.request('eth_getTransactionReceipt', [hash]).catch(() => null);
    if (!r && S.provider) r = await S.provider.request({ method: 'eth_getTransactionReceipt', params: [hash] }).catch(() => null);
    if (r) return r;
    await sleep(1500);
  }
  return null;
}

/**
 * Render and run a plan inside `box`. Resolves true when every step confirmed.
 * steps: [{ label, detail, build?: async () => ({to,data})|null, simulate?: fn }]
 */
export async function runPlan(box, steps, { title, onDone } = {}) {
  const states = steps.map(() => ({ s: 'wait', msg: '' }));
  const draw = () => {
    box.innerHTML = `<div class="steps">${steps.map((st, i) => {
      const x = states[i];
      const cls = x.s === 'done' || x.s === 'skip' ? 'done' : x.s === 'fail' ? 'fail' : x.s === 'wait' ? '' : 'active';
      const dot = cls === 'done' ? icon('check') : cls === 'fail' ? icon('close') : String(i + 1);
      const right = {
        wait: '', wallet: '<span class="spin"></span>Confirm in wallet', submitted: '<span class="spin"></span>Confirming',
        sim: '<span class="spin"></span>Processing', done: 'Confirmed', skip: 'Already approved', fail: 'Failed', check: '<span class="spin"></span>Checking'
      }[x.s];
      const link = x.hash && S.net.explorerUrl ? ` <a href="${esc(S.net.explorerUrl)}/tx/${esc(x.hash)}" target="_blank" rel="noopener noreferrer">${esc(short(x.hash, 8, 6))}</a>` : '';
      return `<div class="stepi ${cls}"><span class="dot">${dot}</span><div><strong>${esc(st.label)}</strong><small>${esc(x.msg || st.detail || '')}${link}</small></div><span class="state">${right}</span></div>`;
    }).join('')}</div>`;
  };
  draw();

  try {
    if (!S.account) { const ok = await connect(); if (!ok) throw new Error('Connect a wallet to continue.'); }
    const preview = S.src.mode === 'preview';
    if (!preview && S.walletChainId !== S.net.chainId) await switchNetwork();

    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (preview) {
        states[i] = { s: 'sim', msg: 'Preview transaction, nothing is sent onchain' }; draw();
        await sleep(650);
        st.simulate?.();
        states[i] = { s: 'done', msg: 'Preview transaction' }; draw();
        continue;
      }
      states[i] = { s: 'check', msg: '' }; draw();
      const tx = await st.build();
      if (!tx) { states[i] = { s: 'skip', msg: 'Allowance already covers this amount' }; draw(); continue; }
      // simulate first so a revert is explained before the wallet opens
      await S.rpc.ethCall(tx.to, tx.data, S.account).catch(err => { throw Object.assign(new Error(friendlyError(err)), { friendly: true }); });
      states[i] = { s: 'wallet', msg: '' }; draw();
      const hash = await S.provider.request({ method: 'eth_sendTransaction', params: [{ from: S.account, to: tx.to, data: tx.data, value: '0x0' }] });
      const act = addActivity({ title: st.label, detail: title || '', hash, status: 'pending', chainId: S.net.chainId });
      states[i] = { s: 'submitted', msg: 'Submitted', hash }; draw();
      const r = await waitReceipt(hash);
      if (!r) { patch(act.id, { status: 'pending' }); throw Object.assign(new Error('Still confirming. It will update in Activity when it lands.'), { friendly: true }); }
      if (r.status !== '0x1') { patch(act.id, { status: 'failed' }); throw Object.assign(new Error('The transaction reverted onchain.'), { friendly: true }); }
      patch(act.id, { status: 'confirmed' });
      states[i] = { s: 'done', msg: 'Confirmed onchain', hash }; draw();
    }
    if (preview) addActivity({ title: title || steps.at(-1).label, detail: 'Preview transaction', status: 'preview' });
    toast(title || 'Done', preview ? 'Completed in preview mode.' : 'Confirmed on Robinhood Chain.', 'ok');
    emit('chain');
    onDone?.();
    return true;
  } catch (err) {
    const msg = friendlyError(err);
    const i = states.findIndex(x => x.s !== 'done' && x.s !== 'skip');
    if (i >= 0) { states[i] = { ...states[i], s: 'fail', msg }; draw(); }
    toast('Not completed', msg, 'bad');
    return false;
  }
}
