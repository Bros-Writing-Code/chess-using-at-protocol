---
name: merge
description: >-
  Merge requested changes in Bros-Writing-Code/chess-using-at-protocol through
  a GitHub pull request into main, after another user's approval and all
  applicable verification. Invoke only when the user explicitly requests merging
  or landing changes, including /merge; not for review, preparation, passing
  checks, or skill installation alone.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Merge

## Scope and authorization

This workflow applies only to `Bros-Writing-Code/chess-using-at-protocol`.
Use a GitHub pull request targeting `main`, followed by a merge commit.
Never push directly to `main`, even when repository settings allow it.

An explicit merge request, including `/merge`, authorizes the normal preparation,
feature-branch publication, pull request creation, and eventual merge of the
requested change. Proceed without asking for the same authorization again. Do
not respond to `/merge` by saying an explicit merge request is still needed.
Stop only for genuine blockers, unsafe operations, or unresolved scope.

A different human GitHub user must approve the final revision before it merges.
This is project policy even when GitHub does not enforce a review requirement.
Tests, self-review, administrator privileges, and permission to publish a branch
are not substitutes for that approval.

**Conflict preference: pause on every conflict.** Do not resolve even an apparently
obvious conflict automatically. Report the files and operation involved, state
that the change has not merged, and wait for the user's decision. Do not choose
ours/theirs, edit conflict markers, or continue the conflicted operation yourself.

## 1. Establish the exact change and destination

- Read current applicable `AGENT.md`/`AGENTS.md`, contribution policies, submission
  templates, and relevant specifications before acting. Honor any applicable
  signing, contributor agreement, authorship, review, test, documentation,
  changelog, or submission requirements, including their conditions and exceptions.
  Obtain human-authored text if policy requires it; approval of generated text is
  not equivalent. Do not repeat requirements already satisfied for this revision.
- Inspect `git --no-optional-locks status --short --branch`, the current branch,
  `git remote -v`, recent commits, and staged, unstaged, and untracked changes.
  Determine both the uncommitted work and existing branch commits included by
  the request. Inspect the complete difference from `origin/main`, not just the
  latest commit. Ask only if the intended scope remains ambiguous.
- Verify `origin` actually points to the intended GitHub repository. The `local`
  remote is a source-checkout backlink, not a publication destination. Stop on a
  repository mismatch rather than publishing elsewhere.
- Check the availability of Git, Node, npm, and `gh`, Git identity, signing
  configuration, and GitHub authentication without reading or printing secrets.
  `gh api user --jq .login` identifies the acting GitHub account. Use that account
  when checking review independence. Do not install tools or modify authentication
  automatically; report missing prerequisites.
- Inspect current GitHub settings using `gh api` for
  `repos/Bros-Writing-Code/chess-using-at-protocol`,
  `repos/Bros-Writing-Code/chess-using-at-protocol/branches/main`, and
  `repos/Bros-Writing-Code/chess-using-at-protocol/rules/branches/main`.
  Inspect applicable ruleset and branch-protection details as needed. Confirm the
  destination and merge-commit support, required reviews, required checks or
  workflows, signing requirements, and any queue requirements. Repository settings
  may change; historical merge commits are not proof of present requirements.
  Keep the independent-review policy above even if effective rules are empty.
  If merge commits are no longer supported or a queue changes this workflow, stop
  and report the incompatible requirement rather than silently choosing a method.

## 2. Prepare only the requested work

- Preserve unrelated edits, files, commits, and branches. Do not use a blanket
  `git add .`, automatic stash, destructive reset, clean, forced checkout, history
  rewrite, or force push. If unrelated work prevents safe preparation or testing,
  stop and explain what must be separated; do not hide or discard it.
- Work on a feature branch, never `main`. Reuse the change's existing feature
  branch when appropriate. If a new branch is needed, choose a descriptive unused
  name and create it without overwriting an existing branch. Include only the
  intended commits; stop if the branch also contains unrelated history that cannot
  be safely excluded without further direction.
