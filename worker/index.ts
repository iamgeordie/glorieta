// The Glorieta Worker. It runs only for /api/* (wrangler.jsonc, assets.run_worker_first); every other
// request is served from the static assets without reaching this script.
import { HttpError, errorResponse } from './http.ts';

type Handler = (request: Request, env: Cloudflare.Env, ctx: ExecutionContext) => Promise<Response>;

/** Billing routes, keyed by "METHOD /path". Added by the billing endpoints. */
export const routes = new Map<string, Handler>();

export async function handle(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  try {
    if (!pathname.startsWith('/api/billing/')) throw new HttpError(404, 'not_found', `No API at ${pathname}.`);
    const handler = routes.get(`${request.method} ${pathname}`);
    if (!handler) {
      const known = [...routes.keys()].some((k) => k.endsWith(` ${pathname}`));
      if (known) throw new HttpError(405, 'method_not_allowed', `${request.method} is not allowed on ${pathname}.`);
      throw new HttpError(404, 'not_found', `No API at ${pathname}.`);
    }
    return await handler(request, env, ctx);
  } catch (err) {
    return errorResponse(err);
  }
}

export default { fetch: handle } satisfies ExportedHandler<Cloudflare.Env>;
