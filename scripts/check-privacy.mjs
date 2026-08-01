import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";
const allowed = new Set([
  "https://jishnuteegala.com/privacy",
  "https://github.com/jishnuteegala/jq-pointer",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xhtml",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/XML/1998/namespace",
]);
const allowedPrefixes = ["https://react.dev/errors/", "https://bit.ly/wb-precache"];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const textExtensions = /\.(html|js|css|txt|json|svg|webmanifest)$/;
const failures = [];

for (const path of walk(dist)) {
  if (!textExtensions.test(path)) continue;
  const contents = readFileSync(path, "utf8");
  for (const match of contents.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)) {
    const url = match[0].replace(/[.,;]+$/, "");
    if (allowed.has(url)) continue;
    if (allowedPrefixes.some((prefix) => url.startsWith(prefix))) continue;
    failures.push(`${path}: ${url}`);
  }
  if (/@import\s+url|fonts\.googleapis|fonts\.gstatic|use\.typekit/.test(contents)) {
    failures.push(`${path}: external font reference`);
  }
}

const headers = readFileSync(join(dist, "_headers"), "utf8");
if (!/Content-Security-Policy:.*connect-src 'self'/.test(headers)) {
  failures.push("dist/_headers: CSP must restrict connect-src to 'self'");
}
if (!/Content-Security-Policy:.*default-src 'self'/.test(headers)) {
  failures.push("dist/_headers: CSP must restrict default-src to 'self'");
}
for (const name of ["NEL", "Report-To", "Reporting-Endpoints"]) {
  if (!new RegExp(`^[\\t ]*! ${name}[\\t ]*$`, "im").test(headers)) {
    failures.push(`dist/_headers: ${name} must be detached with "! ${name}"`);
  }
}

if (failures.length > 0) {
  console.error("Privacy check failed - off-origin references found:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("Privacy check passed: no third-party requests in the built bundle.");