- Review the selected diff and run `git diff --check`. Stage only the agreed paths
  or hunks, inspect the staged diff, and create any necessary commits using
  `GIT_EDITOR=true git commit -m "<descriptive message>"`. Use accurate, concise
  commit messages; no mandatory Conventional Commits format was established.
  Preserve configured signing and hooks rather than bypassing them. Reference
  real issues only when relevant, and use closing keywords only when intended.
- Fetch `origin` and compare the branch with the latest `origin/main`. Before
  verification, bring in any missing destination commits with
  `GIT_EDITOR=true git merge --no-edit origin/main`, only with a safe working tree.
  Do not rebase published history. If this produces any conflict, pause under the
  conflict policy above. A new merge commit also invalidates earlier review and
  check evidence for the previous head.

## 3. Verify the final revision

Inspect the current manifest and lockfile, not just the installed executables.
`package.json` has no project-wide Node engine declaration; the inspected Vite 5
and Vitest 2 packages declare `^18.0.0 || >=20.0.0`. Check the actual locked
dependency engines at execution time and use a compatible runtime for all relevant
dependencies rather than assuming that any Node 18+ version is sufficient.

Repository commands and their sources:

| When | Command | Repository-relative source establishing the invocation |
| --- | --- | --- |
| Dependencies are absent or do not match the selected lockfile | `npm ci` | `package.json` and `package-lock.json`: npm manifest and committed dependency lock; install from the lock without updating it. |
| Code, tests, schemas, dependencies, or executable configuration change | `npm test` | `package.json`, `scripts.test`: `vitest run`; tests live under `src/engine/testing/`, `src/app/chessground-demo/testing/`, and `src/atproto/testing/` when present. |
| Demo code, assets, relevant dependencies, or build behavior change | `npm run build` | `package.json`, `scripts.build`: `vite build src/app/chessground-demo`. |
| A demo change requires browser verification | `npm run dev` | `package.json`, `scripts.dev`: `vite src/app/chessground-demo`; `docs/specs/chessground-demo.md`, Testing / Browser checklist. |

- Run the full non-watch `npm test` for the applicable changes above. The project
  has no verified lint or typecheck script; do not invent one. Keep local checks
  proportional: documentation-only changes do not require runtime tests or a
  build unless they alter executable behavior or current policy says otherwise.
  Inspect their diff, links, and any applicable submission requirements instead.
- For demo changes, complete the browser checklist in
  `docs/specs/chessground-demo.md` and follow
  `docs/adr/0004-chessground-demo-testing.md`. It covers initial position and
  clocks, legal/illegal moves, turn handling, castling, en passant, promotion,
  check, checkmate, repetition, timeout, background-tab timing, and New Game.
  Start the verified dev command as a background service, not an unbounded
  foreground terminal. Stop services you start when finished. Restore the
  checklist's temporary timeout edit before proceeding; never commit test-only
  configuration changes. If browser access is unavailable, obtain a human's
  completed checklist for the final demo revision. Do not claim a build or unit
  test substitutes for the browser check, and do not add browser-test tooling
  solely to bypass this requirement.
- Record the tested head SHA, destination SHA, commands, outcomes, and any required
  manual evidence. Recheck the diff and ensure no generated files, dependency
  updates, temporary test edits, or unrelated changes entered the proposed commit.
  A failing check is a blocker, not permission to skip it or weaken its assertions.

## 4. Publish the feature branch and obtain independent review

- Push only the selected feature branch to `origin`, using an explicit branch
  refspec and no force option. Never publish secrets or unrelated changes.
- Look for an existing pull request for this exact head branch and repository
  with `gh pr list --repo Bros-Writing-Code/chess-using-at-protocol --head
  "<branch>" --state open`. Reuse the correct request and confirm its base is
  `main`; stop if an existing request's scope or target is incompatible.
