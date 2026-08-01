# jq-pointer

Paste JSON, click the value you want, get the jq expression that extracts it - the reverse of every jq playground.

## Development

Requires Node 20.19+ (or 22.12+) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start the dev server                         |
| `pnpm build`        | Type-check and build the static bundle       |
| `pnpm lint`         | Run oxlint                                   |
| `pnpm format`       | Check formatting with oxfmt                  |
| `pnpm format:write` | Format the tree with oxfmt                   |
| `pnpm typecheck`    | Run the TypeScript compiler                  |
| `pnpm test`         | Run the test suite (includes the perf spike) |
| `pnpm bench`        | Run only the performance spike               |
| `pnpm check`        | lint + format + typecheck + test             |

## Input handling

Parsing is strict `JSON.parse` only - there is no tolerant repair. Invalid input
shows a positioned error with a caret excerpt of the offending line. NDJSON
pastes and JavaScript-literal pastes (trailing commas, single quotes, unquoted
keys) are detected heuristically and named in the error message without any
repair.

Two `JSON.parse` behaviours are inherited deliberately and produce no warning:

- **Duplicate keys:** the last occurrence wins (`{"a": 1, "a": 2}` parses as
  `{"a": 2}`).
- **Number precision:** numbers beyond IEEE 754 double precision lose
  precision (`9007199254740993` parses as `9007199254740992`).

## Performance spike (D7)

The spike result and the main-thread vs worker decision are documented in
[docs/perf-spike.md](docs/perf-spike.md).

## jq oracle

Grammar property tests use the official [jq 1.7.1](https://github.com/jqlang/jq/releases/tag/jq-1.7.1)
Linux AMD64 binary as a pinned oracle. CI downloads it as `jq-1.7.1`; the oracle
tests skip on Windows because that binary cannot execute locally.

## Self-hosting

Deploy from a tagged release, not an arbitrary commit. Every GitHub Release
carries a prebuilt static dist archive (`jq-pointer-<version>.zip` and
`.tar.gz`) plus a `SHA256SUMS` file.

### 1. Download and verify

```sh
VERSION=0.1.0
curl -fLO "https://github.com/jishnuteegala/jq-pointer/releases/download/v$VERSION/jq-pointer-$VERSION.tar.gz"
curl -fLO "https://github.com/jishnuteegala/jq-pointer/releases/download/v$VERSION/SHA256SUMS"
sha256sum --check --ignore-missing SHA256SUMS
mkdir -p dist && tar -xzf "jq-pointer-$VERSION.tar.gz" -C dist
```

The app is a single static page plus real static routes (`/design-system/`,
`/llms.txt`); any static file server works with no rewrite rules required.

### 2. Pick a host

**Cloudflare Pages**

```sh
npx wrangler pages deploy dist --project-name jq-pointer
```

Or use git integration: import the repo in the Cloudflare dashboard with build
command `pnpm build` and output directory `dist`. The bundled `_headers` file
sets the security headers automatically.

**Vercel**

```sh
npx vercel deploy dist --prod
```

**Netlify**

```sh
npx netlify-cli deploy --dir dist --prod
```

Or drag-and-drop the `dist` folder onto the Netlify dashboard's deploy area.
Netlify reads the bundled `_headers` file too and applies the security headers;
the Cloudflare-specific `! Header` detach lines in it are ignored there.

**GitHub Pages**

```sh
git checkout --orphan gh-pages && git rm -rf . && cp -r dist/. . && rm -rf dist
git add -A && git commit -m "deploy" && git push -f origin gh-pages
```

Then enable Pages for the `gh-pages` branch in the repo settings.

**VPS with nginx** (any cloud - AWS/GCP/Azure/other)

```nginx
server {
    listen 80;
    server_name jq.example.com;
    root /var/www/jq-pointer;
    index index.html;
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Copy the extracted `dist/` to `/var/www/jq-pointer` and reload nginx.

**VPS with Caddy**

```caddy
jq.example.com {
    root * /var/www/jq-pointer
    file_server
}
```

**Docker**

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
```

```sh
docker build -t jq-pointer . && docker run -p 8080:80 jq-pointer
```

Or with compose, no image build needed:

```yaml
services:
  jq-pointer:
    image: nginx:alpine
    volumes:
      - ./dist:/usr/share/nginx/html:ro
    ports:
      - "8080:80"
```

## Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please):
merging the release PR tags the version, and the release stays a draft until
the dist archives are built, checksummed, and uploaded.

## License

MIT - see [LICENSE](LICENSE)
