# ADR 0007: Accessibility target and automated checks with pa11y-ci

- **Status:** Proposed
- **Date:** 2026-11-19
- **Deciders:** CICD team
- **Related:** [Deployment](../deployment.md), `.pa11yci.cjs`, `scripts/a11y.js`

## Context

AGENTS.md makes semantic HTML and accessibility the default, but nothing checks for accessibility.

Automated tools only find part of the problem. pa11y-ci's README says passing its checks "does not guarantee that your site is accessible." They're good at catching regressions in what they can measure: contrast, missing labels, invalid ARIA, duplicate IDs. Accessibility checks beyond pa11y are necessary.

## Decision

### Target

- WCAG 2 level AA. WCAG's rules come in three levels, each including the one before. A is the bare minimum, without which some people can't use the page at all. AA adds common needs, like 4.5:1 text contrast and text that still works at 200% zoom, and is the level most laws and policies require. AAA is the strictest, and W3C doesn't recommend requiring it for whole sites because some content can't meet it.
- Out of scope for this project: playing the game with only a keyboard or with a screen reader. Chessground's board is built for mouse and touch, and making it fully operable without them is a project of its own.

### Automated checks with pa11y-ci

- `pa11y-ci` 5.0.0, pinned, runs both rule engines (axe-core and HTML_CodeSniffer) against WCAG 2 AA.
- The `a11y` job in `ci.yaml` runs on every PR and every push to `main`. It builds the site with `SITE_URL`, then runs `npm run a11y`.
- `scripts/a11y.js` starts Vite's preview server and pa11y-ci in one process, so pa11y starts only once the server is listening.
- `.pa11yci.cjs` builds the URLs from `SITE_URL` with the same rule as `vite.config.js`, so they always match where the site is served.
- CI uses the Chrome already installed on GitHub's runners instead of downloading one on every `npm ci`.
- Chrome's sandbox stays on. If it can't start on the runners, add `--no-sandbox` to `chromeLaunchConfig` with a comment saying why.

### Rollout

1. **Report only (now).** The job shows a red check when it finds errors, but it isn't required, and `deploy` doesn't wait for it.
2. **Required (~week).** An admin adds `a11y` to the required checks, and `a11y` is added to `deploy`'s `needs:`.

### Plans moving forward

- Add each new screen to `urls` in `.pa11yci.cjs` when it ships. Screens behind login need a test account, which is undecided (see open questions).
- Before demos and milestones, check by hand what automation can't: the page at 200% zoom, and that colour is never the only way information is shown (check, last move, whose turn it is).
- axe-core inside Playwright tests: full scripting (play moves, open dialogs, then check), but it adds a new test framework. Only worth revisiting if the app grows many interactive states.

## Consequences

**Positive**

- Contrast, labelling and ARIA regressions are caught on the PR that introduces them.
- The same command runs locally and in CI: `npm run build && npm run a11y`.
- No new service or account. It's one devDependency and one job.

**Negative**

- The first `npm install` on each machine downloads about 150 MB of Chrome for Puppeteer.
- `.pa11yci.cjs` is the repo's only CommonJS file, and ESLint doesn't check it.
- Until the check becomes required, a red `a11y` check on every PR is expected and can be ignored.

## Open questions

- Ignore the duplicate-`id` rule? It checks WCAG 4.1.1 Parsing, which WCAG 2.2 removed, and the duplicate comes from chessground rather than our code.
- How should CI log in to check screens behind login, without putting real credentials in the repo?
