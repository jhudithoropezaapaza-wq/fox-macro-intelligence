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

// Almacén compartido: aquí guardamos valores ya calculados de otros bloques
// para que el Módulo 10 (indicadores compuestos) y el Módulo 14 (sesgos) los usen
// sin tener que volver a pedirlos a las APIs.
const FOX = {
  btcChange: null,
  ndxChange: null,
  vixChange: null,
  dxyChange: null,
  goldChange: null,
  yield10: null,
  yield2: null,
  walclPrev: null,
  walclCurr: null,
  fearGreed: null,
  fundingRate: null,
  longShortRatio: null,
  btcDominance: null,
  btcDominancePrev: null
};

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
  // Quita colores previos sin pisar la clase base (card-value, sesgo-value, etc.)
  el.classList.remove('value-up', 'value-down', 'value-neutral');
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
    FOX.btcChange = change;
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

    // Guardamos la dominancia actual y la comparamos con la del ciclo anterior (localStorage)
    const dominanceNow = data.data.market_cap_percentage.btc;
    FOX.btcDominance = dominanceNow;
    const dominancePrevStored = localStorage.getItem('fox_btc_dominance_prev');
    FOX.btcDominancePrev = dominancePrevStored !== null ? Number(dominancePrevStored) : dominanceNow;
    localStorage.setItem('fox_btc_dominance_prev', String(dominanceNow));

    // Mercado Cripto Amplio
    const mcapChange = data.data.market_cap_change_percentage_24h_usd;
    setText('mcap-change', (mcapChange >= 0 ? '+' : '') + mcapChange.toFixed(2) + '%');
    setValueColor('mcap-change', mcapChange);

    setText('volume-total', formatUSD(data.data.total_volume.usd));
  } catch (err) {
    setText('btc-dominance', 'No disponible');
    setText('market-cap-total', 'No disponible');
    setText('mcap-change', 'No disponible');
    setText('volume-total', 'No disponible');
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

    // Actualizar texto oculto (para el motor de sesgos)
    setText('fear-greed', value + ' / 100');
    FOX.fearGreed = value;

    // Etiqueta
    const labelEl = document.getElementById('fear-greed-label');
    if (labelEl) labelEl.textContent = label;

    // Color según valor
    let color;
    if (value >= 75) color = '#39D353';       // Extreme Greed
    else if (value >= 56) color = '#8BC34A';  // Greed
    else if (value >= 45) color = '#E3B341';  // Neutral
    else if (value >= 25) color = '#FF9800';  // Fear
    else color = '#FF6B6B';                   // Extreme Fear

    // Gauge: el arco total es ~251.2px (semicírculo)
    const totalArc = 251.2;
    const offset = totalArc - (value / 100) * totalArc;
    const arc = document.getElementById('fg-arc');
    if (arc) {
      arc.setAttribute('stroke', color);
      arc.setAttribute('stroke-dashoffset', offset.toString());
    }

    // Aguja: -90° (izq) a +90° (der), mapeado a 0-100
    const angle = -90 + (value / 100) * 180;
    const rad = (angle * Math.PI) / 180;
    const x2 = 100 + 62 * Math.sin(rad);
    const y2 = 100 - 62 * Math.cos(rad);
    const needle = document.getElementById('fg-needle');
    if (needle) {
      needle.setAttribute('x2', x2.toFixed(1));
      needle.setAttribute('y2', y2.toFixed(1));
      needle.setAttribute('stroke', color);
    }

    // Valor en el SVG
    const valText = document.getElementById('fg-value-text');
    if (valText) {
      valText.textContent = value;
      valText.setAttribute('fill', color);
    }
  } catch (err) {
    setText('fear-greed-label', 'No disponible');
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
    FOX.ndxChange = d.change;
  } catch (e) { setText('ndx', 'No disponible'); console.error('NDX:', e); }

  // VIX
  try {
    const d = await fetchYahoo('%5EVIX');
    setMacroCard('vix', 'vix-change', d.price, d.change, '', 2);
    FOX.vixChange = d.change;
  } catch (e) { setText('vix', 'No disponible'); console.error('VIX:', e); }

  // DXY
  try {
    const d = await fetchYahoo('DX-Y.NYB');
    setMacroCard('dxy', 'dxy-change', d.price, d.change, '', 3);
    FOX.dxyChange = d.change;
  } catch (e) { setText('dxy', 'No disponible'); console.error('DXY:', e); }

  // Oro
  try {
    const d = await fetchYahoo('GC%3DF');
    setMacroCard('gold', 'gold-change', d.price, d.change, '$', 2);
    FOX.goldChange = d.change;
  } catch (e) { setText('gold', 'No disponible'); console.error('Gold:', e); }

  // Petróleo WTI
  try {
    const d = await fetchYahoo('CL%3DF');
    setMacroCard('oil', 'oil-change', d.price, d.change, '$', 2);
  } catch (e) { setText('oil', 'No disponible'); console.error('Oil:', e); }

  // Coinbase (COIN)
  try {
    const d = await fetchYahoo('COIN');
    setMacroCard('coin-price', 'coin-change', d.price, d.change, '$', 2);
  } catch (e) { setText('coin-price', 'No disponible'); console.error('COIN:', e); }

  // Strategy / MicroStrategy (MSTR)
  try {
    const d = await fetchYahoo('MSTR');
    setMacroCard('mstr-price', 'mstr-change', d.price, d.change, '$', 2);
  } catch (e) { setText('mstr-price', 'No disponible'); console.error('MSTR:', e); }

  // NVIDIA (NVDA)
  try {
    const d = await fetchYahoo('NVDA');
    setMacroCard('nvda-price', 'nvda-change', d.price, d.change, '$', 2);
  } catch (e) { setText('nvda-price', 'No disponible'); console.error('NVDA:', e); }

  // Tesla (TSLA)
  try {
    const d = await fetchYahoo('TSLA');
    setMacroCard('tsla-price', 'tsla-change', d.price, d.change, '$', 2);
  } catch (e) { setText('tsla-price', 'No disponible'); console.error('TSLA:', e); }
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
    FOX.yield10 = y10;
    FOX.yield2 = y2;
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

