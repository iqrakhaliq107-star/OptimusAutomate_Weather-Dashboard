// ============================================================
// CONFIG
// ============================================================
const API_KEY = '83b3e961a11df61462dd254454fa7bb5';
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const CACHE_KEY = 'nimbus_cache';
const CACHE_TIME_KEY = 'nimbus_cache_time';
const CACHE_DURATION = 30 * 60 * 1000;

// ============================================================
// STATE
// ============================================================
const state = {
  unit: 'metric',
  city: '',
  favorites: JSON.parse(localStorage.getItem('nimbus_favorites') || '[]'),
  recent: JSON.parse(localStorage.getItem('nimbus_recent') || '[]'),
  currentData: null,
  forecastData: null,
  isOffline: false,
  hourlyChart: null,
  dailyChart: null,
  particles: null,
  particleType: 'none',
};

// ============================================================
// DOM REFS
// ============================================================
const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const locateBtn = $('locateBtn');
const unitToggle = $('unitToggle');
const unitLabel = $('unitLabel');
const refreshBtn = $('refreshBtn');
const messageContainer = $('messageContainer');
const offlineBanner = $('offlineBanner');
const cityName = $('cityName');
const countryName = $('countryName');
const weatherIcon = $('weatherIcon');
const tempDisplay = $('tempDisplay');
const tempUnit = $('tempUnit');
const conditionText = $('conditionText');
const humidity = $('humidity');
const wind = $('wind');
const pressure = $('pressure');
const visibility = $('visibility');
const feelslike = $('feelslike');
const uvIndex = $('uvIndex');
const highTemp = $('highTemp');
const lowTemp = $('lowTemp');
const avgTemp = $('avgTemp');
const humidityAvg = $('humidityAvg');
const aqiValue = $('aqiValue');
const aqiStatus = $('aqiStatus');
const aqiDetail = $('aqiDetail');
const sunriseTime = $('sunriseTime');
const sunsetTime = $('sunsetTime');
const dayLength = $('dayLength');
const sunIcon = $('sunIcon');
const moonIcon = $('moonIcon');
const dayIcon = $('dayIcon');
const hourlyContainer = $('hourlyContainer');
const dailyContainer = $('dailyContainer');
const favoritesContainer = $('favoritesContainer');
const recentContainer = $('recentContainer');
const shareBtn = $('shareBtn');
const clearFavoritesBtn = $('clearFavoritesBtn');
const clearRecentBtn = $('clearRecentBtn');
const cacheStatus = $('cacheStatus');
const glowRing = $('glowRing');
const compassArrow = $('compassArrow');
const windSpeedLabel = $('windSpeedLabel');
const windDirLabel = $('windDirLabel');
const gradientOverlay = $('gradientOverlay');
const particleCanvas = $('particleCanvas');
const hourlyChartCanvas = $('hourlyChart');
const dailyChartCanvas = $('dailyChart');

// ============================================================
// STORAGE
// ============================================================
function saveState() {
  localStorage.setItem('nimbus_favorites', JSON.stringify(state.favorites));
  localStorage.setItem('nimbus_recent', JSON.stringify(state.recent));
  localStorage.setItem('nimbus_unit', state.unit);
}

function loadUnit() {
  const u = localStorage.getItem('nimbus_unit');
  if (u) state.unit = u;
  unitLabel.textContent = state.unit === 'metric' ? '°C' : '°F';
}

// ============================================================
// CACHE
// ============================================================
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  } catch (e) {}
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const time = localStorage.getItem(CACHE_TIME_KEY);
    if (!raw || !time) return null;
    if (Date.now() - parseInt(time) > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIME_KEY);
      return null;
    }
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function hasCache() { return !!localStorage.getItem(CACHE_KEY); }

// ============================================================
// OFFLINE
// ============================================================
function updateOfflineStatus() {
  state.isOffline = !navigator.onLine;
  offlineBanner.classList.toggle('show', state.isOffline);
  if (state.isOffline) showMessage('Offline – showing cached data', 'info');
  updateCacheStatus();
}
window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);

function updateCacheStatus() {
  cacheStatus.textContent = hasCache() ? '💾 Cached' : '';
}

