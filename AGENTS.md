# AGENTS.md

## Project
- There is no game server. Each player's browser runs its own copy of the engine, and moves are records in each player's PDS that the opponent's client reads.
- The chessground demo (`src/app/chessground-demo`) uses chess.js through the `game.js` adapter only for now. It will switch to `src/engine`, and the demo may be thrown away (issue #13). Keep chess.js out of other files.
- Engine code is plain JS: plain objects with separate functions, no piece classes (ADR 0003), and a 0x88 board (ADR 0002).
- See `docs/ubiquitous_language.md`.
- There are no lint or typecheck scripts yet. Use only `npm test`, `npm run build`, and `npm run dev`.
- This is a course project with a short deadline, so prefer simple solutions over new tooling.
- Never commit to `main`. Branch from an up-to-date `main`. Changes merge only through a PR with a merge commit, after approval from a different human.

## General practices
- Ask before assuming. Turn vague requirements into concrete, measurable ones and confirm them.
- Be pragmatic: simplest solution that fits (KISS, YAGNI), no premature optimization or abstraction. State trade-offs.
- Plan briefly before non-trivial work; keep plans and decisions in the repo as the single source of truth.
- Start from the user's model and the relevant "-ilities" (usability, accessibility, performance, security); say how each is verified.
- High cohesion, loose coupling; every abstraction must earn its complexity.
- Default to semantic HTML and accessibility. Performance targets: respond <100ms, 60fps, load <1s.
- Work in small increments with tests; flag tech debt you take on. Code is writing: clear names, comments explain why.
- Record significant architectural decisions as short ADRs (follow the existing ones) and keep docs in sync.
