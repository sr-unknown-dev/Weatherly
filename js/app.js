(() => {
  "use strict";

  const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
  const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
  const STORAGE_KEY = "weatherly_prefs_v2";
  const DEFAULT_CITY = { name: "Ciudad de México", country: "México", admin1: "CDMX", lat: 19.4326, lon: -99.1332 };
  const LOCALE = "es-MX";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const prefs = loadPrefs();
  let unit = prefs.unit || "c";
  let lastPlace = prefs.lastPlace || null;
  let lastData = null;
  let lastAir = null;
  let suggestAbort = null;
  let activeSuggest = -1;

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function savePrefs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      unit,
      theme: document.documentElement.dataset.theme,
      lastPlace,
    }));
  }

  /* ─────────── Weather icons (SVG) ─────────── */

  function iconSVG(kind, opts = {}) {
    const night = !!opts.night;
    const s = (inner) => `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

    const sunDay = `<circle cx="32" cy="32" r="12" fill="#FFD257"/><g stroke="#FFB000" stroke-width="3" stroke-linecap="round"><path d="M32 8v5M32 51v5M8 32h5M51 32h5M15 15l3.5 3.5M45.5 45.5 49 49M49 15l-3.5 3.5M18.5 45.5 15 49"/></g>`;
    const moon = `<path d="M40 12a20 20 0 0 0 6 34A22 22 0 1 1 40 12z" fill="#E7EEFB"/><circle cx="46" cy="20" r="1.6" fill="#c3cfe8"/><circle cx="50" cy="30" r="1.1" fill="#c3cfe8"/>`;
    const cloud = `<path d="M20 44a11 11 0 0 1 0-22 13 13 0 0 1 25 3 9 9 0 0 1-1 19z" fill="#ffffff"/><path d="M20 44a11 11 0 0 1 0-22 13 13 0 0 1 25 3 9 9 0 0 1-1 19z" fill="#dfe7fb" opacity=".5"/>`;
    const rain = `<g stroke="#5B9BD5" stroke-width="3" stroke-linecap="round"><path d="M24 48l-3 7M34 48l-3 7M44 48l-3 7"/></g>`;
    const drizzle = `<g stroke="#7FB3E0" stroke-width="2.4" stroke-linecap="round"><path d="M26 47l-2 5M36 47l-2 5M46 47l-2 5"/></g>`;
    const snow = `<g fill="#cfe0ff"><circle cx="24" cy="52" r="2.4"/><circle cx="34" cy="54" r="2.4"/><circle cx="44" cy="52" r="2.4"/></g>`;
    const bolt = `<path d="M34 46l-9 13h8l-3 10 11-14h-8z" fill="#FFC93C"/>`;

    switch (kind) {
      case "clear": return s(night ? moon : sunDay);
      case "mostly-clear": return s((night ? moon : sunDay) + `<path d="M40 40a9 9 0 0 1-1-15 11 11 0 0 1 14 10 8 8 0 0 1-2 15H42a8 8 0 0 1-2-10z" fill="#ffffff" opacity=".9"/>`);
      case "clouds": return s(cloud);
      case "rain": return s(cloud + rain);
      case "drizzle": return s(cloud + drizzle);
      case "storm": return s(cloud + bolt + rain);
      case "snow": return s(cloud + snow);
      case "fog": return s(`<g stroke="#cfd8ec" stroke-width="4" stroke-linecap="round"><path d="M14 26h36M20 34h34M16 42h30M22 50h26"/></g>`);
      default: return s(sunDay);
    }
  }

  const WMO = {
    0: { label: "Despejado", kind: "clear" },
    1: { label: "Mayormente despejado", kind: "mostly-clear" },
    2: { label: "Parcialmente nublado", kind: "clouds" },
    3: { label: "Nublado", kind: "clouds" },
    45: { label: "Niebla", kind: "fog" },
    48: { label: "Niebla con escarcha", kind: "fog" },
    51: { label: "Llovizna ligera", kind: "drizzle" },
    53: { label: "Llovizna", kind: "drizzle" },
    55: { label: "Llovizna intensa", kind: "drizzle" },
    56: { label: "Llovizna helada", kind: "drizzle" },
    57: { label: "Llovizna helada fuerte", kind: "drizzle" },
    61: { label: "Lluvia ligera", kind: "rain" },
    63: { label: "Lluvia", kind: "rain" },
    65: { label: "Lluvia fuerte", kind: "rain" },
    66: { label: "Lluvia helada", kind: "rain" },
    67: { label: "Lluvia helada fuerte", kind: "rain" },
    71: { label: "Nieve ligera", kind: "snow" },
    73: { label: "Nieve", kind: "snow" },
    75: { label: "Nieve fuerte", kind: "snow" },
    77: { label: "Granos de nieve", kind: "snow" },
    80: { label: "Chubascos ligeros", kind: "rain" },
    81: { label: "Chubascos", kind: "rain" },
    82: { label: "Chubascos violentos", kind: "rain" },
    85: { label: "Chubascos de nieve", kind: "snow" },
    86: { label: "Chubascos de nieve fuertes", kind: "snow" },
    95: { label: "Tormenta eléctrica", kind: "storm" },
    96: { label: "Tormenta con granizo", kind: "storm" },
    99: { label: "Tormenta con granizo fuerte", kind: "storm" },
  };
  const wmo = (code) => WMO[code] || { label: "Desconocido", kind: "clouds" };

  /* ─────────── Units & formatting ─────────── */

  const toF = (c) => c * 9 / 5 + 32;
  function temp(c) {
    if (c === null || c === undefined || Number.isNaN(c)) return "--";
    return Math.round(unit === "f" ? toF(c) : c);
  }
  const unitLabel = () => (unit === "f" ? "°F" : "°C");
  function wind(kmh) {
    if (kmh === null || kmh === undefined) return "--";
    return unit === "f" ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
  }
  function pressure(hpa) {
    return unit === "f" ? `${(hpa * 0.02953).toFixed(2)} inHg` : `${Math.round(hpa)} hPa`;
  }
  function precip(mm) {
    const v = unit === "f" ? mm / 25.4 : mm;
    return unit === "f" ? `${v.toFixed(2)} in` : `${v.toFixed(1)} mm`;
  }
  function fmtDate(iso, opts) {
    return new Date(iso + "T12:00:00").toLocaleDateString(LOCALE, opts);
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  }
  function windDir(deg) {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /* ─────────── Sky / theme sync ─────────── */

  function setSky(kind, isNight) {
    const root = document.documentElement;
    root.dataset.weather = kind === "clear" && isNight ? "night" : kind;
    root.dataset.night = isNight ? "on" : "off";
    const wet = kind === "rain" || kind === "storm" || kind === "drizzle";
    root.dataset.rain = wet ? "on" : "off";
    buildRain(wet);
    syncThemeColor();
  }

  function syncThemeColor() {
    const dark = document.documentElement.dataset.theme !== "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0a0e17" : "#eef2f9");
  }

  let rainBuilt = false;
  function buildRain(on) {
    const layer = document.getElementById("rainLayer");
    if (!layer) return;
    if (on && !rainBuilt) {
      const drops = Array.from({ length: 46 }, () => {
        const d = document.createElement("span");
        d.className = "drop";
        d.style.left = Math.random() * 100 + "%";
        d.style.animationDuration = 0.5 + Math.random() * 0.6 + "s";
        d.style.animationDelay = Math.random() * 2 + "s";
        d.style.height = 40 + Math.random() * 50 + "px";
        return d;
      });
      layer.append(...drops);
      rainBuilt = true;
    } else if (!on && rainBuilt) {
      layer.innerHTML = "";
      rainBuilt = false;
    }
  }

  /* ─────────── Rendering ─────────── */

  function renderCurrent(place, data) {
    const cur = data.current;
    const daily = data.daily;
    const info = wmo(cur.weather_code);
    const isNight = !cur.is_day;
    setSky(info.kind, isNight);

    const feelsDiff = Math.round((cur.apparent_temperature ?? cur.temperature_2m) - cur.temperature_2m);
    const feelsTag = feelsDiff <= -3 ? "Se siente más frío" : feelsDiff >= 3 ? "Se siente más caluroso" : "Similar a la temperatura";

    document.getElementById("current").innerHTML = `
      <div class="current-main">
        <div class="current-icon">${iconSVG(info.kind, { night: isNight })}</div>
        <div class="current-info">
          <div class="location-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span class="place">${escapeHTML(place.name)}</span>
            <span class="country">${escapeHTML([place.admin1, place.country].filter(Boolean).join(" · "))}</span>
          </div>
          <div class="temp-now">${temp(cur.temperature_2m)}<span class="deg">${unitLabel()}</span></div>
          <p class="condition">${info.label}</p>
          <p class="feels">Sensación <strong>${temp(cur.apparent_temperature)}${unitLabel()}</strong> · ${feelsTag}</p>
        </div>
        <div class="current-extra">
          <div class="hi-lo">
            <div class="hi"><span>Máx</span><strong>${temp(daily.temperature_2m_max[0])}°</strong></div>
            <div class="lo"><span>Mín</span><strong>${temp(daily.temperature_2m_min[0])}°</strong></div>
          </div>
          <p class="updated">Actualizado ${fmtTime(cur.time)}</p>
        </div>
      </div>
      <div class="hero-meta">
        <div class="hero-meta-item"><span>Humedad</span><strong>${cur.relative_humidity_2m}%</strong></div>
        <div class="hero-meta-item"><span>Viento</span><strong>${wind(cur.wind_speed_10m)} ${windDir(cur.wind_direction_10m)}</strong></div>
        <div class="hero-meta-item"><span>Nubosidad</span><strong>${cur.cloud_cover ?? "--"}%</strong></div>
        <div class="hero-meta-item"><span>Precipitación</span><strong>${precip(cur.precipitation ?? 0)}</strong></div>
      </div>`;
  }

  function renderHourly(data) {
    const track = document.getElementById("hourlyTrack");
    const times = data.hourly.time;
    const nowMs = Date.now();
    let start = times.findIndex((t) => new Date(t).getTime() >= nowMs - 3600000);
    if (start < 0) start = 0;
    const slice = times.slice(start, start + 24);

    track.innerHTML = slice
      .map((t, i) => {
        const idx = start + i;
        const info = wmo(data.hourly.weather_code[idx]);
        const isNow = i === 0;
        const rain = data.hourly.precipitation_probability?.[idx] ?? 0;
        const label = isNow ? "Ahora" : new Date(t).toLocaleTimeString(LOCALE, { hour: "2-digit", hour12: false }) + "h";
        return `
          <div class="hour-cell ${isNow ? "now" : ""}" style="animation-delay:${Math.min(i * 30, 400)}ms">
            <div class="hour-time">${label}</div>
            <div class="hour-icon">${iconSVG(info.kind, { night: !(data.hourly.is_day?.[idx] ?? 1) })}</div>
            <div class="hour-temp">${temp(data.hourly.temperature_2m[idx])}°</div>
            <div class="hour-rain">${rain >= 10 ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>${rain}%` : ""}</div>
          </div>`;
      })
      .join("");

    document.getElementById("hourlySection").hidden = false;
  }

  function renderForecast(data) {
    const daily = data.daily;
    const list = document.getElementById("forecastList");
    const today = new Date().toISOString().slice(0, 10);
    const days = daily.time.slice(0, 7);

    const weekMin = Math.min(...days.map((_, i) => daily.temperature_2m_min[i]));
    const weekMax = Math.max(...days.map((_, i) => daily.temperature_2m_max[i]));
    const span = Math.max(weekMax - weekMin, 1);

    list.innerHTML = days
      .map((iso, i) => {
        const info = wmo(daily.weather_code[i]);
        const isToday = iso === today;
        const rain = daily.precipitation_probability_max?.[i] ?? 0;
        const lo = daily.temperature_2m_min[i];
        const hi = daily.temperature_2m_max[i];
        const left = ((lo - weekMin) / span) * 100;
        const width = Math.max(((hi - lo) / span) * 100, 4);
        return `
          <div class="day-row ${isToday ? "today" : ""}" style="animation-delay:${i * 40}ms">
            <div class="day-day">
              <span class="name">${isToday ? "Hoy" : fmtDate(iso, { weekday: "long" })}</span>
              <span class="date">${fmtDate(iso, { day: "numeric", month: "short" })}</span>
            </div>
            <div class="day-icon">${iconSVG(info.kind)}</div>
            <div class="day-bar">
              <span class="min">${temp(lo)}°</span>
              <div class="temp-track"><div class="fill" style="left:${left}%;width:${width}%"></div></div>
              <span class="max">${temp(hi)}°</span>
            </div>
            <div class="day-rain ${rain < 10 ? "zero" : ""}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>${rain}%
            </div>
          </div>`;
      })
      .join("");

    document.getElementById("forecastRange").textContent =
      `${fmtDate(days[0], { day: "numeric", month: "short" })} – ${fmtDate(days[days.length - 1], { day: "numeric", month: "short" })}`;
    document.getElementById("forecast").hidden = false;
  }

  /* ─────────── Comfort (cold/heat) index ─────────── */

  function comfortIndex(feelsC, humidity, windKmh) {
    let score = 5;
    if (feelsC <= 5) score = 1;
    else if (feelsC <= 10) score = 2;
    else if (feelsC <= 16) score = 3;
    else if (feelsC <= 21) score = 4;
    else if (feelsC <= 26) score = 5;
    else if (feelsC <= 30) score = 6;
    else if (feelsC <= 35) score = 7;
    else if (feelsC <= 40) score = 8;
    else score = 9;

    if (humidity >= 70 && feelsC >= 24) score += 0.5;
    if (windKmh >= 25 && feelsC <= 15) score -= 0.5;
    return Math.max(0.5, Math.min(9.5, score));
  }
  const comfortVerdict = (s) =>
    s <= 2 ? { t: "Frío / Muy frío", c: "badge-bad" } :
    s <= 3.5 ? { t: "Fresco", c: "badge-ok" } :
    s <= 5.5 ? { t: "Confortable", c: "badge-good" } :
    s <= 7 ? { t: "Cálido", c: "badge-ok" } :
    { t: "Caluroso / Sofocante", c: "badge-bad" };

  /* ─────────── Details ─────────── */

  const svgWrap = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const humIcon = () => svgWrap(`<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>`);
  const windIcon = () => svgWrap(`<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a2.5 2.5 0 1 1-2.5 2.5M3 12h18"/>`);
  const uvIcon = () => svgWrap(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`);
  const rainIcon = () => svgWrap(`<path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>`);
  const gaugeIcon = () => svgWrap(`<circle cx="12" cy="12" r="9"/><path d="M12 12l4-3"/>`);
  const sunIcon = () => svgWrap(`<path d="M12 3v4m0 0 3-2m-3 2L9 5M4 17h16M6 21h12"/><path d="M17 13a5 5 0 0 0-10 0"/>`);
  const thermoIcon = () => svgWrap(`<path d="M14 14.76V4a2 2 0 1 0-4 0v10.76a4 4 0 1 0 4 0z"/>`);
  const eyeIcon = () => svgWrap(`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`);
  const airIcon = () => svgWrap(`<path d="M3 7h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 17h9"/>`);
  const dropIcon = () => svgWrap(`<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>`);

  function renderDetails(data, air) {
    const cur = data.current;
    const daily = data.daily;

    const uv = daily.uv_index_max?.[0] ?? 0;
    const uvLabel = uv <= 2 ? "Bajo" : uv <= 5 ? "Moderado" : uv <= 7 ? "Alto" : uv <= 10 ? "Muy alto" : "Extremo";
    const uvClass = uv <= 2 ? "badge-good" : uv <= 7 ? "badge-ok" : "badge-bad";

    const humidity = cur.relative_humidity_2m;
    const dew = cur.dew_point_2m;
    const gusts = cur.wind_gusts_10m;
    const visKm = cur.visibility != null ? cur.visibility / 1000 : null;
    const visLabel = visKm == null ? "--" : visKm >= 10 ? "Excelente" : visKm >= 5 ? "Buena" : visKm >= 2 ? "Moderada" : "Reducida";

    const ci = comfortIndex(cur.apparent_temperature, humidity, cur.wind_speed_10m);
    const verdict = comfortVerdict(ci);

    let aqiCard = "";
    if (air && air.current) {
      const aqi = air.current.european_aqi;
      const aqiLabel = aqi <= 20 ? "Buena" : aqi <= 40 ? "Aceptable" : aqi <= 60 ? "Moderada" : aqi <= 80 ? "Mala" : aqi <= 100 ? "Muy mala" : "Extrema";
      const aqiClass = aqi <= 20 ? "badge-good" : aqi <= 60 ? "badge-ok" : "badge-bad";
      aqiCard = `
        <article class="detail-card">
          <div class="detail-head">${airIcon()}Calidad del aire</div>
          <div class="detail-value">${Math.round(aqi)} <small>EAQI</small></div>
          <div class="detail-sub"><span class="detail-badge ${aqiClass}">${aqiLabel}</span></div>
          <div class="bar"><div class="bar-fill" style="width:${Math.min(aqi / 100 * 100, 100)}%"></div></div>
        </article>`;
    }

    const cards = `
      <div class="comfort">
        <div class="comfort-head">
          <h3>${thermoIcon()}Índice de confort</h3>
          <span class="comfort-verdict ${verdict.c}" style="color:inherit">${verdict.t}</span>
        </div>
        <div class="comfort-scale"><div class="comfort-marker" style="left:${(ci / 10) * 100}%"></div></div>
        <div class="comfort-labels"><span>Muy frío</span><span>Fresco</span><span>Confortable</span><span>Cálido</span><span>Sofocante</span></div>
        <div class="comfort-rows">
          <div class="comfort-row"><span>Sensación térmica</span><strong>${temp(cur.apparent_temperature)}${unitLabel()}</strong></div>
          <div class="comfort-row"><span>Temperatura real</span><strong>${temp(cur.temperature_2m)}${unitLabel()}</strong></div>
          <div class="comfort-row"><span>Punto de rocío</span><strong>${temp(dew)}${unitLabel()}</strong></div>
          <div class="comfort-row"><span>Sensación</span><strong>${Math.round(cur.apparent_temperature)}° → ${comfortVerdict(ci).t.split(" /")[0]}</strong></div>
        </div>
      </div>

      <article class="detail-card">
        <div class="detail-head">${humIcon()}Humedad</div>
        <div class="detail-value">${humidity}%</div>
        <div class="detail-sub">Punto de rocío ${temp(dew)}${unitLabel()}</div>
        <div class="bar"><div class="bar-fill" style="width:${humidity}%"></div></div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${windIcon()}Viento</div>
        <div class="detail-value">${wind(cur.wind_speed_10m)}</div>
        <div class="detail-sub">${windDir(cur.wind_direction_10m)} (${cur.wind_direction_10m}°) · Ráfagas ${wind(gusts)}</div>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(cur.wind_speed_10m, 100)}%"></div></div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${uvIcon()}Índice UV</div>
        <div class="detail-value">${Math.round(uv)}</div>
        <div class="detail-sub"><span class="detail-badge ${uvClass}">${uvLabel}</span></div>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(uv / 11 * 100, 100)}%"></div></div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${rainIcon()}Precipitación</div>
        <div class="detail-value">${precip(cur.precipitation ?? 0)}</div>
        <div class="detail-sub">Probabilidad hoy ${daily.precipitation_probability_max?.[0] ?? 0}%</div>
        <div class="bar"><div class="bar-fill" style="width:${daily.precipitation_probability_max?.[0] ?? 0}%"></div></div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${gaugeIcon()}Presión</div>
        <div class="detail-value">${pressure(cur.pressure_msl)}</div>
        <div class="detail-sub">${cur.pressure_msl >= 1013 ? "Sistema de alta presión" : "Sistema de baja presión"}</div>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(Math.max((cur.pressure_msl - 980) / 60 * 100, 0), 100)}%"></div></div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${eyeIcon()}Visibilidad</div>
        <div class="detail-value">${visKm == null ? "--" : visKm.toFixed(1)} <small>km</small></div>
        <div class="detail-sub">${visLabel}</div>
      </article>

      <article class="detail-card">
        <div class="detail-head">${sunIcon()}Sol</div>
        <div class="detail-value">${fmtTime(daily.sunrise[0])}</div>
        <div class="detail-sub">Puesta ${fmtTime(daily.sunset[0])} · ${dayLength(daily.sunrise[0], daily.sunset[0])}</div>
      </article>

      ${aqiCard}`;

    document.getElementById("detailsGrid").innerHTML = cards;
    document.getElementById("details").hidden = false;
  }

  function dayLength(rise, set) {
    const ms = new Date(set) - new Date(rise);
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `${h} h ${m} min de luz`;
  }

  function escapeHTML(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ─────────── Data ─────────── */

  async function geocode(query) {
    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=8&language=es&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("geo");
    const data = await res.json();
    return data.results || [];
  }

  async function fetchWeather(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,visibility",
      hourly: "temperature_2m,weather_code,precipitation_probability,is_day,apparent_temperature",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max",
      timezone: "auto",
      forecast_days: "7",
    });
    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error("weather");
    return res.json();
  }

  async function fetchAir(lat, lon) {
    try {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: "european_aqi,pm2_5,pm10",
        timezone: "auto",
      });
      const res = await fetch(`${AIR_URL}?${params}`);
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  function showLoading() {
    document.getElementById("errorState").hidden = true;
    document.getElementById("app").hidden = false;
    document.getElementById("hourlySection").hidden = true;
    document.getElementById("forecast").hidden = true;
    document.getElementById("details").hidden = true;
    document.getElementById("current").innerHTML = `<div class="loading-block"><span class="spinner"></span><p>Cargando el tiempo…</p></div>`;
  }

  function showError(title, msg) {
    document.getElementById("app").hidden = true;
    document.getElementById("errorState").hidden = false;
    document.getElementById("errorTitle").textContent = title;
    document.getElementById("errorMsg").textContent = msg;
  }

  async function loadPlace(place) {
    showLoading();
    try {
      const [data, air] = await Promise.all([fetchWeather(place.lat, place.lon), fetchAir(place.lat, place.lon)]);
      lastPlace = place;
      lastData = data;
      lastAir = air;
      savePrefs();
      renderCurrent(place, data);
      renderHourly(data);
      renderForecast(data);
      renderDetails(data, air);
      markActiveChip(place.name);
    } catch (err) {
      showError("No pudimos obtener el tiempo", "Revisa tu conexión a internet e inténtalo de nuevo.");
    }
  }

  function markActiveChip(name) {
    $$(".chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.city.toLowerCase() === (name || "").toLowerCase());
    });
  }

  async function search(query) {
    if (!query.trim()) return;
    showLoading();
    try {
      const results = await geocode(query.trim());
      if (!results.length) {
        showError("No encontramos esa ciudad", `No hay resultados para «${escapeHTML(query.trim())}». Prueba con otro nombre.`);
        return;
      }
      const r = results[0];
      document.getElementById("searchInput").value = r.name;
      await loadPlace({ name: r.name, country: r.country, admin1: r.admin1, lat: r.latitude, lon: r.longitude });
    } catch {
      showError("Error de búsqueda", "No se pudo conectar con el servicio de búsqueda.");
    }
  }

  /* ─────────── Suggestions ─────────── */

  async function suggest(query) {
    const box = document.getElementById("suggest");
    const q = query.trim();
    if (q.length < 2) { box.hidden = true; return; }
    try {
      suggestAbort?.abort();
      suggestAbort = new AbortController();
      const url = `${GEO_URL}?name=${encodeURIComponent(q)}&count=6&language=es&format=json`;
      const res = await fetch(url, { signal: suggestAbort.signal });
      const data = await res.json();
      const results = data.results || [];
      if (!results.length) { box.hidden = true; return; }
      box.innerHTML = results
        .map((r, i) => `
          <button class="suggest-item" role="option" data-index="${i}" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${escapeHTML(r.name)}" data-country="${escapeHTML(r.country || "")}" data-admin="${escapeHTML(r.admin1 || "")}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span>${escapeHTML(r.name)}</span>
            <span class="region">${escapeHTML([r.admin1, r.country].filter(Boolean).join(", "))}</span>
          </button>`)
        .join("");
      box.hidden = false;
      activeSuggest = -1;
    } catch (e) {
      if (e.name !== "AbortError") box.hidden = true;
    }
  }

  function navigateSuggest(dir) {
    const box = document.getElementById("suggest");
    if (box.hidden) return;
    const items = $$(".suggest-item", box);
    if (!items.length) return;
    activeSuggest = (activeSuggest + dir + items.length) % items.length;
    items.forEach((it, i) => it.setAttribute("aria-selected", i === activeSuggest ? "true" : "false"));
    items[activeSuggest].scrollIntoView({ block: "nearest" });
  }

  function chooseActiveOrInput() {
    const box = document.getElementById("suggest");
    const items = $$(".suggest-item", box);
    if (!box.hidden && activeSuggest >= 0 && items[activeSuggest]) {
      items[activeSuggest].click();
      return true;
    }
    return false;
  }

  /* ─────────── Events ─────────── */

  function bind() {
    document.getElementById("quickCities").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.getElementById("searchInput").value = chip.dataset.city;
      search(chip.dataset.city);
    });

    document.getElementById("searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (chooseActiveOrInput()) return;
      document.getElementById("suggest").hidden = true;
      search(document.getElementById("searchInput").value);
    });

    const input = document.getElementById("searchInput");
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => suggest(input.value), 240);
    });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) suggest(input.value); });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); navigateSuggest(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); navigateSuggest(-1); }
    });

    document.getElementById("suggest").addEventListener("click", (e) => {
      const item = e.target.closest(".suggest-item");
      if (!item) return;
      document.getElementById("suggest").hidden = true;
      input.value = item.dataset.name;
      loadPlace({
        name: item.dataset.name,
        country: item.dataset.country,
        admin1: item.dataset.admin,
        lat: +item.dataset.lat,
        lon: +item.dataset.lon,
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search") && !e.target.closest("#suggest")) document.getElementById("suggest").hidden = true;
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.getElementById("suggest").hidden = true;
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); input.focus(); }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") { e.preventDefault(); document.getElementById("themeToggle").click(); }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); input.focus(); input.select(); }
    });

    document.getElementById("locateBtn").addEventListener("click", () => {
      const btn = document.getElementById("locateBtn");
      if (!navigator.geolocation) { showError("Geolocalización no disponible", "Tu navegador no permite obtener tu ubicación."); return; }
      btn.classList.add("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => { btn.classList.remove("loading"); loadPlace({ name: "Mi ubicación", country: "", lat: pos.coords.latitude, lon: pos.coords.longitude }); },
        () => { btn.classList.remove("loading"); showError("No pudimos acceder a tu ubicación", "Concede permiso de ubicación o busca tu ciudad manualmente."); },
        { timeout: 9000 }
      );
    });

    document.getElementById("unitToggle").addEventListener("click", () => {
      unit = unit === "c" ? "f" : "c";
      document.getElementById("unitLabel").textContent = unitLabel();
      savePrefs();
      if (lastPlace && lastData) {
        renderCurrent(lastPlace, lastData);
        if (lastData.hourly) renderHourly(lastData);
        renderForecast(lastData);
        renderDetails(lastData, lastAir);
      }
    });

    document.getElementById("themeToggle").addEventListener("click", () => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      syncThemeColor();
      savePrefs();
    });
  }

  function init() {
    const root = document.documentElement;
    if (prefs.theme) root.dataset.theme = prefs.theme;
    root.dataset.night = "off";
    document.getElementById("unitLabel").textContent = unitLabel();
    syncThemeColor();
    bind();
    loadPlace(lastPlace || DEFAULT_CITY);
    setInterval(() => { if (lastPlace) loadPlace(lastPlace); }, 10 * 60 * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
