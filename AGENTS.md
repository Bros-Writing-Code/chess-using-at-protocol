# CLAUDE.md

- There is no game server. Each player's browser runs its own copy of the engine, and moves are records in each player's PDS that the opponent's client reads.
- The chessground demo (`src/app/chessground-demo`) uses chess.js through the `game.js` adapter only for now. It will switch to `src/engine`, and the demo may be thrown away (issue #13). Keep chess.js out of other files.
- Engine code is plain JS: plain objects with separate functions, no piece classes (ADR 0003), and a 0x88 board (ADR 0002).
- See `docs/ubiquitous_language.md`.
- There are no lint or typecheck scripts yet. Use only `npm test`, `npm run build`, and `npm run dev`.
- This is a course project with a short deadline, so prefer simple solutions over new tooling.
- Never commit to `main`. Branch from an up-to-date `main`. Changes merge only through a PR with a merge commit, after approval from a different human.
