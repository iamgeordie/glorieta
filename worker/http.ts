// JSON responses and errors for /api/*. Every error carries a stable code and a real status.
import { Stripe } from './stripe.ts';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message } }, err.status);
  // Stripe refused or failed: report Stripe's own code as a 502, the upstream's fault, not ours.
  if (err instanceof Stripe.errors.StripeError) {
    console.error('[api] stripe error', err.type, err.code ?? '', err.requestId ?? '');
    return json({ error: { code: err.code ?? err.type, message: err.message } }, 502);
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error('[api] unhandled error', message);
  return json({ error: { code: 'internal', message } }, 500);
}

/** Parses a JSON object body, or refuses with 400. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'bad_request', 'The request body must be JSON.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'bad_request', 'The request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}
