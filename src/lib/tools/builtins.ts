import { Appearance, Platform } from 'react-native';
import { evaluate } from './math';
import {
  type Tool,
  ToolInputError,
  fetchJson,
  optionalString,
  requireString,
} from './types';

/** All tools run on-device and call only public, key-less APIs. */

export const getCurrentDateTime: Tool = {
  label: 'Checking the time',
  declaration: {
    name: 'get_current_datetime',
    description:
      'Get the current date and time, optionally in a specific IANA time zone (e.g. "Asia/Kolkata").',
    parameters: {
      type: 'OBJECT',
      properties: {
        timezone: {
          type: 'STRING',
          description: 'IANA time zone. Defaults to the device time zone.',
        },
      },
    },
  },
  async run(args) {
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezone = optionalString(args, 'timezone') ?? deviceTz;
    const now = new Date();
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);
    } catch {
      throw new ToolInputError(`Unknown time zone "${timezone}"`);
    }
    return {
      timezone,
      formatted,
      iso_utc: now.toISOString(),
      unix_ms: now.getTime(),
    };
  },
};

export const calculate: Tool = {
  label: 'Calculating',
  declaration: {
    name: 'calculate',
    description:
      'Evaluate an arithmetic expression exactly. Supports + - * / % ^, parentheses, pi, e, sqrt, abs, sin, cos, tan, ln, log, exp, round, floor, ceil, min, max, pow.',
    parameters: {
      type: 'OBJECT',
      properties: {
        expression: {
          type: 'STRING',
          description: 'e.g. "(12.5 * 4) ^ 2 / sqrt(16)"',
        },
      },
      required: ['expression'],
    },
  },
  async run(args) {
    const expression = requireString(args, 'expression');
    try {
      const result = evaluate(expression);
      return { expression, result: Number(result.toPrecision(15)) };
    } catch (e) {
      throw new ToolInputError((e as Error).message);
    }
  },
};

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

export const getWeather: Tool = {
  label: 'Checking the weather',
  declaration: {
    name: 'get_weather',
    description:
      'Current weather and a 3-day forecast for a city or place name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        location: {
          type: 'STRING',
          description: 'City or place, e.g. "Hyderabad" or "Paris, France"',
        },
        units: {
          type: 'STRING',
          enum: ['metric', 'imperial'],
          description: 'Defaults to metric.',
        },
      },
      required: ['location'],
    },
  },
  async run(args, { signal }) {
    const location = requireString(args, 'location', 120);
    const imperial = args.units === 'imperial';
    const geo = await fetchJson<{
      results?: {
        name: string;
        country?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }[];
    }>(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(
        location.split(',')[0],
      )}`,
      signal,
    );
    const place = geo.results?.[0];
    if (!place) {
      throw new ToolInputError(`No place found for "${location}"`);
    }
    const q = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current:
        'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '3',
      timezone: 'auto',
      ...(imperial
        ? { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph' }
        : {}),
    });
    const wx = await fetchJson<any>(
      `https://api.open-meteo.com/v1/forecast?${q.toString()}`,
      signal,
    );
    const c = wx.current ?? {};
    return {
      place: [place.name, place.admin1, place.country]
        .filter(Boolean)
        .join(', '),
      units: imperial
        ? { temp: '°F', wind: 'mph' }
        : { temp: '°C', wind: 'km/h' },
      current: {
        time: c.time,
        condition: WEATHER_CODES[c.weather_code] ?? 'Unknown',
        temperature: c.temperature_2m,
        feels_like: c.apparent_temperature,
        humidity_pct: c.relative_humidity_2m,
        wind: c.wind_speed_10m,
      },
      daily: (wx.daily?.time ?? []).map((d: string, i: number) => ({
        date: d,
        condition: WEATHER_CODES[wx.daily.weather_code[i]] ?? 'Unknown',
        max: wx.daily.temperature_2m_max[i],
        min: wx.daily.temperature_2m_min[i],
        rain_chance_pct: wx.daily.precipitation_probability_max?.[i],
      })),
      source: 'open-meteo.com',
    };
  },
};

export const searchWikipedia: Tool = {
  label: 'Searching Wikipedia',
  declaration: {
    name: 'search_wikipedia',
    description:
      'Look up factual, encyclopedic information. Returns short summaries of the top matching Wikipedia articles.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search terms' },
        language: {
          type: 'STRING',
          description: 'Wikipedia language code, default "en"',
        },
      },
      required: ['query'],
    },
  },
  async run(args, { signal }) {
    const query = requireString(args, 'query', 200);
    const lang = /^[a-z]{2,3}$/.test(String(args.language ?? ''))
      ? String(args.language)
      : 'en';
    const base = `https://${lang}.wikipedia.org`;
    const search = await fetchJson<{
      pages?: { key: string; title: string }[];
    }>(
      `${base}/w/rest.php/v1/search/page?limit=3&q=${encodeURIComponent(
        query,
      )}`,
      signal,
    );
    const pages = search.pages ?? [];
    if (!pages.length) {
      return { query, results: [] };
    }
    const results = await Promise.all(
      pages.map(async p => {
        try {
          const s = await fetchJson<{
            title: string;
            extract?: string;
            content_urls?: { mobile?: { page?: string } };
          }>(
            `${base}/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`,
            signal,
          );
          return {
            title: s.title,
            summary: s.extract?.slice(0, 1200),
            url: s.content_urls?.mobile?.page,
          };
        } catch {
          return { title: p.title };
        }
      }),
    );
    return { query, results };
  },
};

export const getDeviceInfo: Tool = {
  label: 'Reading device info',
  declaration: {
    name: 'get_device_info',
    description:
      "Information about the user's device: platform, OS version, locale, time zone and theme.",
  },
  async run() {
    const intl = Intl.DateTimeFormat().resolvedOptions();
    return {
      platform: Platform.OS,
      os_version: String(Platform.Version),
      locale: intl.locale,
      timezone: intl.timeZone,
      color_scheme: Appearance.getColorScheme() ?? 'unknown',
    };
  },
};

export const BUILTIN_TOOLS: Tool[] = [
  getCurrentDateTime,
  calculate,
  getWeather,
  searchWikipedia,
  getDeviceInfo,
];