// ============================================================
// MESSAGES
// ============================================================
function showMessage(text, type = 'info', duration = 5000) {
  const existing = messageContainer.querySelector('.message-box');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `message-box ${type}`;
  const icons = { error: 'fa-circle-exclamation', success: 'fa-circle-check', info: 'fa-circle-info' };
  div.innerHTML = `
    <i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i>
    <span>${text}</span>
    <span class="close-msg" role="button" tabindex="0" aria-label="Close">&times;</span>
  `;
  messageContainer.appendChild(div);
  div.querySelector('.close-msg').addEventListener('click', () => div.remove());
  if (duration > 0) setTimeout(() => { if (div.parentNode) div.remove(); }, duration);
}

// ============================================================
// PARTICLES (Rain / Snow)
// ============================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.type = 'none';
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start(type) {
    if (this.type === type && this.running) return;
    this.type = type;
    this.particles = [];
    this.running = true;
    const count = type === 'rain' ? 120 : type === 'snow' ? 80 : 0;
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
    if (count > 0) this.animate();
    else {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  createParticle() {
    const isRain = this.type === 'rain';
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height - this.canvas.height,
      speed: isRain ? 6 + Math.random() * 10 : 1 + Math.random() * 2.5,
      length: isRain ? 12 + Math.random() * 18 : 4 + Math.random() * 6,
      width: isRain ? 1.2 : 3 + Math.random() * 4,
      opacity: isRain ? 0.3 + Math.random() * 0.3 : 0.4 + Math.random() * 0.4,
      wobble: isRain ? 0 : Math.random() * 2 - 1,
      wobbleSpeed: isRain ? 0 : 0.01 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
    };
  }

  animate() {
    if (!this.running) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const isRain = this.type === 'rain';
    const isSnow = this.type === 'snow';

    for (const p of this.particles) {
      p.y += p.speed;
      if (isSnow) {
        p.x += Math.sin(p.phase) * 0.6;
        p.phase += p.wobbleSpeed;
      }
      if (p.y > H + 20) {
        p.y = -20;
        p.x = Math.random() * W;
        if (isSnow) p.x = Math.random() * W;
      }
      if (isSnow && (p.x < -10 || p.x > W + 10)) {
        p.x = Math.random() * W;
        p.y = -10;
      }

      ctx.beginPath();
      if (isRain) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y + p.length);
        ctx.strokeStyle = `rgba(180, 210, 255, ${p.opacity})`;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        ctx.arc(p.x, p.y, p.width * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(() => this.animate());
  }

  stop() {
    this.running = false;
    this.type = 'none';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = [];
  }

  setType(type) {
    if (type === 'none') { this.stop(); return; }
    this.start(type);
  }
}

// Init particles
const particles = new ParticleSystem(particleCanvas);

// ============================================================
// DYNAMIC THEME
// ============================================================
const weatherThemes = {
  sunny: { bgStart: '#0EA5E9', bgEnd: '#4F46E5', accent: '#FBBF24', particles: 'none' },
  cloudy: { bgStart: '#475569', bgEnd: '#1E293B', accent: '#94A3B8', particles: 'none' },
  rainy: { bgStart: '#1E3A5F', bgEnd: '#0F172A', accent: '#38BDF8', particles: 'rain' },
  stormy: { bgStart: '#1E1B4B', bgEnd: '#0F0A2A', accent: '#6366F1', particles: 'rain' },
  snowy: { bgStart: '#64748B', bgEnd: '#1E293B', accent: '#93C5FD', particles: 'snow' },
  misty: { bgStart: '#334155', bgEnd: '#0F172A', accent: '#94A3B8', particles: 'none' },
  night: { bgStart: '#0F0A2A', bgEnd: '#050510', accent: '#60A5FA', particles: 'none' },
};

function detectWeatherTheme(iconCode) {
  const code = iconCode.substring(0, 2);
  const isDay = iconCode.endsWith('d');
  if (!isDay) return 'night';
  if (code === '01') return 'sunny';
  if (code === '02' || code === '03' || code === '04') return 'cloudy';
  if (code === '09' || code === '10') return 'rainy';
  if (code === '11') return 'stormy';
  if (code === '13') return 'snowy';
  if (code === '50') return 'misty';
  return 'sunny';
}

function applyTheme(themeKey) {
  const theme = weatherThemes[themeKey] || weatherThemes.sunny;
  const root = document.documentElement;
  root.style.setProperty('--dynamic-bg-start', theme.bgStart);
  root.style.setProperty('--dynamic-bg-end', theme.bgEnd);
  root.style.setProperty('--dynamic-accent', theme.accent);
  gradientOverlay.style.background = `linear-gradient(145deg, ${theme.bgStart}, ${theme.bgEnd})`;
  gradientOverlay.style.opacity = '0.25';

  // Update accent glow
  const accentGlow = `rgba(251, 191, 36, 0.20)`;
  if (themeKey === 'sunny') {
    glowRing.style.background = `radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)`;
  } else if (themeKey === 'rainy' || themeKey === 'stormy') {
    glowRing.style.background = `radial-gradient(circle, rgba(56,189,248,0.20) 0%, transparent 70%)`;
  } else if (themeKey === 'snowy') {
    glowRing.style.background = `radial-gradient(circle, rgba(147,197,253,0.20) 0%, transparent 70%)`;
  } else {
    glowRing.style.background = `radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)`;
  }

  // Particles
  particles.setType(theme.particles);
  state.particleType = theme.particles;

  // Update compass arrow color
  const arrowPoly = compassArrow.querySelector('polygon');
  if (arrowPoly) arrowPoly.setAttribute('fill', theme.accent);
}

// ============================================================
// ICON HELPERS
// ============================================================
function getEmojiFromIcon(icon) {
  const map = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅',
    '02n': '☁️',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌧️',
    '10n': '🌧️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '❄️',
    '13n': '❄️',
    '50d': '🌫️',
    '50n': '🌫️',
  };
  return map[icon] || '☀️';
}

