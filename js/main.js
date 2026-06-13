// FOX MACRO INTELLIGENCE - main.js
// Módulo 1A: Estructura base + datos de CoinGecko (precio BTC, dominancia, market cap, F&G)

function formatUSD(num) {
  return '$' + Number(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setUpdateTime() {
  const now = new Date();
  const formatted = now.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  setText('update-time', 'Última actualización: ' + formatted);
}

// --- Bloque: Precio BTC y Market Cap Global (CoinGecko) ---
async function loadCoinGeckoGlobal() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const btcDominance = data.data.market_cap_percentage.btc;
    const marketCapTotal = data.data.total_market_cap.usd;

    setText('btc-dominance', btcDominance.toFixed(2) + '%');
    setText('market-cap-total', formatUSD(marketCapTotal));
  } catch (err) {
    console.error('Error CoinGecko Global:', err);
    setText('btc-dominance', 'Dato no disponible');
    setText('market-cap-total', 'Dato no disponible');
  }
}

// --- Bloque: Precio BTC (CoinGecko) ---
async function loadBTCPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const price = data.bitcoin.usd;
    const change24h = data.bitcoin.usd_24h_change;

    const priceEl = document.getElementById('btc-price');
    priceEl.textContent = formatUSD(price) + '  (' + change24h.toFixed(2) + '%)';

    priceEl.className = 'card-value';
    if (change24h > 0) priceEl.classList.add('value-up');
    else if (change24h < 0) priceEl.classList.add('value-down');
    else priceEl.classList.add('value-neutral');
  } catch (err) {
    console.error('Error CoinGecko Price:', err);
    setText('btc-price', 'Dato no disponible');
  }
}

// --- Bloque: Fear & Greed Index (Alternative.me) ---
async function loadFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const value = data.data[0].value;
    const classification = data.data[0].value_classification;

    const valueEl = document.getElementById('fear-greed');
    valueEl.textContent = value + ' / 100';

    valueEl.className = 'card-value';
    const numValue = Number(value);
    if (numValue >= 56) valueEl.classList.add('value-up');
    else if (numValue <= 45) valueEl.classList.add('value-down');
    else valueEl.classList.add('value-neutral');

    setText('fear-greed-label', classification);
  } catch (err) {
    console.error('Error Fear & Greed:', err);
    setText('fear-greed', 'Dato no disponible');
  }
}

// --- Inicialización ---
async function init() {
  setUpdateTime();
  await Promise.all([
    loadBTCPrice(),
    loadCoinGeckoGlobal(),
    loadFearGreed()
  ]);
}

init();

// Actualización automática cada 5 minutos
setInterval(init, 5 * 60 * 1000);
