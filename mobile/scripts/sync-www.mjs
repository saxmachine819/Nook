#!/usr/bin/env node
/**
 * Ensures www/ assets required by Capacitor sync are present.
 * The live product UI is loaded from server.url; www is offline/splash fallback.
 */
import { mkdirSync, existsSync, copyFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const www = join(root, "www")
const assets = join(www, "assets")
mkdirSync(assets, { recursive: true })

const candidates = [
  join(root, "..", "public", "nooc-logo.png"),
  join(root, "..", "NoocLogo.png"),
]

for (const src of candidates) {
  if (existsSync(src)) {
    copyFileSync(src, join(assets, "nooc-logo.png"))
    console.log("Synced logo → www/assets/nooc-logo.png")
    break
  }
}

console.log("www ready for cap sync")
