// JSON responses and errors for /api/*. Every error carries a stable code and a real status.

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
  const message = err instanceof Error ? err.message : String(err);
  console.error('[api] unhandled error', message);
  return json({ error: { code: 'internal', message } }, 500);
}
