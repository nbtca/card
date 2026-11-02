import cloudflare from "@astrojs/cloudflare"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://card.nbtca.space",
  output: "server",
  session: false,
  adapter: cloudflare({ imageService: "passthrough" }),
})
