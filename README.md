# Weatherly — El tiempo, preciso

App del clima para cualquier lugar del mundo: pronóstico por horas, 7 días, índice de confort e incluso calidad del aire. Sin claves de API y sin servidores.

![Estado](https://img.shields.io/badge/estado-activo-5b9bd5) ![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) ![Sin dependencias](https://img.shields.io/badge/dependencias-0-10b981)

## ✨ Características

- **Ciudad de México** por defecto, con chips rápidos: CDMX, Guadalajara, Monterrey, Cancún, Mérida y Tijuana.
- **Búsqueda global** con autocompletado y navegación por flechas del teclado.
- **Geolocalización** — un toque para usar tu ubicación actual.
- **Pronóstico por horas (24 h)** con temperatura y probabilidad de lluvia.
- **Pronóstico de 7 días** con barra visual de rango térmico (mín–máx).
- **Índice de confort** que indica frío o calor percibido combinando sensación térmica, humedad y viento.
- **Detalles completos**: humedad y punto de rocío, viento con ráfagas y dirección, índice UV con nivel, precipitación, presión, visibilidad, salida/puesta del sol y horas de luz.
- **Calidad del aire (EAQI)** con escala de color.
- **Cielo dinámico** que cambia de color según el clima y la hora, con lluvia animada.
- **Tema claro y oscuro** sin parpadeo al recargar (se aplica antes de pintar).
- **Unidades °C / °F** que también convierten viento (mph), presión (inHg) y precipitación (in).
- **100 % responsive** con seis puntos de quiebre y soporte para orientación horizontal.

### Atajos de teclado

| Atajo | Acción |
| --- | --- |
| <kbd>/</kbd> | Enfocar la búsqueda |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd> | Buscar |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Cambiar tema |

## 🚀 Empezar

Necesitas conexión a internet (la app consulta las APIs del clima en vivo).

```bash
start index.html      # Windows
open index.html       # macOS
```

O con un servidor local (recomendado para el uso de geolocalización):

```bash
python -m http.server 8000
# visita http://localhost:8000
```

## 📁 Estructura

```
Weatherly/
├── index.html      # Estructura y barra de búsqueda
├── css/styles.css  # Temas, paletas por clima y responsive
└── js/app.js       # API, render, conversiones y cielo dinámico
```

## 🛠️ Tecnología

HTML, CSS y JavaScript **vanilla**, sin dependencias. Tipografía Inter desde Google Fonts.

## 🔌 APIs

Datos en vivo de [Open-Meteo](https://open-meteo.com) — **gratuitas y sin clave**:

| Servicio | Uso |
| --- | --- |
| [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Buscar y sugerir ciudades |
| [Forecast API](https://open-meteo.com/en/docs) | Clima actual, por horas y 7 días |
| [Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Índice de calidad del aire (EAQI) |

Modelos meteorológicos: ICON, GFS y ECMWF. Las preferencias (unidad, tema y última ciudad) se guardan en `localStorage`.

## 🌎 Localización

Interfaz en **español (es-MX)**, pero funciona para cualquier ciudad del mundo.

## 📄 Licencia

MIT.
