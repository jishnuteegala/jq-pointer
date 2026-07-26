# Product

## Register

product

## Platform

web

## Users

Developers and data engineers working with unfamiliar JSON who know roughly what value they want but not the jq expression that reaches it. They arrive with a document in hand (pasted text, a clipboard blob, or a dropped file) and need the path fast, mid-task, without leaving for documentation. The whole session lives in a single browser tab and runs fully client-side; nothing is uploaded.

## Product Purpose

jq-pointer inverts the jq playground. Instead of writing an expression and checking what it matches, you paste JSON, click the value you want, and it hands you the jq expression that extracts it. Clicking a second sibling generalises the path (widening `.items[0].name` toward `.items[].name`), a breadcrumb lets you widen to an ancestor, and a filter box highlights every node a given jq expression matches. Success is a correct, copyable expression produced in seconds, verified against the real jq grammar rather than guessed.

## Positioning

The reverse of every jq playground: point at the value, get the path, instead of writing the path to find the value.

## Brand Personality

Precise, quiet, and trustworthy. The voice is a competent developer tool that states exactly what it does and what it inherits ("last duplicate key wins", "numbers beyond IEEE 754 lose precision") without apology or marketing gloss. Errors are specific and located, never vague. The interface should feel like a well-made instrument: confident, legible, and out of the way.

## Anti-references

Not a marketing landing page dressed as a tool: no hero metrics, no feature-card grids, no gradient-text headlines, no tracked-uppercase eyebrow above every section. Not a heavy IDE or a settings-laden dashboard. Not a playground that makes you write the expression first.

## Design Principles

Show the answer, don't explain it: the path appears the instant you click, and copying it is one action away.

Speak plainly and precisely: labels, errors, and notes name the exact situation ("matches 3 of 12 elements", "No common pattern between these clicks") in the user's own vocabulary.

Stay out of the way: a single narrow column, flat surfaces at rest, colour reserved for the one accent and for genuine state (selection, success, danger).

Correct by construction: expressions are derived from a real model of the document and checked against jq's grammar, not string-assembled.

Honour the platform: keyboard-navigable tree, visible focus, reduced-motion and coarse-pointer accommodations, automatic light/dark.

## Accessibility & Inclusion

Keyboard-operable throughout with a skip link and visible `:focus-visible` outlines; live regions announce the path, filter status, and match notes. Interactive controls meet a 44px tap target, enlarged further under coarse pointers. All motion is gated behind `prefers-reduced-motion: no-preference`, and the full palette flips automatically under `prefers-color-scheme: dark`.
