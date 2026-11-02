declare namespace App {
  interface Locals {
    user: import("./lib/session").User | null
  }
}

// Secrets live outside wrangler.jsonc, so `wrangler types` only sees them where .dev.vars exists.
declare namespace Cloudflare {
  interface Env {
    LOGTO_APP_SECRET: string
    SESSION_SECRET: string
  }
}