function getIconClass(icon) {
  const code = icon.substring(0, 2);
  if (code === '01') return 'sunny';
  if (code === '09' || code === '10') return 'rainy';
  if (code === '11') return 'thunder';
  return '';
}

// ============================================================
// ANIMATED TEMPERATURE COUNTER
// ============================================================
function animateNumber(element, target, suffix = '', duration = 800) {
  const current = parseFloat(element.textContent) || 0;
  const diff = target - current;
  if (Math.abs(diff) < 0.1) { element.textContent = Math.round(target) + suffix; return; }
  const start = performance.now();
  const startVal = current;
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = startVal + diff * eased;
    element.textContent = Math.round(val) + suffix;
    if (progress < 1) requestAnimationFrame(update);
    else element.textContent = Math.round(target) + suffix;
  }
  requestAnimationFrame(update);
}

// ============================================================
// COMPASS
// ============================================================
function updateCompass(degrees, speed, unit) {
  const arrow = compassArrow;
  arrow.setAttribute('transform', `rotate(${degrees}, 50, 50)`);
  const speedKmh = unit === 'metric' ? speed * 3.6 : speed;
  windSpeedLabel.textContent = `${Math.round(speedKmh)} ${unit === 'metric' ? 'km/h' : 'mph'}`;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((degrees % 360) / 45)) % 8;
  windDirLabel.textContent = dirs[idx] || '--';
}

// ============================================================
// SUN / MOON
// ============================================================
function updateSunMoon(sunrise, sunset) {
  const rise = new Date(sunrise * 1000);
  const set = new Date(sunset * 1000);
  sunriseTime.textContent = rise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  sunsetTime.textContent = set.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = set - rise;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  dayLength.textContent = `${hours}h ${mins}m`;

  const now = new Date();
  const isDay = now > rise && now < set;
  sunIcon.textContent = isDay ? '🌅' : '🌆';
  moonIcon.textContent = isDay ? '🌇' : '🌃';
  dayIcon.textContent = isDay ? '☀️' : '🌙';
  if (isDay) {
    dayIcon.style.animation = 'sunSpin 12s linear infinite';
  } else {
    dayIcon.style.animation = 'none';
  }
}

// ============================================================
// AGGREGATE DAILY
// ============================================================
function aggregateDaily(list) {
  const days = {};
  list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const key = date.toDateString();
    if (!days[key]) {
      days[key] = { dt: item.dt, temps: [], icons: [], descs: [] };
    }
    days[key].temps.push(item.main.temp);
    days[key].icons.push(item.weather[0].icon);
    days[key].descs.push(item.weather[0].description);
  });
  return Object.keys(days).slice(0, 5).map(key => {
    const d = days[key];
    return {
      dt: d.dt,
      min: Math.min(...d.temps),
      max: Math.max(...d.temps),
      icon: d.icons[Math.floor(d.icons.length / 2)],
      desc: d.descs[0],
    };
  });
}

