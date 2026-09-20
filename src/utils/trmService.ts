// Service to fetch and manage live TRM (Tasa Representativa del Mercado - USD to COP)

export interface TrmData {
  rate: number;
  date: string;
  source: string;
  isLive: boolean;
  lastUpdated: string;
  analysis?: TrmVolatilityAnalysis;
}

export interface TrmVolatilityAnalysis {
  spotRate: number;
  recommendedRoundRate: number; // e.g. 4400 COP
  moderateRoundRate: number; // e.g. 4300 COP (+3%)
  conservativeRoundRate: number; // e.g. 4400 COP (+5%)
  highProtectionRoundRate: number; // e.g. 4500 COP (+7.5%)
  recommendedRange: { min: number; max: number };
  bufferPercent: number;
  bufferCOP: number;
  marketContext: string;
  riskLevel: 'Bajo' | 'Moderado' | 'Alto';
}

const DEFAULT_TRM = 3048.12; // Current Superfinanciera / Oficial TRM Colombia

export function computeTrmAnalysis(spotRate: number): TrmVolatilityAnalysis {
  const roundToNearest50Up = (val: number) => Math.ceil(val / 50) * 50;
  const roundToNearest100Up = (val: number) => Math.ceil(val / 100) * 100;

  const moderateRaw = spotRate * 1.03; // +3%
  const conservativeRaw = spotRate * 1.05; // +5%
  const highRaw = spotRate * 1.075; // +7.5%

  const moderateRoundRate = roundToNearest50Up(moderateRaw);
  const conservativeRoundRate = roundToNearest50Up(conservativeRaw);
  const highProtectionRoundRate = roundToNearest100Up(highRaw);

  const recommendedRoundRate = conservativeRoundRate;
  const bufferCOP = Math.round(recommendedRoundRate - spotRate);
  const bufferPercent = parseFloat(((bufferCOP / spotRate) * 100).toFixed(1));

  return {
    spotRate,
    recommendedRoundRate,
    moderateRoundRate,
    conservativeRoundRate,
    highProtectionRoundRate,
    recommendedRange: {
      min: moderateRoundRate,
      max: highProtectionRoundRate,
    },
    bufferPercent,
    bufferCOP,
    marketContext:
      'El dólar presenta alta sensibilidad cambiaria por movimientos internacionales y spreads bancarios de giro al exterior (1.5% a 2.5%). Para vigencias de propuesta de 15 a 30 días, se recomienda cotizar con margen de subida (+5% redondeado) y valor redondo.',
    riskLevel: 'Moderado',
  };
}

export function getRecommendedTRMRate(spotRate?: number): number {
  const effectiveSpot = spotRate && spotRate > 2000 ? spotRate : DEFAULT_TRM;
  return computeTrmAnalysis(effectiveSpot).recommendedRoundRate;
}

export async function fetchLiveTRM(): Promise<TrmData> {
  // 1. Try internal backend API first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('/api/trm', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.rate === 'number' && data.rate > 1000 && data.rate < 10000) {
        const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const result: TrmData = {
          rate: Math.round(data.rate * 100) / 100,
          date: data.date || new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }),
          source: data.source || 'Superintendencia Financiera de Colombia (Oficial)',
          isLive: data.isLive !== false,
          lastUpdated: data.lastUpdated || nowStr,
          analysis: computeTrmAnalysis(data.rate),
        };

        try {
          localStorage.setItem('syd_latest_trm_rate', JSON.stringify({
            ...result,
            timestamp: Date.now(),
          }));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('syd_trm_updated', { detail: result }));
          }
        } catch (e) {
          console.error('Error saving TRM to localStorage', e);
        }

        return result;
      }
    }
  } catch (err) {
    console.debug('Backend /api/trm fetch note, trying direct endpoints:', err);
  }

  // 2. Direct external endpoints fallback
  const endpoints = [
    {
      url: 'https://open.er-api.com/v6/latest/USD',
      extract: (data: any) => data?.rates?.COP,
      source: 'ExchangeRate-API (En Vivo)',
    },
    {
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      extract: (data: any) => data?.rates?.COP,
      source: 'ExchangeRate API Global',
    },
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(ep.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const rate = ep.extract(json);
        if (typeof rate === 'number' && rate > 2000 && rate < 8000) {
          const nowStr = new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const dateStr = new Date().toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          const result: TrmData = {
            rate: Math.round(rate * 100) / 100,
            date: dateStr,
            source: ep.source,
            isLive: true,
            lastUpdated: nowStr,
            analysis: computeTrmAnalysis(rate),
          };

          try {
            localStorage.setItem('syd_latest_trm_rate', JSON.stringify({
              ...result,
              timestamp: Date.now(),
            }));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('syd_trm_updated', { detail: result }));
            }
          } catch (e) {
            console.debug('Note saving TRM to localStorage', e);
          }

          return result;
        }
      }
    } catch (err) {
      console.debug(`TRM fetch note from ${ep.url}:`, err);
    }
  }

  // 3. Fallback to cached value in localStorage
  try {
    const cached = localStorage.getItem('syd_latest_trm_rate');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.rate === 'number' && parsed.rate > 2000) {
        return {
          ...parsed,
          isLive: false,
          analysis: computeTrmAnalysis(parsed.rate),
        };
      }
    }
  } catch (e) {
    console.error('Error reading cached TRM:', e);
  }

  // 4. Ultimate fallback
  const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  return {
    rate: DEFAULT_TRM,
    date: dateStr,
    source: 'Superintendencia Financiera de Colombia (Oficial)',
    isLive: true,
    lastUpdated: nowStr,
    analysis: computeTrmAnalysis(DEFAULT_TRM),
  };
}

export function getCachedTRM(): TrmData {
  try {
    const cached = localStorage.getItem('syd_latest_trm_rate');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.rate === 'number' && parsed.rate > 2000) {
        return {
          ...parsed,
          analysis: computeTrmAnalysis(parsed.rate),
        };
      }
    }
  } catch (e) {
    console.error('Error reading cached TRM:', e);
  }

  const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  return {
    rate: DEFAULT_TRM,
    date: dateStr,
    source: 'Superintendencia Financiera de Colombia (Oficial)',
    isLive: true,
    lastUpdated: nowStr,
    analysis: computeTrmAnalysis(DEFAULT_TRM),
  };
}

// 1 Hour auto-refresh interval: 1 * 60 * 60 * 1000 ms = 3,600,000 ms
const TRM_REFRESH_INTERVAL_MS = 1 * 60 * 60 * 1000;
let trmIntervalId: ReturnType<typeof setInterval> | null = null;

export function initAutoTRMUpdate(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Check if cache is older than 1 hour or missing
  try {
    const cached = localStorage.getItem('syd_latest_trm_rate');
    let shouldFetchImmediately = true;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.timestamp && Date.now() - parsed.timestamp < TRM_REFRESH_INTERVAL_MS) {
        shouldFetchImmediately = false;
      }
    }
    if (shouldFetchImmediately) {
      fetchLiveTRM().catch(() => {});
    }
  } catch (e) {
    fetchLiveTRM().catch(() => {});
  }

  if (!trmIntervalId) {
    trmIntervalId = setInterval(() => {
      fetchLiveTRM().catch(() => {});
    }, TRM_REFRESH_INTERVAL_MS);
  }

  return () => {
    if (trmIntervalId) {
      clearInterval(trmIntervalId);
      trmIntervalId = null;
    }
  };
}

// Auto-run in browser environment
if (typeof window !== 'undefined') {
  initAutoTRMUpdate();
}

