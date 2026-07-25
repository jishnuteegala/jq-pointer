# Corpus provenance

Ten pinned documents for the first-click-pair acceptance corpus, per issue #3.

| # | Fixture | Source | Fetched / constructed |
|---|---------|--------|-----------------------|
| 1 | `01-github-repo-list.json` | https://api.github.com/users/octocat/repos?per_page=3 (live snapshot) | Fetched 2026-07-25 |
| 2 | `02-github-issues-list.json` | https://api.github.com/repos/octocat/Hello-World/issues?per_page=3&state=all (live snapshot) | Fetched 2026-07-25 |
| 3 | `03-stripe-charges-list.json` | Response example on https://docs.stripe.com/api/charges/list, copied verbatim | Fetched 2026-07-25 |
| 4 | `04-stripe-customer.json` | Object example on https://docs.stripe.com/api/customers/object, copied verbatim | Fetched 2026-07-25 |
| 5 | `05-k8s-pod.json` | https://raw.githubusercontent.com/kubernetes/kubernetes/master/staging/src/k8s.io/api/testdata/HEAD/core.v1.Pod.json | Fetched 2026-07-25 |
| 6 | `06-k8s-pod-list.json` | Constructed: PodList envelope with 3 trimmed pods, dotted/slashed annotation keys, per issue #3 shape | Constructed 2026-07-25 |
| 7 | `07-k8s-deployment.json` | https://raw.githubusercontent.com/kubernetes/kubernetes/master/staging/src/k8s.io/api/testdata/HEAD/apps.v1.Deployment.json | Fetched 2026-07-25 |
| 8 | `08-heterogeneous-array.json` | Constructed: `events` array with disjoint key sets and mixed scalar/object/null elements, per issue #3 shape | Constructed 2026-07-25 |
| 9 | `09-quoted-unicode-keys.json` | Constructed: keys with spaces, slashes, tildes, quotes, non-ASCII, surrogate-pair emoji, empty-string key, per issue #3 shape | Constructed 2026-07-25 |
| 10 | `10-scalars-deep-nesting.json` | Constructed: duplicate scalar values, empty string element, 8+ nesting levels, mixed scalar types, per issue #3 shape | Constructed 2026-07-25 |
