import { S } from '../state.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { toast } from '../ui.js';

const validAddress = value => /^0x[a-fA-F0-9]{40}$/.test(value || '');

function urlWithCa(template, ca) {
  if (!template) return '';
  return template.replaceAll('{ca}', encodeURIComponent(ca || ''));
}

function openExternal(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

export function renderAerentToken(w) {
  const cfg = S.cfg.tokenPage || {};
  const ticker = cfg.ticker || '$AERENT';
  const name = cfg.name || 'AERENT';
  const ca = (cfg.contractAddress || '').trim();
  const hasCa = validAddress(ca);
  const buyUrl = urlWithCa(cfg.buyUrl || '', ca);
  const dexUrl = hasCa
    ? urlWithCa(cfg.dexScreenerUrl || 'https://dexscreener.com/search?q={ca}', ca)
    : '';
  const xUrl = cfg.xUrl || S.cfg.xUrl || '';

  w.setSub('Official token page');
  w.body.innerHTML = `
    <div class="coin-page">
      <section class="coin-hero-card">
        <div class="coin-mark"><img src="/assets/mark-dark.webp" alt="AERENT"></div>
        <div class="coin-hero-copy">
          <span class="coin-kicker">AERENT Marketplace</span>
          <h2>${esc(ticker)}</h2>
          <p>The official token page for ${esc(name)}. Use the verified contract address below when buying or checking market data.</p>
        </div>
      </section>

      <section class="coin-ca-card">
        <div class="coin-section-head">
          <div>
            <small>Contract address</small>
            <strong>${hasCa ? 'Verified CA' : 'CA not published yet'}</strong>
          </div>
          <span class="coin-status">${esc(ticker)}</span>
        </div>
        <div class="coin-ca-box">
          <span class="mono coin-ca-value">${hasCa ? esc(ca) : 'Contract address will appear here at launch'}</span>
          <button class="icon-btn coin-copy" data-copy-ca aria-label="Copy contract address" ${hasCa ? '' : 'disabled'}>${icon('copy')}</button>
        </div>
        <p class="coin-note">Always verify the contract address shown on this page before making a purchase.</p>
      </section>

      <section class="coin-actions-card">
        <div class="coin-section-head">
          <div>
            <small>Official links</small>
            <strong>Trade and verify</strong>
          </div>
        </div>
        <div class="coin-actions-grid">
          <button class="btn btn-lime btn-lg" data-coin-buy ${buyUrl ? '' : 'disabled'}>Buy ${esc(ticker)}</button>
          <button class="btn btn-glass btn-lg" data-coin-dex ${dexUrl ? '' : 'disabled'}>${icon('external')}Dexscreener</button>
          <button class="btn btn-ink btn-lg" data-coin-x ${xUrl ? '' : 'disabled'}>${icon('x')}Official X</button>
        </div>
      </section>
    </div>`;

  w.body.querySelector('[data-copy-ca]')?.addEventListener('click', async () => {
    if (!hasCa) return;
    try {
      await navigator.clipboard.writeText(ca);
      toast('Contract address copied', ca.slice(0, 8) + '…' + ca.slice(-6));
    } catch {
      toast('Could not copy', 'Select the contract address and copy it manually.', 'bad');
    }
  });

  w.body.querySelector('[data-coin-buy]')?.addEventListener('click', () => openExternal(buyUrl));
  w.body.querySelector('[data-coin-dex]')?.addEventListener('click', () => openExternal(dexUrl));
  w.body.querySelector('[data-coin-x]')?.addEventListener('click', () => openExternal(xUrl));
}
