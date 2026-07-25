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

## License

MIT - see [LICENSE](LICENSE)
