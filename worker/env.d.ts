// Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them. Declared here, merged into the
// generated Cloudflare.Env. Values live in 1Password and `wrangler secret`; locally in .dev.vars.
declare namespace Cloudflare {
  interface Env {
    STRIPE_RESTRICTED_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    BILLING_HMAC_KEY: string;
  }
}
