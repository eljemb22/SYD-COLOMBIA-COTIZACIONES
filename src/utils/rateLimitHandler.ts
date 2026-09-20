/**
 * Centralized Rate Limit (HTTP 429 / Resource Exhausted) Handler
 * Detects rate limits across Gemini AI, Google APIs, Firestore, and backend endpoints.
 * Provides user-friendly Spanish notifications, backoff management, and suppresses error cascades.
 */

export interface RateLimitEventDetail {
  feature?: string;
  message: string;
  timestamp: number;
  retryAfterSeconds?: number;
}

let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE_MS = 10000; // 10 seconds throttle between toast notifications

/**
 * Evaluates whether an error, status code, or response body represents a 429 / Rate Limit error
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;

  if (typeof err === 'number') {
    return err === 429;
  }

  if (typeof err === 'object') {
    const obj = err as any;
    if (obj.status === 429 || obj.statusCode === 429 || obj.code === 429) {
      return true;
    }
    if (obj.code === 'resource-exhausted' || obj.status === 'RESOURCE_EXHAUSTED') {
      return true;
    }
  }

  const message = (
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err)
  ).toLowerCase();

  return (
    message.includes('rate exceeded') ||
    message.includes('rate limit') ||
    message.includes('ratelimitexceeded') ||
    message.includes('quota exceeded') ||
    message.includes('resource_exhausted') ||
    message.includes('resource-exhausted') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('límite de velocidad') ||
    message.includes('units per minute')
  );
}

/**
 * Triggers a user-friendly UI alert when a rate limit or 429 occurs
 */
export function notifyRateLimit(feature = 'Servicio', customMessage?: string): void {
  const now = Date.now();
  if (now - lastNotificationTime < NOTIFICATION_THROTTLE_MS) {
    // Suppress duplicate alerts in rapid succession
    return;
  }
  lastNotificationTime = now;

  const defaultMessage = `Se ha alcanzado temporalmente el límite de velocidad en ${feature}. El sistema está protegiendo tus datos y pausando solicitudes automáticas. Podrás reintentar en un minuto.`;
  const message = customMessage || defaultMessage;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<RateLimitEventDetail>('syd_rate_limit_alert', {
        detail: {
          feature,
          message,
          timestamp: now,
          retryAfterSeconds: 60,
        },
      })
    );
  }
}

/**
 * Safe fetch wrapper that intercepts 429 / Rate Limit errors and dispatches friendly UI notifications
 */
export async function safeFetchWithRateLimit(
  input: RequestInfo | URL,
  init?: RequestInit,
  featureName = 'Servicio'
): Promise<Response> {
  try {
    const response = await fetch(input, init);

    if (response.status === 429) {
      notifyRateLimit(
        featureName,
        `Límite de solicitudes alcanzado en ${featureName} (HTTP 429). Por favor espera un momento antes de reintentar.`
      );
    }

    return response;
  } catch (err: any) {
    if (isRateLimitError(err)) {
      notifyRateLimit(
        featureName,
        `Límite de velocidad alcanzado en ${featureName}. Se utilizarán datos locales mientras se restablece el servicio.`
      );
    }
    throw err;
  }
}
