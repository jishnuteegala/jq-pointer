// pw-jqp: drive jq-pointer through system Edge via playwright-core over CDP.
// Loads playwright-core from the caller's cwd, so run from the bootstrap dir
// (see ../SKILL.md "Drive" for the pnpm bootstrap).
//
//   node drive.mjs launch <url> <evidence-dir>   start headless Edge + keeper
//   node drive.mjs stop                          close browser and keeper
//   node drive.mjs click <selector>              CSS, text=, or role=<r>[name="..."]
//   node drive.mjs fill <selector> <value|@file> fill input/textarea
//   node drive.mjs press <key>                   keyboard key on focused element
//   node drive.mjs text <selector>               print innerText of first match
//   node drive.mjs shot <file.png>               screenshot
//   node drive.mjs aria <file.txt>               accessibility-tree dump
//   node drive.mjs open <path>                   navigate the live tab to a path
//   node drive.mjs eval <js-body>                run async body with {page}

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require("playwright-core");

const CDP_PORT = 9223;
const ENDPOINT = `http://127.0.0.1:${CDP_PORT}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(process.cwd(), "pw-state.json");

const [, , command, ...args] = process.argv;

const fail = (message) => {
  console.error(`pw-jqp: ${message}`);
  process.exit(1);
};

const loadState = () => {
  if (!existsSync(STATE_FILE)) fail("no pw-state.json - run launch first");
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
};

const connect = async () => {
  const state = loadState();
  const browser = await chromium.connectOverCDP(state.endpoint);
  const context = browser.contexts()[0];
  const page = context?.pages()[0];
  if (page === undefined) fail("no page in the launched browser");
  return { browser, page };
};

const locator = (page, selector) => {
  if (selector.startsWith("role=")) {
    const match = /^role=(\w+)(?:\[name="([^"]*)"\])?$/.exec(selector);
    if (match === null) fail(`bad role selector: ${selector}`);
    return page.getByRole(match[1], match[2] === undefined ? {} : { name: match[2] });
  }
  if (selector.startsWith("text=")) return page.getByText(selector.slice(5)).first();
  return page.locator(selector).first();
};

const main = async () => {
  switch (command) {
    case "launch": {
      const [url, evidenceDir] = args;
      if (url === undefined || evidenceDir === undefined) fail("launch needs <url> <evidence-dir>");
      mkdirSync(evidenceDir, { recursive: true });
      const keeper = spawn(process.execPath, [join(HERE, "keeper.mjs"), url, String(CDP_PORT)], {
        detached: true,
        stdio: "ignore",
      });
      keeper.unref();
      // Wait for the CDP endpoint to answer.
      const deadline = Date.now() + 15000;
      for (;;) {
        try {
          const probe = await chromium.connectOverCDP(ENDPOINT);
          await probe.close();
          break;
        } catch (error) {
          if (Date.now() > deadline) fail(`CDP endpoint never came up: ${error.message}`);
          await new Promise((done) => setTimeout(done, 300));
        }
      }
      writeFileSync(
        STATE_FILE,
        JSON.stringify({ endpoint: ENDPOINT, url, keeperPid: keeper.pid }, null, 2),
      );
      console.log(`pw-jqp: Edge up at ${ENDPOINT}, keeper pid ${keeper.pid}, page ${url}`);
      break;
    }
    case "stop": {
      const state = loadState();
      try {
        const browser = await chromium.connectOverCDP(state.endpoint);
        await browser.close();
      } catch {
        // Browser may already be gone; still kill the keeper.
      }
      try {
        process.kill(state.keeperPid, "SIGTERM");
      } catch {
        // Keeper may already be gone.
      }
      console.log("pw-jqp: stopped");
      break;
    }
    case "open": {
      const { browser, page } = await connect();
      await page.goto(args[0], { waitUntil: "domcontentloaded" });
      await browser.close();
      break;
    }
    case "click": {
      const { browser, page } = await connect();
      await locator(page, args[0]).click({ timeout: 10000 });
      await browser.close();
      break;
    }
    case "fill": {
      const { browser, page } = await connect();
      const value = args[1].startsWith("@") ? readFileSync(args[1].slice(1), "utf8") : args[1];
      await locator(page, args[0]).fill(value, { timeout: 10000 });
      await browser.close();
      break;
    }
    case "press": {
      const { browser, page } = await connect();
      await page.keyboard.press(args[0]);
      await browser.close();
      break;
    }
    case "clickrow": {
      // Click a tree row whose .tree-label exactly matches <label> (e.g. "name",
      // "items", "[0]"). Second arg is the 0-based occurrence for repeated labels.
      const { browser, page } = await connect();
      const label = args[0];
      const occurrence = Number(args[1] ?? 0);
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const target = page
        .locator(".tree-row")
        .filter({ has: page.locator(".tree-label", { hasText: new RegExp(`^${escaped}$`) }) })
        .nth(occurrence);
      await target.click({ timeout: 10000 });
      await browser.close();
      break;
    }
    case "text": {
      const { browser, page } = await connect();
      console.log(await locator(page, args[0]).innerText({ timeout: 10000 }));
      await browser.close();
      break;
    }
    case "shot": {
      const { browser, page } = await connect();
      await page.screenshot({ path: args[0], fullPage: true });
      await browser.close();
      break;
    }
    case "aria": {
      const { browser, page } = await connect();
      writeFileSync(args[0], await page.locator("body").ariaSnapshot());
      await browser.close();
      break;
    }
    case "eval": {
      const { browser, page } = await connect();
      const run = new Function("page", `return (async () => { ${args.join(" ")} })()`);
      const result = await run(page);
      if (result !== undefined) console.log(JSON.stringify(result, null, 2));
      await browser.close();
      break;
    }
    default:
      fail(
        `unknown command "${command}". Commands: launch, stop, open, click, clickrow, fill, press, text, shot, aria, eval`,
      );
  }
};

main().catch((error) => fail(error.message));
