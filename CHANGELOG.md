# Changelog

## [0.1.1](https://github.com/jishnuteegala/jq-pointer/compare/v0.1.0...v0.1.1) (2026-11-11)


### Features

* record docs, build, and ci commits in changelogs ([#35](https://github.com/jishnuteegala/jq-pointer/issues/35)) ([aa351bd](https://github.com/jishnuteegala/jq-pointer/commit/aa351bda5b32bb9429ced9458785bd1ab66c7cd4))


### Bug Fixes

* **deps:** upgrade vitest, vite, oxlint and oxfmt to clear security alerts ([#51](https://github.com/jishnuteegala/jq-pointer/issues/51)) ([66df33a](https://github.com/jishnuteegala/jq-pointer/commit/66df33a9b7b6be9c7c0c849c7a70b03568b3497d))
* harden bench p95 gates against GC debt and scheduler noise ([#48](https://github.com/jishnuteegala/jq-pointer/issues/48)) ([f1e4c0b](https://github.com/jishnuteegala/jq-pointer/commit/f1e4c0b29edd8589afb682683441485b869dc4a3))
* pin LF line endings via .gitattributes ([#47](https://github.com/jishnuteegala/jq-pointer/issues/47)) ([216bf32](https://github.com/jishnuteegala/jq-pointer/commit/216bf3256046a45805ced9078c848f120a45a30b))
* quality pass over released surfaces and prose ([#39](https://github.com/jishnuteegala/jq-pointer/issues/39)) ([8eed533](https://github.com/jishnuteegala/jq-pointer/commit/8eed5330c4260b78a32549d602f9a26138e120f1))


### Performance Improvements

* **path-model:** derive trace step safety from the applied step ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))
* **path-model:** share segment objects between children ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))
* **path-model:** size children arrays up front ([#55](https://github.com/jishnuteegala/jq-pointer/issues/55)) ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))
* **path-model:** trace click roots in cache-sized blocks ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))
* **path-model:** try the previous sibling's key position before scanning children ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))
* **selection:** skip the parent-hop element count when no step iterates ([5add8fc](https://github.com/jishnuteegala/jq-pointer/commit/5add8fc3643abd63378ef726b63f94d2d35b5efd))


### Documentation

* fix verify-jq-pointer map drift found in weekly pass ([#45](https://github.com/jishnuteegala/jq-pointer/issues/45)) ([e84efe6](https://github.com/jishnuteegala/jq-pointer/commit/e84efe647b283e918e7877a91e70cb13e6288b5a))


### Build System

* **deps-dev:** move workbox-build to glob 14 to clear the minimatch alert ([#52](https://github.com/jishnuteegala/jq-pointer/issues/52)) ([dac0e54](https://github.com/jishnuteegala/jq-pointer/commit/dac0e548aa15f53e1d04b898d0bd2d8cf1c49ce4))
* pin Node 24.22.2 in .node-version ([9d72e66](https://github.com/jishnuteegala/jq-pointer/commit/9d72e66a103fffe2c226ef7895b3a9f1d678db60))


### Continuous Integration

* run bench tests in a parallel job and drop the duplicate build ([#54](https://github.com/jishnuteegala/jq-pointer/issues/54)) ([29f8f25](https://github.com/jishnuteegala/jq-pointer/commit/29f8f25b4769b0836656ed0c33bcd9af0f00dd91))
* stop duplicate branch runs, keep main results, scope release caller ([#50](https://github.com/jishnuteegala/jq-pointer/issues/50)) ([9d72e66](https://github.com/jishnuteegala/jq-pointer/commit/9d72e66a103fffe2c226ef7895b3a9f1d678db60))

## 0.1.0 (2026-08-03)


### Features

* click-pair iterator generalisation with heterogeneity and live preview ([#20](https://github.com/jishnuteegala/jq-pointer/issues/20)) ([18f3d97](https://github.com/jishnuteegala/jq-pointer/commit/18f3d97ac3e711a446e0ea4edc9fc7b5edd3ea53))
* core path model and shared jq parser/printer ([#16](https://github.com/jishnuteegala/jq-pointer/issues/16)) ([afdb8c0](https://github.com/jishnuteegala/jq-pointer/commit/afdb8c0e360e36433b5446af5d060e507680bf6a)), closes [#7](https://github.com/jishnuteegala/jq-pointer/issues/7)
* input edge handling with positioned errors and format detection ([#19](https://github.com/jishnuteegala/jq-pointer/issues/19)) ([ee98405](https://github.com/jishnuteegala/jq-pointer/commit/ee98405e46cd09f929ae2f0240520e9bb8200c58)), closes [#12](https://github.com/jishnuteegala/jq-pointer/issues/12)
* multi-select object construction with chip bar and breadcrumb widening ([#21](https://github.com/jishnuteegala/jq-pointer/issues/21)) ([f9f6fc0](https://github.com/jishnuteegala/jq-pointer/commit/f9f6fc0e76f53dc001c22eedfe5bcd939428c798)), closes [#10](https://github.com/jishnuteegala/jq-pointer/issues/10)
* NDJSON mode with per-record navigation and invocation-aware copy ([#34](https://github.com/jishnuteegala/jq-pointer/issues/34)) ([69f828c](https://github.com/jishnuteegala/jq-pointer/commit/69f828c269d73db688ba4ee13a55e896b295cdfb))
* reverse-highlight mode for pasted jq expressions ([#18](https://github.com/jishnuteegala/jq-pointer/issues/18)) ([4099dab](https://github.com/jishnuteegala/jq-pointer/commit/4099dabfe0c44fe572b99fcfcf51826cabe2932a)), closes [#11](https://github.com/jishnuteegala/jq-pointer/issues/11)
* scaffold app with performance spike and CI ([#15](https://github.com/jishnuteegala/jq-pointer/issues/15)) ([ed7c3b5](https://github.com/jishnuteegala/jq-pointer/commit/ed7c3b526e7d5171f80bfec87b3a3d23b8c3d4f1)), closes [#6](https://github.com/jishnuteegala/jq-pointer/issues/6)
* ship v0.1 - footer, llms.txt, a11y baseline, design tokens, release-please, self-hosting docs ([#23](https://github.com/jishnuteegala/jq-pointer/issues/23)) ([daf78a0](https://github.com/jishnuteegala/jq-pointer/commit/daf78a036ec67e091d53ed86e5526308f20bf3d5)), closes [#14](https://github.com/jishnuteegala/jq-pointer/issues/14)
* virtualised tree view with click-to-path and copy ([#17](https://github.com/jishnuteegala/jq-pointer/issues/17)) ([245fae6](https://github.com/jishnuteegala/jq-pointer/commit/245fae64c2a14b18b75ab8659e3b3ef02692f0be)), closes [#8](https://github.com/jishnuteegala/jq-pointer/issues/8)


### Bug Fixes

* best-of-3 cold estimate for bench budget assertions ([#27](https://github.com/jishnuteegala/jq-pointer/issues/27)) ([fead906](https://github.com/jishnuteegala/jq-pointer/commit/fead906327bf04ddebfd22395c4c625453bd0331)), closes [#26](https://github.com/jishnuteegala/jq-pointer/issues/26)
* exclude release-please generated files from oxfmt ([#25](https://github.com/jishnuteegala/jq-pointer/issues/25)) ([6628127](https://github.com/jishnuteegala/jq-pointer/commit/66281270c60ef5ee60bb5874944168454390818a))
* resolve whole-spec review findings ([#30](https://github.com/jishnuteegala/jq-pointer/issues/30)) ([df14996](https://github.com/jishnuteegala/jq-pointer/commit/df1499653dc077e52327f3129eda7d2b2bebc758)), closes [#5](https://github.com/jishnuteegala/jq-pointer/issues/5) [#1](https://github.com/jishnuteegala/jq-pointer/issues/1)
