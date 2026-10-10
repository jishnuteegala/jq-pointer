// Internal keeper for drive.mjs - do not run directly.
// Launches system Edge headless with a temp profile and CDP on the given port,
// navigates to the URL, then stays alive until killed so drive.mjs commands
// can connect over CDP.

import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require("playwright-core");

const [url, port] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), "pw-jqp-profile-"));

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
writeFileSync(join(profile, "keeper-alive"), String(process.pid));

process.on("SIGTERM", () => browser.close().finally(() => process.exit(0)));
await new Promise(() => {});