// ============================================================
// CHARTS
// ============================================================
let hourlyChartInstance = null;
let dailyChartInstance = null;

function renderHourlyChart(hours, unit) {
  const ctx = hourlyChartCanvas.getContext('2d');
  if (hourlyChartInstance) { hourlyChartInstance.destroy();
    hourlyChartInstance = null; }
  if (!hours || hours.length === 0) return;

  const labels = hours.map((h, i) => i === 0 ? 'Now' : new Date(h.dt * 1000).getHours() + ':00');
  const temps = hours.map(h => Math.round(h.main.temp));

  hourlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Temperature',
        data: temps,
        borderColor: 'rgba(56, 189, 248, 0.9)',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(56, 189, 248, 0.8)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y}°${unit === 'metric' ? 'C' : 'F'}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 9 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 9 },
            callback: (val) => `${val}°`
          },
          beginAtZero: false,
        }
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
    }
  });
}

function renderDailyChart(daily, unit) {
  const ctx = dailyChartCanvas.getContext('2d');
  if (dailyChartInstance) { dailyChartInstance.destroy();
    dailyChartInstance = null; }
  if (!daily || daily.length === 0) return;

  const labels = daily.map(d => new Date(d.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }));
  const highs = daily.map(d => Math.round(d.max));
  const lows = daily.map(d => Math.round(d.min));

  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'High',
        data: highs,
        backgroundColor: 'rgba(251, 191, 36, 0.25)',
        borderColor: 'rgba(251, 191, 36, 0.7)',
        borderWidth: 2,
        borderRadius: 4,
      }, {
        label: 'Low',
        data: lows,
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderColor: 'rgba(56, 189, 248, 0.5)',
        borderWidth: 2,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255,255,255,0.5)',
            font: { size: 10 },
            boxWidth: 12,
            padding: 8,
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}°${unit === 'metric' ? 'C' : 'F'}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 9 },
            callback: (val) => `${val}°`
          },
          beginAtZero: false,
        }
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
    }
  });
}

// ============================================================
// DETECT COORDINATES
// ============================================================
function isCoordinates(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  // Match pattern: number, number (lat, lon)
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(trimmed);
}

