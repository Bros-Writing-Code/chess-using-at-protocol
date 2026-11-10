# ADR 0004: Unit test the chessground demo's logic and check the board by hand

- **Status:** Proposed
- **Date:** 2026-11-09
- **Deciders:** UI team
- **Related:** Issue #12, [Chessground demo spec](../specs/chessground-demo.md)

## Terminology

| Term | Meaning |
| :--- | :--- |
| **Adapter** | `game.js`, the one file that connects the UI to a chess rules library. It uses chess.js for now and the engine later. |
| **Unit test** | A Vitest test that runs a module directly in Node, with no browser. |
| **Browser test** | An automated test that drives the real page in a browser, using a tool such as Playwright. |

## Context

Issue #12 builds a demo chess UI on chessground. Issue #13 then compares it with our own board rendering, so this code may be thrown away.

The demo has two kinds of code:

1. **Logic:** the clock and the adapter. They don't touch the page. Time calculations and rule mapping are easy to get wrong and cheap to test.
2. **Page wiring:** `main.js`, the HTML, and the CSS. Chessground does the drawing and input handling, and it has its own tests.

The repo has no browser-testing tools yet, and end-to-end testing is planned as a later DevOps topic.

## Decision

- **Unit test `clock.js` and `game.js`** with Vitest. `npm test` runs them, so CI will too.
- **Don't automate tests for `main.js`, the HTML, or the CSS.**
- **Check the board by hand** in a browser, using the checklist in the spec, before merging a change to the demo.

## Consequences

**Positive**

- The tests are fast and need no new tools.
- The adapter tests carry over when the engine replaces chess.js, and they confirm the engine behaves the same way.
- We spend little time testing code that may be discarded after #13.

**Negative / trade-offs**

- CI can't catch wiring bugs in `main.js`, such as the board not updating after an en passant capture.
- The browser checklist relies on someone running it.

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| **Browser tests now** | Would catch wiring bugs, but adds a new tool and slower CI for a demo that may be discarded. |
| **Unit tests with a simulated page (jsdom)** | jsdom doesn't do layout, so board clicks and drags would mostly be mocked and prove little. |
| **Hand checks only** | Clock calculations and every game ending are slow to check by hand and cheap to unit test. |

## Open questions

- If chessground wins #13, should browser tests for the board be added as part of the end-to-end work?