- If none exists, create one non-interactively with
  `gh pr create --repo Bros-Writing-Code/chess-using-at-protocol --base main
  --head "<branch>" --title "<title>" --body "<body>"`.
  Supply both title and body, summarize the real change and verification, and
  honor any current template or human-authorship policy. Do not auto-close an
  issue without a factual basis. Do not invent a reviewer identity; request a
  known appropriate reviewer when available, otherwise report the review blocker
  with the pull request URL.
- Require an approving review from another human GitHub user, distinct from the
  pull request author and the acting submitting/merging account. Inspect current
  reviews through `gh api --paginate
  repos/Bros-Writing-Code/chess-using-at-protocol/pulls/<number>/reviews` and the
  pull request's current head SHA. The approval must reference that exact head,
  remain undismissed, and not be superseded by that reviewer's later change
  request. A comment is not approval. Do not approve your own pull request or
  bypass missing approval. New commits require renewed independent review,
  even if GitHub retains the old approval.
- Satisfy all additional applicable review and discussion-resolution requirements.
  Do not merge over unresolved change requests. If review is missing, state that
  the changes have not merged and identify the outstanding review, rather than
  reporting publication as completion or waiting indefinitely in a terminal.

## 5. Gate and perform the merge

- Immediately before merging, reread the pull request, exact head SHA, destination
  SHA, effective branch rules, mergeability, required reviews, and check results.
  Use `gh pr view <number> --repo Bros-Writing-Code/chess-using-at-protocol --json
  headRefOid,baseRefName,state,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup`
  alongside current REST review and rules data as needed.
- Verify **all required checks have passed for the exact changes being merged**,
  using the revision or merge-result revision required by repository policy.
  `gh pr checks <number> --repo Bros-Writing-Code/chess-using-at-protocol --required`
  is supported by the inspected CLI. Cross-check it against the actual required
  contexts, apps, and workflows and their revision-specific results. An empty
  rollup, a nonzero command exit, or a missing check is not proof of success.
  Pending, failing, cancelled, missing, or unverifiable required checks block
  merging. Treat skipped/neutral results as satisfying a requirement only when
  the destination's rules explicitly accept them.
- At setup there were no GitHub Actions workflows and no effective rules for
  `main`. Do not assume this remains true, nor assume the ADR's mention of CI
  means CI exists. If current rules and repository configuration verifiably have
  no required remote checks, record that fact and use the applicable successful
  local checks plus mandatory independent review. Local checks never replace a
  remote check that is required but unavailable.
- If the head changed, repeat affected verification and obtain approval for the
  new head. If `main` advanced since the tested integration, update the feature
  branch safely, repeat verification, publish it, and obtain renewed review.
  If mergeability is conflicted, pause on the conflict; if unknown, obtain a
  definitive result or report that it cannot yet be verified.
- Once the exact head is approved, verified, ready, and mergeable, perform the
  actual merge using
  `gh pr merge <number> --repo Bros-Writing-Code/chess-using-at-protocol --merge
  --match-head-commit "<verified-head-sha>"`.
  Use no administrator bypass, auto-merge, or branch-deletion option. Do not
  substitute a direct push or squash/rebase strategy if this fails. Report the
  real blocker; no extra routine permission prompt is needed.

## 6. Confirm the destination and preserve the workspace

- Verify GitHub reports the pull request as merged and obtain its merge commit
  using `gh pr view <number> --repo Bros-Writing-Code/chess-using-at-protocol
  --json state,mergedAt,mergeCommit,url`.
- Fetch `origin` again and confirm the reported merge commit is an ancestor of
  `origin/main`, using `git merge-base --is-ancestor <merge-sha> origin/main`.
  Publication, approval, starting checks, or an accepted merge request alone is
  not successful completion. If destination verification fails, report the
  observed GitHub state and the unverified destination rather than guessing.
- Leave feature branches intact and do not switch, reset, or rewrite a local
  `main` checkout. Inspect final workspace status and preserve all unrelated work.
  Report the pull request, merge commit, destination, verification actually run,
  and any checks intentionally not applicable. If a blocker prevented the merge,
  explicitly state that the changes have not merged and what remains necessary.