// ============================================================
// FETCH WEATHER (FIXED for coordinates)
// ============================================================
async function fetchWeatherData(input) {
  if (!input) return;
  const trimmed = input.trim();
  const isCoord = isCoordinates(trimmed);

  try {
    let currentUrl, forecastUrl;
    const unitParam = state.unit === 'metric' ? 'metric' : 'imperial';

    if (isCoord) {
      const parts = trimmed.split(',').map(s => s.trim());
      const lat = parts[0];
      const lon = parts[1];
      currentUrl =
        `${OWM_BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unitParam}`;
      forecastUrl =
        `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unitParam}`;
    } else {
      const encoded = encodeURIComponent(trimmed);
      currentUrl =
        `${OWM_BASE}/weather?q=${encoded}&appid=${API_KEY}&units=${unitParam}`;
      forecastUrl =
        `${OWM_BASE}/forecast?q=${encoded}&appid=${API_KEY}&units=${unitParam}`;
    }

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl)
    ]);

    if (!currentRes.ok) {
      if (currentRes.status === 404) throw new Error('City not found');
      if (currentRes.status === 401) throw new Error('Invalid API key');
      throw new Error('Network error');
    }
    const currentData = await currentRes.json();

    if (!forecastRes.ok) throw new Error('Forecast unavailable');
    const forecastData = await forecastRes.json();

    const { lat, lon } = currentData.coord;
    let aqi = null;
    try {
      const aqiRes = await fetch(
        `${OWM_BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
      if (aqiRes.ok) aqi = await aqiRes.json();
    } catch (e) {}

    const combined = {
      current: currentData,
      forecast: forecastData,
      aqi: aqi,
      location: currentData.name,
      country: currentData.sys.country,
      sunrise: currentData.sys.sunrise,
      sunset: currentData.sys.sunset,
    };
    saveCache(combined);
    return combined;

  } catch (err) {
    const cached = getCache();
    if (cached && cached.location) {
      showMessage(`Using cached data for ${cached.location}`, 'info');
      return cached;
    }
    throw err;
  }
}

// ============================================================
// SEARCH & LOCATION
// ============================================================
async function searchWeather(city) {
  if (!city || city.trim() === '') { showMessage('Enter a city name', 'error'); return; }
  try {
    showLoading(true);
    const data = await fetchWeatherData(city);
    renderWeather(data);
    showLoading(false);
    const err = document.querySelector('.message-box.error');
    if (err) err.remove();
  } catch (err) {
    showLoading(false);
    showMessage(`Error: ${err.message}`, 'error', 6000);
  }
}

function useLocation() {
  if (!navigator.geolocation) {
    showMessage('Geolocation is not supported by your browser.', 'error');
    return;
  }
  showMessage('Fetching your location…', 'info', 3000);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      // Format coordinates with proper decimal precision
      const coordStr = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      try {
        showLoading(true);
        const data = await fetchWeatherData(coordStr);
        renderWeather(data);
        showLoading(false);
      } catch (err) {
        showLoading(false);
        showMessage(`Error: ${err.message}`, 'error');
      }
    },
    (err) => {
      console.warn('Geolocation error:', err);
      let msg = 'Unable to get your location. ';
      if (err.code === 1) msg += 'Please allow location access and try again.';
      else if (err.code === 2) msg += 'Location unavailable. Please search manually.';
      else msg += 'Please search manually.';
      showMessage(msg, 'error', 5000);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

// ============================================================
// RENDER WEATHER
// ============================================================
function renderWeather(data) {
  if (!data || !data.current) return;
  state.currentData = data;
  const current = data.current;
  const loc = data.location || current.name;
  const unit = state.unit;

  // Theme
  const iconCode = current.weather[0].icon;
  const theme = detectWeatherTheme(iconCode);
  applyTheme(theme);

  // Main
  cityName.textContent = loc;
  countryName.textContent = data.country || '';
  const temp = current.main.temp;
  animateNumber(tempDisplay, temp, '');
  tempUnit.textContent = `°${unit === 'metric' ? 'C' : 'F'}`;
  conditionText.textContent = current.weather[0].description;
  const emoji = getEmojiFromIcon(iconCode);
  weatherIcon.textContent = emoji;
  weatherIcon.className = 'icon-wrap ' + getIconClass(iconCode);

  // Details
  humidity.textContent = `${current.main.humidity}%`;
  const windSpeed = unit === 'metric' ? current.wind.speed * 3.6 : current.wind.speed;
  wind.textContent = `${Math.round(windSpeed)} ${unit === 'metric' ? 'km/h' : 'mph'}`;
  pressure.textContent = `${current.main.pressure} hPa`;
  const vis = unit === 'metric' ? current.visibility / 1000 : current.visibility / 1609;
  visibility.textContent = `${vis.toFixed(1)} ${unit === 'metric' ? 'km' : 'mi'}`;
  const feels = current.main.feels_like;
  feelslike.textContent = `${Math.round(feels)}°${unit === 'metric' ? 'C' : 'F'}`;
  uvIndex.textContent = '--';

  // Stats
  if (data.forecast && data.forecast.list) {
    const today = data.forecast.list.filter(f => {
      const d = new Date(f.dt * 1000);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    });
    if (today.length > 0) {
      const temps = today.map(f => f.main.temp);
      const max = Math.max(...temps);
      const min = Math.min(...temps);
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      highTemp.textContent = `${Math.round(max)}°`;
      lowTemp.textContent = `${Math.round(min)}°`;
      avgTemp.textContent = `${Math.round(avg)}°`;
      const hums = today.map(f => f.main.humidity);
      humidityAvg.textContent = `${Math.round(hums.reduce((a,b)=>a+b,0)/hums.length)}%`;
    }
  }

  // AQI
  if (data.aqi && data.aqi.list && data.aqi.list.length > 0) {
    const aqi = data.aqi.list[0];
    const idx = aqi.main.aqi;
    aqiValue.textContent = idx;
    const statuses = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    aqiStatus.textContent = statuses[idx - 1] || '--';
    aqiDetail.textContent = aqi.components.pm2_5 ? `PM2.5: ${aqi.components.pm2_5.toFixed(1)}` : '';
    const colors = ['#22c55e', '#eab308', '#f59e0b', '#ef4444', '#7f1d1d'];
    aqiStatus.style.background = colors[idx - 1] || 'rgba(255,255,255,0.06)';
    aqiStatus.style.color = '#fff';
  } else {
    aqiValue.textContent = '--';
    aqiStatus.textContent = 'No data';
    aqiDetail.textContent = '';
    aqiStatus.style.background = 'rgba(255,255,255,0.06)';
    aqiStatus.style.color = 'var(--text-muted)';
  }

  // Sun/Moon
  updateSunMoon(data.sunrise, data.sunset);

  // Compass
  if (current.wind && current.wind.deg !== undefined) {
    updateCompass(current.wind.deg, current.wind.speed, unit);
  }

  // Hourly
  if (data.forecast && data.forecast.list) {
    const hours = data.forecast.list.slice(0, 24);
    renderHourly(hours, unit);
    renderHourlyChart(hours, unit);
  }

  // Daily
  if (data.forecast && data.forecast.list) {
    const daily = aggregateDaily(data.forecast.list);
    renderDaily(daily, unit);
    renderDailyChart(daily, unit);
  }

  state.city = loc;
  saveState();
  addRecent(loc);
  renderFavorites();
  renderRecent();
  updateCacheStatus();

  // Re-trigger fade
  document.querySelectorAll('.glass').forEach(el => {
    el.classList.remove('fade-in');
    void el.offsetWidth;
    el.classList.add('fade-in');
  });
}

// ============================================================
// RENDER HOURLY / DAILY
// ============================================================
function renderHourly(hours) {
  if (!hours || hours.length === 0) { hourlyContainer.innerHTML =
    '<span class="text-muted">No data</span>'; return; }
  let html = '';
  hours.forEach((h, i) => {
    const time = new Date(h.dt * 1000);
    const label = i === 0 ? 'Now' : time.getHours() + ':00';
    const icon = getEmojiFromIcon(h.weather[0].icon);
    const temp = Math.round(h.main.temp);
    const unit = state.unit === 'metric' ? 'C' : 'F';
    html += `
      <div class="hourly-item" role="listitem">
        <div class="hour">${label}</div>
        <div class="icon">${icon}</div>
        <div class="temp">${temp}°${unit}</div>
      </div>
    `;
  });
  hourlyContainer.innerHTML = html;
}

function renderDaily(daily) {
  if (!daily || daily.length === 0) { dailyContainer.innerHTML =
    '<span class="text-muted">No data</span>'; return; }
  let html = '';
  daily.forEach(d => {
    const date = new Date(d.dt * 1000);
    const label = date.toLocaleDateString('en-US', { weekday: 'short' });
    const icon = getEmojiFromIcon(d.icon);
    const unit = state.unit === 'metric' ? 'C' : 'F';
    html += `
      <div class="daily-item" role="listitem">
        <div class="day">${label}</div>
        <div class="icon">${icon}</div>
        <div class="temps"><span class="high">${Math.round(d.max)}°</span><span class="low">${Math.round(d.min)}°</span></div>
        <div class="cond">${d.desc}</div>
      </div>
    `;
  });
  dailyContainer.innerHTML = html;
}

// ============================================================
// FAVORITES / RECENT
// ============================================================
function renderFavorites() {
  if (state.favorites.length === 0) {
    favoritesContainer.innerHTML =
      '<span class="text-muted" style="font-size:0.8rem;">Double‑click a city name to add</span>';
    return;
  }
  let html = '';
  state.favorites.forEach(city => {
    html += `
      <span class="chip" data-city="${city}" role="listitem" tabindex="0">
        <i class="fas fa-star" style="color:var(--color-accent);" aria-hidden="true"></i>
        ${city}
        <span class="remove" data-remove="${city}" role="button" tabindex="0" aria-label="Remove ${city}">&times;</span>
      </span>
    `;
  });
  favoritesContainer.innerHTML = html;
  favoritesContainer.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) return;
      const city = chip.dataset.city;
      if (city) searchWeather(city);
    });
    const rm = chip.querySelector('.remove');
    if (rm) rm.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(rm.dataset.remove);
    });
  });
}

function renderRecent() {
  if (state.recent.length === 0) {
    recentContainer.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">No recent searches</span>';
    return;
  }
  let html = '';
  state.recent.forEach(city => {
    html += `
      <span class="chip" data-city="${city}" role="listitem" tabindex="0">
        <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
        ${city}
      </span>
    `;
  });
  recentContainer.innerHTML = html;
  recentContainer.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const city = chip.dataset.city;
      if (city) searchWeather(city);
    });
  });
}

function addFavorite(city) {
  if (!city || state.favorites.includes(city)) return;
  state.favorites.push(city);
  saveState();
  renderFavorites();
  showMessage(`${city} added to favorites`, 'success', 2000);
}

function removeFavorite(city) {
  state.favorites = state.favorites.filter(c => c !== city);
  saveState();
  renderFavorites();
  showMessage(`${city} removed`, 'info', 1500);
}

function addRecent(city) {
  if (!city) return;
  state.recent = state.recent.filter(c => c !== city);
  state.recent.unshift(city);
  if (state.recent.length > 10) state.recent.pop();
  saveState();
  renderRecent();
}

function clearFavorites() {
  if (state.favorites.length === 0) { showMessage('No favorites', 'info', 1500); return; }
  if (confirm('Clear all favorites?')) {
    state.favorites = [];
    saveState();
    renderFavorites();
    showMessage('Favorites cleared', 'info', 1500);
  }
}

function clearRecent() {
  if (state.recent.length === 0) { showMessage('No recent searches', 'info', 1500); return; }
  state.recent = [];
  saveState();
  renderRecent();
  showMessage('Recent cleared', 'info', 1500);
}

// ============================================================
// TOGGLES
// ============================================================
function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  unitLabel.textContent = state.unit === 'metric' ? '°C' : '°F';
  saveState();
  if (state.currentData) searchWeather(state.city);
  showMessage(`Switched to ${state.unit === 'metric' ? 'Celsius' : 'Fahrenheit'}`, 'info', 1500);
}

// ============================================================
// SHARE
// ============================================================
function shareWeather() {
  if (!state.currentData) { showMessage('No data to share', 'error'); return; }
  const loc = state.currentData.location || state.city;
  const cur = state.currentData.current;
  const temp = cur.main.temp;
  const text =
    `🌤️ ${loc}: ${Math.round(temp)}°${state.unit === 'metric' ? 'C' : 'F'}, ${cur.weather[0].description} • Humidity: ${cur.main.humidity}%`;
  if (navigator.share) { navigator.share({ title: 'Nimbus Weather', text }).catch(() => {}); } else {
    navigator.clipboard.writeText(text).then(() => showMessage('Copied!', 'success', 2000))
      .catch(() => prompt('Copy:', text));
  }
}

// ============================================================
// LOADING
// ============================================================
function showLoading(show) {
  document.getElementById('loader').classList.toggle('hide', !show);
}

// ============================================================
// INIT
// ============================================================
function init() {
  loadUnit();
  updateOfflineStatus();

  const cached = getCache();
  if (cached && cached.location) {
    renderWeather(cached);
    if (!navigator.onLine) showMessage('Offline – cached data', 'info', 4000);
  } else {
    useLocation();
    setTimeout(() => {
      if (tempDisplay.textContent === '--') {
        showMessage('Search for a city or use location', 'info', 5000);
      }
    }, 3000);
  }

  // Events
  searchBtn.addEventListener('click', () => {
    const city = searchInput.value.trim();
    if (city) { searchWeather(city);
      searchInput.value = ''; }
  });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchBtn.click(); });
  locateBtn.addEventListener('click', useLocation);
  unitToggle.addEventListener('click', toggleUnit);
  refreshBtn.addEventListener('click', () => {
    if (state.city) searchWeather(state.city);
    else useLocation();
  });
  shareBtn.addEventListener('click', shareWeather);
  clearFavoritesBtn.addEventListener('click', clearFavorites);
  clearRecentBtn.addEventListener('click', clearRecent);

  cityName.addEventListener('dblclick', () => {
    if (state.city) addFavorite(state.city);
  });

  // Resize handler for particles
  window.addEventListener('resize', () => {
    if (particles) particles.resize();
  });

  setTimeout(() => document.getElementById('loader').classList.add('hide'), 600);
  renderFavorites();
  renderRecent();
}

document.addEventListener('DOMContentLoaded', init);
