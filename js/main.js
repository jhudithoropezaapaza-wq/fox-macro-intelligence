// FOX MACRO INTELLIGENCE - main.js
// Módulo 1B: CoinGecko (2 min) + Yahoo Finance via allorigins (15 min)

const PROXY = 'https://api.allorigins.win/raw?url=';

function formatUSD(num, decimals = 0) {
  return '$' + Number(num).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function formatNum(num, decimals = 2) {
  return Number(num).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setValueColor(valueId, change) {
  const el = document.getElementById(valueId);
  if (!el) return;
  el.className = 'card-value';
  if (change > 0) el.classList.add('value-up');
  else if (change < 0) el.classList.add('value-down');
  else el.classList.add('value-neutral');
}

function setUpdateTime() {
  const now = new Date();
  const formatted = now.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  setText('update-time', 'Última actualización: ' + formatted);
}

// ─── CRIPTO (cada 2 minutos) ───────────────────────────────────────────────

async function loadBTCPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const price = data.bitcoin.usd;
    const change = data.bitcoin.usd_24h_change;
    setText('btc-price', formatUSD(price));
    setText('btc-change', (change >= 0 ? '▲ +' : '▼ ') + change.toFixed(2) + '% (24h)');
    setValueColor('btc-price', change);
  } catch (err) {
    setText('btc-price', 'No disponible');
    console.error('BTC Price:', err);
  }
}

async function loadCoinGeckoGlobal() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    setText('btc-dominance', data.data.market_cap_percentage.btc.toFixed(2) + '%');
    setText('market-cap-total', formatUSD(data.data.total_market_cap.usd));
  } catch (err) {
    setText('btc-dominance', 'No disponible');
    setText('market-cap-total', 'No disponible');
    console.error('CoinGecko Global:', err);
  }
}

async function loadFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const value = Number(data.data[0].value);
    const label = data.data[0].value_classification;
    setText('fear-greed', value + ' / 100');
    setText('fear-greed-label', label);
    setValueColor('fear-greed', value >= 56 ? 1 : value <= 45 ? -1 : 0);
  } catch (err) {
    setText('fear-greed', 'No disponible');
    console.error('Fear & Greed:', err);
  }
}

// ─── MACRO USA (cada 15 minutos) ──────────────────────────────────────────

async function fetchYahoo(symbol) {
  const url = PROXY + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + symbol);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prev  = meta.chartPreviousClose;
  const change = ((price - prev) / prev) * 100;
  return { price, change };
}

function setMacroCard(valueId, changeId, price, change, prefix = '', decimals = 2) {
  setText(valueId, prefix + formatNum(price, decimals));
  setText(changeId, (change >= 0 ? '▲ +' : '▼ ') + change.toFixed(2) + '%');
  setValueColor(valueId, change);
}

async function loadMacroUSA() {
  // SPX
  try {
    const d = await fetchYahoo('%5EGSPC');
    setMacroCard('spx', 'spx-change', d.price, d.change, '', 2);
  } catch (e) { setText('spx', 'No disponible'); console.error('SPX:', e); }

  // NDX
  try {
    const d = await fetchYahoo('%5ENDX');
    setMacroCard('ndx', 'ndx-change', d.price, d.change, '', 2);
  } catch (e) { setText('ndx', 'No disponible'); console.error('NDX:', e); }

  // VIX
  try {
    const d = await fetchYahoo('%5EVIX');
    setMacroCard('vix', 'vix-change', d.price, d.change, '', 2);
  } catch (e) { setText('vix', 'No disponible'); console.error('VIX:', e); }

  // DXY
  try {
    const d = await fetchYahoo('DX-Y.NYB');
    setMacroCard('dxy', 'dxy-change', d.price, d.change, '', 3);
  } catch (e) { setText('dxy', 'No disponible'); console.error('DXY:', e); }

  // Oro
  try {
    const d = await fetchYahoo('GC%3DF');
    setMacroCard('gold', 'gold-change', d.price, d.change, '$', 2);
  } catch (e) { setText('gold', 'No disponible'); console.error('Gold:', e); }

  // Petróleo WTI
  try {
    const d = await fetchYahoo('CL%3DF');
    setMacroCard('oil', 'oil-change', d.price, d.change, '$', 2);
  } catch (e) { setText('oil', 'No disponible'); console.error('Oil:', e); }
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────

async function initCripto() {
  await Promise.all([loadBTCPrice(), loadCoinGeckoGlobal(), loadFearGreed()]);
  setUpdateTime();
}

async function initMacro() {
  await loadMacroUSA();
}

async function init() {
  await Promise.all([initCripto(), initMacro()]);
}

// Primera carga
init();

// Cripto: actualiza cada 2 minutos
setInterval(initCripto, 2 * 60 * 1000);

// Macro USA: actualiza cada 15 minutos
setInterval(initMacro, 15 * 60 * 1000);
