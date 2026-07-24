# jq-pointer

Paste JSON, click the value you want, get the jq expression that extracts it - the reverse of every jq playground.

## Development

Requires Node 20+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Start the dev server                  |
| `pnpm build`     | Type-check and build the static bundle |
| `pnpm lint`      | Run ESLint                            |
| `pnpm typecheck` | Run the TypeScript compiler           |
| `pnpm test`      | Run the test suite (includes the perf spike) |
| `pnpm bench`     | Run only the performance spike        |
| `pnpm check`     | lint + typecheck + test               |

## Performance spike (D7)

The spike result and the main-thread vs worker decision are documented in
[docs/perf-spike.md](docs/perf-spike.md).

## License

MIT - see [LICENSE](LICENSE)