// Devuelve los 2 valores más recientes de una serie, para comparar tendencia (actual vs anterior)
async function fetchFREDTrend(seriesId) {
  const targetUrl = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + seriesId +
    '&api_key=' + FRED_API_KEY + '&file_type=json&limit=2&sort_order=desc';
  const data = await fetchWithProxies(targetUrl);
  const [curr, prev] = data.observations;
  return { current: Number(curr.value), previous: Number(prev.value), date: curr.date };
}

async function loadLiquidezGlobal() {
  // Balance de la Fed (WALCL) - en millones de USD
  try {
    const r = await fetchFREDTrend('WALCL');
    setText('walcl', formatTrillions(r.current));
    setText('walcl-date', formatFREDDate(r.date));
    FOX.walclCurr = r.current;
    FOX.walclPrev = r.previous;
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

// ─── DERIVADOS BTC (cada 2 minutos) ───────────────────────────────────────

async function loadDerivados() {
  // Funding Rate (Binance)
  try {
    const res = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', 8000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const fundingRate = Number(data.lastFundingRate) * 100; // viene como fracción, ej. 0.0001146
    setText('funding-rate', fundingRate.toFixed(4) + '%');
    setValueColor('funding-rate', fundingRate);

    let label;
    if (fundingRate > 0.01) label = 'Longs pagan a shorts (sesgo alcista del mercado)';
    else if (fundingRate < -0.01) label = 'Shorts pagan a longs (sesgo bajista del mercado)';
    else label = 'Funding neutral';
    setText('funding-rate-label', label);
    FOX.fundingRate = fundingRate;

    // Premium Mark vs Index (mismo endpoint de Binance)
    const markPrice = Number(data.markPrice);
    const indexPrice = Number(data.indexPrice);
    const premiumPct = ((markPrice - indexPrice) / indexPrice) * 100;
    setText('premium-mark', premiumPct >= 0 ? '+' + premiumPct.toFixed(3) + '%' : premiumPct.toFixed(3) + '%');
    setValueColor('premium-mark', premiumPct);
  } catch (err) {
    setText('funding-rate', 'No disponible');
    setText('premium-mark', 'No disponible');
    console.error('Binance Derivados:', err);
  }

  // Open Interest (Deribit)
  try {
    const res = await fetchWithTimeout('https://www.deribit.com/api/v2/public/get_book_summary_by_instrument?instrument_name=BTC-PERPETUAL', 8000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const oi = data.result[0].open_interest;
    setText('open-interest', formatNum(oi, 0) + ' BTC');
  } catch (err) {
    setText('open-interest', 'No disponible');
    console.error('Deribit OI:', err);
  }

  // Long/Short Ratio (Binance Futures)
  try {
    const res = await fetchWithTimeout('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1', 8000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const latest = data[data.length - 1];

    const ratio = Number(latest.longShortRatio);
    const longAcc = Number(latest.longAccount) * 100;
    const shortAcc = Number(latest.shortAccount) * 100;

    setText('long-short-ratio', ratio.toFixed(2));
    setText('long-pct', longAcc.toFixed(1) + '%');
    setText('short-pct', shortAcc.toFixed(1) + '%');

    setValueColor('long-short-ratio', ratio - 1); // > 1 = más largos, < 1 = más cortos
    setValueColor('long-pct', longAcc - 50);
    setValueColor('short-pct', 50 - shortAcc);

    let label;
    if (ratio > 1.5) label = 'Mayoría apostando al alza (posible sobrecompra)';
    else if (ratio < 0.7) label = 'Mayoría apostando a la baja (posible sobreventa)';
    else label = 'Posicionamiento equilibrado';
    setText('long-short-label', label);
    FOX.longShortRatio = ratio;
  } catch (err) {
    setText('long-short-ratio', 'No disponible');
    setText('long-pct', 'No disponible');
    setText('short-pct', 'No disponible');
    console.error('Long/Short Ratio:', err);
  }
}

// ─── ON-CHAIN BTC / Blockchain.com (cada 15 minutos) ──────────────────────

function formatHashRate(ghs) {
  // Blockchain.info devuelve hash_rate en GH/s (giga hashes por segundo)
  const ehs = ghs / 1_000_000; // GH/s -> EH/s (exa hashes)
  return ehs.toFixed(1) + ' EH/s';
}

function formatDifficulty(diff) {
  const trillions = diff / 1_000_000_000_000;
  return trillions.toFixed(2) + ' T';
}

async function loadOnChain() {
  try {
    const targetUrl = 'https://api.blockchain.info/stats?format=json';
    const data = await fetchWithProxies(targetUrl);

    setText('hash-rate', formatHashRate(data.hash_rate));
    setText('difficulty', formatDifficulty(data.difficulty));
    setText('tx-count', formatNum(data.n_tx, 0));

    const blocksLeft = data.nextretarget - data.n_blocks_total;
    const minutesLeft = blocksLeft * (data.minutes_between_blocks || 10);
    const daysLeft = (minutesLeft / 60 / 24).toFixed(1);
    setText('next-retarget', blocksLeft + ' bloques');
    setText('next-retarget-sub', '≈ ' + daysLeft + ' días restantes');
  } catch (err) {
    setText('hash-rate', 'No disponible');
    setText('difficulty', 'No disponible');
    setText('tx-count', 'No disponible');
    setText('next-retarget', 'No disponible');
    console.error('On-Chain Blockchain.com:', err);
  }
}

async function loadTopCoins() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1&sparkline=false');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const cont = document.getElementById('top-coins-lista');
    cont.innerHTML = '';

    data.forEach(coin => {
      const change = coin.price_change_percentage_24h || 0;
      const item = document.createElement('div');
      item.className = 'lista-item';
      item.innerHTML =
        '<span class="nombre">' + coin.name + ' (' + coin.symbol.toUpperCase() + ')</span>' +
        '<span class="precio">' + formatUSD(coin.current_price, coin.current_price < 1 ? 4 : 2) + '</span>' +
        '<span class="cambio ' + (change >= 0 ? 'value-up' : 'value-down') + '">' +
          (change >= 0 ? '+' : '') + change.toFixed(2) + '%</span>';
      cont.appendChild(item);
    });
  } catch (err) {
    setText('top-coins-lista', 'No disponible');
    console.error('Top Coins:', err);
  }
}

function renderListaMonedas(containerId, items) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = '';
  items.forEach(item => {
    const change = Number(item.priceChangePercent);
    const price = Number(item.lastPrice);
    const div = document.createElement('div');
    div.className = 'lista-item';
    div.innerHTML =
      '<span class="nombre">' + item.symbol.replace('USDT', '') + '</span>' +
      '<span class="precio">' + formatUSD(price, price < 1 ? 6 : 2) + '</span>' +
      '<span class="cambio ' + (change >= 0 ? 'value-up' : 'value-down') + '">' +
        (change >= 0 ? '+' : '') + change.toFixed(2) + '%</span>';
    cont.appendChild(div);
  });
}

async function loadTopMoversBinance() {
  try {
    const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr', 10000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Filtrar solo pares USDT, con volumen significativo para evitar monedas ilíquidas
    const usdtPairs = data.filter(d =>
      d.symbol.endsWith('USDT') &&
      !d.symbol.includes('UPUSDT') &&
      !d.symbol.includes('DOWNUSDT') &&
      Number(d.quoteVolume) > 100000
    );

    const ordenadas = [...usdtPairs].sort((a, b) => Number(b.priceChangePercent) - Number(a.priceChangePercent));

    const subidas = ordenadas.slice(0, 30);
    const bajadas = ordenadas.slice(-30).reverse();

    renderListaMonedas('top-subidas-lista', subidas);
    renderListaMonedas('top-bajadas-lista', bajadas);
  } catch (err) {
    setText('top-subidas-lista', 'No disponible');
    setText('top-bajadas-lista', 'No disponible');
    console.error('Top Movers Binance:', err);
  }
}

// ─── INDICADORES COMPUESTOS (cálculo, sin API nueva) ──────────────────────

function calcularIndicadoresCompuestos() {
  // 1. Risk-On / Risk-Off
  // Si VIX sube + DXY sube + Oro sube => mercado defensivo (Risk-Off)
  // Si VIX baja + DXY baja + Oro baja => mercado de apetito por riesgo (Risk-On)
  if (FOX.vixChange !== null && FOX.dxyChange !== null && FOX.goldChange !== null) {
    const senales = [FOX.vixChange, FOX.dxyChange, FOX.goldChange];
    const positivas = senales.filter(s => s > 0).length;
    const negativas = senales.filter(s => s < 0).length;

    let texto, sub, colorRef;
    if (positivas >= 2) {
      texto = 'Risk-Off';
      sub = 'VIX/DXY/Oro al alza → mercado defensivo';
      colorRef = -1;
    } else if (negativas >= 2) {
      texto = 'Risk-On';
      sub = 'VIX/DXY/Oro a la baja → apetito por riesgo';
      colorRef = 1;
    } else {
      texto = 'Mixto';
      sub = 'Sin señal clara entre VIX, DXY y Oro';
      colorRef = 0;
    }
    setText('risk-indicator', texto);
    setText('risk-indicator-sub', sub);
    setValueColor('risk-indicator', colorRef);
  } else {
    setText('risk-indicator', 'No disponible');
  }

  // 2. BTC vs Nasdaq (correlación direccional del día)
  if (FOX.btcChange !== null && FOX.ndxChange !== null) {
    const mismaDireccion = (FOX.btcChange >= 0) === (FOX.ndxChange >= 0);
    let texto, sub, colorRef;
    if (mismaDireccion) {
      texto = 'Acoplado';
      sub = 'BTC y Nasdaq se mueven en la misma dirección hoy';
      colorRef = FOX.btcChange >= 0 ? 1 : -1;
    } else {
      texto = 'Desacoplado';
      sub = 'BTC y Nasdaq se mueven en direcciones opuestas hoy';
      colorRef = 0;
    }
    setText('btc-ndx-corr', texto);
    setText('btc-ndx-corr-sub', sub);
    setValueColor('btc-ndx-corr', colorRef);
  } else {
    setText('btc-ndx-corr', 'No disponible');
  }

  // 3. Liquidez Neta (tendencia)
  // Combina la tendencia del balance de la Fed (WALCL) con el spread 10-2
  if (FOX.walclCurr !== null && FOX.walclPrev !== null && FOX.yield10 !== null && FOX.yield2 !== null) {
    const walclTrend = FOX.walclCurr - FOX.walclPrev; // positivo = expansión, negativo = contracción
    const spread = FOX.yield10 - FOX.yield2;

    let texto, sub, colorRef;
    if (walclTrend > 0 && spread >= 0) {
      texto = 'Expansión';
      sub = 'Balance de la Fed creciendo + curva normal';
      colorRef = 1;
    } else if (walclTrend < 0 && spread < 0) {
      texto = 'Contracción';
      sub = 'Balance de la Fed cayendo + curva invertida';
      colorRef = -1;
    } else if (walclTrend > 0) {
      texto = 'Expansión leve';
      sub = 'Balance de la Fed creciendo, curva invertida';
      colorRef = 0;
    } else {
      texto = 'Contracción leve';
      sub = 'Balance de la Fed cayendo, curva normal';
      colorRef = 0;
    }
    setText('liquidez-neta', texto);
    setText('liquidez-neta-sub', sub);
    setValueColor('liquidez-neta', colorRef);
  } else {
    setText('liquidez-neta', 'No disponible');
  }
}

// ─── MOTOR DE SESGOS (Módulo 14) ───────────────────────────────────────────

// Convierte una puntuación numérica en texto + clase de color
function interpretarSesgo(score, etiquetas) {
  // etiquetas = { up: 'Alcista', down: 'Bajista', neutral: 'Neutral' }
  if (score > 0) return { texto: etiquetas.up, color: 1 };
  if (score < 0) return { texto: etiquetas.down, color: -1 };
  return { texto: etiquetas.neutral, color: 0 };
}

function calcularSesgos() {
  // ── Sesgo BTC Hoy ──────────────────────────────────────────────────────
  // Factores: Fear & Greed, Funding Rate, Long/Short Ratio, BTC vs Nasdaq (hoy)
  let scoreHoy = 0;
  let factoresHoy = [];

  if (FOX.fearGreed !== null) {
    if (FOX.fearGreed >= 56) { scoreHoy += 1; factoresHoy.push('F&G alto'); }
    else if (FOX.fearGreed <= 45) { scoreHoy -= 1; factoresHoy.push('F&G bajo'); }
    else { factoresHoy.push('F&G neutral'); }
  }

  if (FOX.fundingRate !== null) {
    if (FOX.fundingRate > 0.01) { scoreHoy += 1; factoresHoy.push('Funding +'); }
    else if (FOX.fundingRate < -0.01) { scoreHoy -= 1; factoresHoy.push('Funding -'); }
    else { factoresHoy.push('Funding neutral'); }
  }

  if (FOX.longShortRatio !== null) {
    if (FOX.longShortRatio > 1.5) { scoreHoy -= 1; factoresHoy.push('L/S sobrecompra'); } // contrarian
    else if (FOX.longShortRatio < 0.7) { scoreHoy += 1; factoresHoy.push('L/S sobreventa'); }
    else { factoresHoy.push('L/S equilibrado'); }
  }

  if (FOX.btcChange !== null && FOX.ndxChange !== null) {
    if (FOX.btcChange >= 0) { scoreHoy += 1; factoresHoy.push('BTC verde hoy'); }
    else { scoreHoy -= 1; factoresHoy.push('BTC rojo hoy'); }
  }

  const sesgoHoy = interpretarSesgo(scoreHoy, { up: 'Alcista', down: 'Bajista', neutral: 'Neutral' });
  setText('sesgo-hoy', sesgoHoy.texto);
  setText('sesgo-hoy-detalle', factoresHoy.join(' · '));
  setValueColor('sesgo-hoy', sesgoHoy.color);

  // ── Sesgo 1-5 Días ─────────────────────────────────────────────────────
  // Factores: Risk-On/Off, Spread 10-2, tendencia de Dominancia BTC
  let score5d = 0;
  let factores5d = [];

  if (FOX.vixChange !== null && FOX.dxyChange !== null && FOX.goldChange !== null) {
    const senales = [FOX.vixChange, FOX.dxyChange, FOX.goldChange];
    const positivas = senales.filter(s => s > 0).length;
    const negativas = senales.filter(s => s < 0).length;
    if (negativas >= 2) { score5d += 1; factores5d.push('Risk-On'); }
    else if (positivas >= 2) { score5d -= 1; factores5d.push('Risk-Off'); }
    else { factores5d.push('Risk mixto'); }
  }

  if (FOX.yield10 !== null && FOX.yield2 !== null) {
    const spread = FOX.yield10 - FOX.yield2;
    if (spread >= 0) { score5d += 1; factores5d.push('Curva normal'); }
    else { score5d -= 1; factores5d.push('Curva invertida'); }
  }

  if (FOX.btcDominance !== null && FOX.btcDominancePrev !== null) {
    const domDiff = FOX.btcDominance - FOX.btcDominancePrev;
    if (domDiff > 0.01) { factores5d.push('Dominancia ↑ (rotación hacia BTC)'); score5d += 1; }
    else if (domDiff < -0.01) { factores5d.push('Dominancia ↓ (rotación hacia altcoins)'); score5d -= 0; }
    else { factores5d.push('Dominancia estable'); }
  }

  const sesgoMedio = interpretarSesgo(score5d, { up: 'Alcista', down: 'Bajista', neutral: 'Neutral' });
  setText('sesgo-medio', sesgoMedio.texto);
  setText('sesgo-medio-detalle', factores5d.join(' · '));
  setValueColor('sesgo-medio', sesgoMedio.color);

  // ── Flujo de Liquidez ──────────────────────────────────────────────────
  // Factor: tendencia WALCL + spread 10-2 (reutiliza la misma lógica del indicador compuesto)
  let scoreLiq = 0;
  let factoresLiq = [];

  if (FOX.walclCurr !== null && FOX.walclPrev !== null) {
    const walclTrend = FOX.walclCurr - FOX.walclPrev;
    if (walclTrend > 0) { scoreLiq += 1; factoresLiq.push('Balance Fed ↑'); }
    else if (walclTrend < 0) { scoreLiq -= 1; factoresLiq.push('Balance Fed ↓'); }
    else { factoresLiq.push('Balance Fed estable'); }
  }

  if (FOX.yield10 !== null && FOX.yield2 !== null) {
    const spread = FOX.yield10 - FOX.yield2;
    if (spread >= 0) { scoreLiq += 1; factoresLiq.push('Curva normal'); }
    else { scoreLiq -= 1; factoresLiq.push('Curva invertida'); }
  }

  const sesgoLiquidez = interpretarSesgo(scoreLiq, {
    up: 'Liquidez expandiéndose',
    down: 'Liquidez contrayéndose',
    neutral: 'Liquidez estable'
  });
  setText('sesgo-liquidez', sesgoLiquidez.texto);
  setText('sesgo-liquidez-detalle', factoresLiq.join(' · '));
  setValueColor('sesgo-liquidez', sesgoLiquidez.color);
}

// ─── FILTRO MACRO → PHI ────────────────────────────────────────────────────

function calcularFiltroPHI() {
  let puntosLong = 0;
  let puntosShort = 0;

  // Factor 1: Risk-On / Risk-Off
  if (FOX.vixChange !== null && FOX.dxyChange !== null && FOX.goldChange !== null) {
    const senales = [FOX.vixChange, FOX.dxyChange, FOX.goldChange];
    const positivas = senales.filter(s => s > 0).length;
    const negativas = senales.filter(s => s < 0).length;
    if (negativas >= 2) {
      puntosLong++;
      setPhiFactor('phi-risk', 'Risk-On ✓', 'value-up');
    } else if (positivas >= 2) {
      puntosShort++;
      setPhiFactor('phi-risk', 'Risk-Off ✗', 'value-down');
    } else {
      setPhiFactor('phi-risk', 'Mixto', 'value-neutral');
    }
  }

  // Factor 2: Sesgo BTC Hoy (resultado del motor de sesgos)
  const sesgoHoyEl = document.getElementById('sesgo-hoy');
  if (sesgoHoyEl) {
    const seshoTexto = sesgoHoyEl.textContent;
    if (seshoTexto === 'Alcista') {
      puntosLong++;
      setPhiFactor('phi-sesgo-hoy', 'Alcista ✓', 'value-up');
    } else if (seshoTexto === 'Bajista') {
      puntosShort++;
      setPhiFactor('phi-sesgo-hoy', 'Bajista ✗', 'value-down');
    } else {
      setPhiFactor('phi-sesgo-hoy', 'Neutral', 'value-neutral');
    }
  }

  // Factor 3: Funding Rate
  if (FOX.fundingRate !== null) {
    if (FOX.fundingRate > 0.05) {
      puntosShort++;
      setPhiFactor('phi-funding', FOX.fundingRate.toFixed(4) + '% ⚠️', 'value-down');
    } else if (FOX.fundingRate > 0.01) {
      puntosLong++;
      setPhiFactor('phi-funding', FOX.fundingRate.toFixed(4) + '% ✓', 'value-up');
    } else if (FOX.fundingRate < -0.01) {
      puntosShort++;
      setPhiFactor('phi-funding', FOX.fundingRate.toFixed(4) + '% ✗', 'value-down');
    } else {
      setPhiFactor('phi-funding', FOX.fundingRate.toFixed(4) + '% ~', 'value-neutral');
    }
  }

  // Factor 4: Long/Short Ratio (contrarian: extremo = señal opuesta)
  if (FOX.longShortRatio !== null) {
    if (FOX.longShortRatio > 1.5) {
      puntosShort++;
      setPhiFactor('phi-ls', FOX.longShortRatio.toFixed(2) + ' ⚠️', 'value-down');
    } else if (FOX.longShortRatio < 0.7) {
      puntosLong++;
      setPhiFactor('phi-ls', FOX.longShortRatio.toFixed(2) + ' ⚠️', 'value-up');
    } else if (FOX.longShortRatio >= 1.0) {
      puntosLong += 0.5;
      setPhiFactor('phi-ls', FOX.longShortRatio.toFixed(2) + ' ~', 'value-neutral');
    } else {
      setPhiFactor('phi-ls', FOX.longShortRatio.toFixed(2) + ' ~', 'value-neutral');
    }
  }

  // Factor 5: Liquidez Global (WALCL tendencia + spread)
  if (FOX.walclCurr !== null && FOX.yield10 !== null) {
    const walclTrend = FOX.walclCurr - (FOX.walclPrev || FOX.walclCurr);
    const spread = FOX.yield10 - (FOX.yield2 || FOX.yield10);
    if (walclTrend > 0 && spread >= 0) {
      puntosLong++;
      setPhiFactor('phi-liquidez', 'Expansión ✓', 'value-up');
    } else if (walclTrend < 0 && spread < 0) {
      puntosShort++;
      setPhiFactor('phi-liquidez', 'Contracción ✗', 'value-down');
    } else {
      setPhiFactor('phi-liquidez', 'Mixta', 'value-neutral');
    }
  }

  // Veredicto final
  const total = puntosLong + puntosShort;
  const veredictoEl = document.getElementById('phi-veredicto');
  const notaEl = document.getElementById('phi-nota');

  veredictoEl.className = 'filtro-phi-veredicto';

  if (total === 0) {
    veredictoEl.textContent = 'Calculando...';
    return;
  }

  const dominanciaLong = puntosLong / (puntosLong + puntosShort + 0.001);

  if (dominanciaLong >= 0.7) {
    veredictoEl.textContent = '✅ MACRO FAVORABLE LONG';
    veredictoEl.classList.add('phi-long');
    notaEl.textContent = 'El contexto macro refuerza señales ALCISTAS del Panel PHI. ' + puntosLong.toFixed(0) + ' factores a favor / ' + puntosShort.toFixed(0) + ' en contra. Buscar entradas LONG cuando el Panel PHI confirme ALCISTA o BUY NOW.';
  } else if (dominanciaLong <= 0.3) {
    veredictoEl.textContent = '🔴 MACRO FAVORABLE SHORT';
    veredictoEl.classList.add('phi-short');
    notaEl.textContent = 'El contexto macro refuerza señales BAJISTAS del Panel PHI. ' + puntosShort.toFixed(0) + ' factores en contra / ' + puntosLong.toFixed(0) + ' a favor. Buscar entradas SHORT cuando el Panel PHI confirme BAJISTA o SELL NOW.';
  } else if (puntosLong > 0 && puntosShort > 0 && Math.abs(puntosLong - puntosShort) <= 1) {
    veredictoEl.textContent = '⚠️ MACRO CONTRADICTORIA';
    veredictoEl.classList.add('phi-peligro');
    notaEl.textContent = 'Los factores macro están divididos (' + puntosLong.toFixed(0) + ' Long / ' + puntosShort.toFixed(0) + ' Short). Precaución: aunque el Panel PHI habilite una entrada, el contexto macro no la refuerza. Reducir tamaño de posición o esperar mayor claridad.';
  } else {
    veredictoEl.textContent = '🟡 MACRO NEUTRAL';
    veredictoEl.classList.add('phi-neutro');
    notaEl.textContent = 'Sin señal macro dominante. Operar exclusivamente por el Panel PHI, sin sesgo adicional del contexto macro.';
  }
}

function setPhiFactor(id, texto, clase) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'phi-factor-valor ' + clase;
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────

async function initCripto() {
  await Promise.all([
    safeRun(loadBTCPrice, 'loadBTCPrice'),
    safeRun(loadCoinGeckoGlobal, 'loadCoinGeckoGlobal'),
    safeRun(loadFearGreed, 'loadFearGreed'),
    safeRun(loadDerivados, 'loadDerivados'),
    safeRun(loadTopCoins, 'loadTopCoins'),
    safeRun(loadTopMoversBinance, 'loadTopMoversBinance')
  ]);
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
    safeRun(loadLiquidezGlobal, 'loadLiquidezGlobal'),
    safeRun(loadOnChain, 'loadOnChain')
  ]);
}

async function init() {
  await Promise.all([initCripto(), initMacro()]);
  calcularIndicadoresCompuestos();
  calcularSesgos();
  calcularFiltroPHI();
}

// Primera carga
init();

// Cripto: actualiza cada 2 minutos
setInterval(async () => {
  await initCripto();
  calcularIndicadoresCompuestos();
  calcularSesgos();
  calcularFiltroPHI();
}, 2 * 60 * 1000);

// Macro USA: actualiza cada 15 minutos
setInterval(async () => {
  await initMacro();
  calcularIndicadoresCompuestos();
  calcularSesgos();
  calcularFiltroPHI();
}, 15 * 60 * 1000);
