// FOX MACRO INTELLIGENCE - main.js
// Módulo 1B (v2): CoinGecko (2 min) + Yahoo Finance via proxy con respaldo (15 min)

// Lista de proxies CORS, en orden de preferencia. Si el primero falla, se intenta el siguiente.
const PROXIES = [
  url => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  url => 'https://corsproxy.io/?' + encodeURIComponent(url),
  url => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
];

// Clave gratuita de FRED (St. Louis Fed) - sección 3.6.1 del documento maestro
const FRED_API_KEY = 'b74441693f73743d9d5100933b7042d7';

// Clave gratuita de Finnhub - usada para el calendario económico
const FINNHUB_API_KEY = 'd8msqnpr01qp7ubne80gd8msqnpr01qp7ubne810';

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

// Hace un fetch con límite de tiempo. Si tarda más de `timeoutMs`, lo cancela y lanza error.
async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Intenta cada proxy de la lista en orden hasta que uno responda bien (con timeout de 8s cada uno).
async function fetchWithProxies(targetUrl) {
  let lastError;
  for (const buildProxyUrl of PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(targetUrl);
      const res = await fetchWithTimeout(proxyUrl, 8000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      // sigue con el siguiente proxy
    }
  }
  throw lastError || new Error('Todos los proxies fallaron');
}

async function fetchYahoo(symbol) {
  const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol;
  const data = await fetchWithProxies(targetUrl);
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

// ─── YIELDS USA / FRED (cada 15 minutos) ──────────────────────────────────

async function fetchFRED(seriesId) {
  const targetUrl = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + seriesId +
    '&api_key=' + FRED_API_KEY + '&file_type=json&limit=1&sort_order=desc';
  const data = await fetchWithProxies(targetUrl);
  const obs = data.observations[0];
  return Number(obs.value);
}

async function loadYields() {
  let y10 = null;
  let y2 = null;

  // DGS10
  try {
    y10 = await fetchFRED('DGS10');
    setText('yield10', y10.toFixed(2) + '%');
  } catch (e) { setText('yield10', 'No disponible'); console.error('DGS10:', e); }

  // DGS2
  try {
    y2 = await fetchFRED('DGS2');
    setText('yield2', y2.toFixed(2) + '%');
  } catch (e) { setText('yield2', 'No disponible'); console.error('DGS2:', e); }

  // Spread 10-2
  if (y10 !== null && y2 !== null) {
    const spread = y10 - y2;
    setText('spread102', (spread >= 0 ? '+' : '') + spread.toFixed(2) + ' pp');
    setValueColor('spread102', spread);
    setText('spread102-label', spread < 0 ? '⚠️ Curva invertida' : 'Curva normal');
  } else {
    setText('spread102', 'No disponible');
  }
}

// ─── LIQUIDEZ GLOBAL / FRED (cada 15 minutos) ─────────────────────────────

function formatTrillions(millions) {
  const trillions = millions / 1_000_000;
  return '$' + trillions.toFixed(2) + ' T';
}

function formatFREDDate(dateStr) {
  // dateStr viene como "2026-06-04"
  const [y, m, d] = dateStr.split('-');
  return 'Dato al ' + d + '/' + m + '/' + y;
}

async function fetchFREDLatest(seriesId) {
  const targetUrl = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + seriesId +
    '&api_key=' + FRED_API_KEY + '&file_type=json&limit=1&sort_order=desc';
  const data = await fetchWithProxies(targetUrl);
  const obs = data.observations[0];
  return { value: Number(obs.value), date: obs.date };
}

async function loadLiquidezGlobal() {
  // Balance de la Fed (WALCL) - en millones de USD
  try {
    const r = await fetchFREDLatest('WALCL');
    setText('walcl', formatTrillions(r.value));
    setText('walcl-date', formatFREDDate(r.date));
  } catch (e) { setText('walcl', 'No disponible'); console.error('WALCL:', e); }

  // M2 - en miles de millones de USD (Billions) -> convertir a Trillions dividiendo entre 1000
  try {
    const r = await fetchFREDLatest('M2SL');
    const trillions = r.value / 1000;
    setText('m2', '$' + trillions.toFixed(2) + ' T');
    setText('m2-date', formatFREDDate(r.date));
  } catch (e) { setText('m2', 'No disponible'); console.error('M2SL:', e); }

  // Reservas Bancarias (WRESBAL) - en millones de USD
  try {
    const r = await fetchFREDLatest('WRESBAL');
    setText('wresbal', formatTrillions(r.value));
    setText('wresbal-date', formatFREDDate(r.date));
  } catch (e) { setText('wresbal', 'No disponible'); console.error('WRESBAL:', e); }
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────

async function initCripto() {
  await Promise.all([loadBTCPrice(), loadCoinGeckoGlobal(), loadFearGreed()]);
  setUpdateTime();
}

// Ejecuta una función async y, si falla por completo (error no capturado internamente),
// lo registra en consola pero no detiene las demás tareas en paralelo.
async function safeRun(fn, label) {
  try {
    await fn();
  } catch (err) {
    console.error('Fallo no controlado en ' + label + ':', err);
  }
}

async function initMacro() {
  await Promise.all([
    safeRun(loadMacroUSA, 'loadMacroUSA'),
    safeRun(loadYields, 'loadYields'),
    safeRun(loadLiquidezGlobal, 'loadLiquidezGlobal')
  ]);
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
