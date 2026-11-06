# ATProto Chess App — Requirements

Source: Google Sheet "atproto chess app" (Sheet1). Sheet2 holds only an empty task-tracker template and is not included here.

## Overview

A chess app built on the AT Protocol (ATProto). Players sign in, invite each other to games by link, and play full chess games, with social features like records, leaderboards and friends.

The app is split into three areas:

- **UI**: what the player sees and interacts with.
- **Engine**: chess rules and game state.
- **ATProto**: identity, networking, and data shared or stored over the protocol.

Priorities use MoSCoW: **Must**, **Should**, **Could**, **Won't** (plus one item marked "Would", kept as written). Within each area, features are listed by priority.

### Size estimates

| Size | Effort |
|---|---|
| Extra Large | 10–15 hrs/week |
| Large | 8–10 hrs/week |
| Medium | 4–8 hrs/week |
| Small | 1–4 hrs/week |

## UI

| Feature | Description | Priority | Size | Hours | Tags |
|---|---|---|---|---|---|
| Board display | — | Must | Large | — | — |
| Movement highlighting | When you press on a piece, it shows the possible locations it can move to | Must | Large | 7 | Gameplay |
| Skins | — | Must | Medium | — | Gameplay |
| Resign button | — | Should | Small | — | Gameplay |
| Draw button | — | Should | Small | — | Gameplay |
| Drag-and-drop pieces | Dragging and dropping pieces to positions | Could | Large | — | — |
| Play of the game | — | Could | — | 2 | QOL |

## Engine

| Feature | Description | Priority | Size | Hours | Tags |
|---|---|---|---|---|---|
| Board logic | Includes column and row naming | Must | Small | — | Gameplay |
| Pieces | — | Must | Medium | — | Gameplay |
| Win/loss conditions | — | Must | Medium | — | Gameplay |
| Check logic | — | Must | Large | 5 | Gameplay |
| Capturing pieces | Removing someone's piece when you beat it | Must | Large | — | Gameplay |
| Pawn promotion | — | Must | Medium | — | Gameplay |
| Clock | — | Should | Small | 2 | Gameplay |
| Puzzles | — | Could | Large | 20 | Social |
| Chess bot | — | Won't | Extra Large | — | QOL, Gameplay |

## ATProto

| Feature | Description | Priority | Size | Hours | Tags |
|---|---|---|---|---|---|
| Sending data over protocol | — | Must | Extra Large | — | Auth |
| Login | — | Must | Medium | 10 | Auth |
| Invite logic | Create a game link and send it to the player you're playing with | Must | Large | — | Social |
| Game link | — | Must | Large | — | Social |
| Record (W/L) | — | Should | Medium | 10 | Social |
| Leaderboard | — | Should | Large | 8 | Social |
| Online matchmaking | — | Should | Extra Large | — | QOL |
| Chat | — | Could | Large | 10 | Social |
| Friends | — | Could | Large | 10 | Social |
| Rank titles | Just-for-fun titles (GM, IM, FM, CM) based on leaderboard position or Elo rating | Could | Medium | — | Social |
| Elo rating | (Listed as "elo?" in the sheet) | Would | Medium | 4 | Social |

## Summary by area

| Area | Features | Must | Should | Could | Would/Won't | Hours estimated |
|---|---|---|---|---|---|---|
| UI | 7 | 3 | 2 | 2 | 0 | 9 (2 of 7 features) |
| Engine | 9 | 6 | 1 | 1 | 1 | 27 (3 of 9 features) |
| ATProto | 11 | 4 | 3 | 3 | 1 | 52 (6 of 11 features) |
| **Total** | **27** | **13** | **6** | **6** | **2** | **88 (11 of 27 features)** |

## Placement notes

The sheet has no area column, so these features were placed by judgment and could reasonably go elsewhere:

- **Movement highlighting** is under UI, but it depends on the Engine producing the list of legal moves.
- **Resign / Draw buttons** are under UI. Ending the game on resign or draw is Engine work, and telling the opponent goes over ATProto.
- **Clock** is under Engine as game-state logic. It also needs a UI display and, in online play, syncing over ATProto.
- **Puzzles** are under Engine because they need move validation, though the sheet tags them Social.
- **Elo, Record, Leaderboard, Rank titles** are under ATProto because they're player data shared across users. The Elo calculation itself could live in the Engine.
- **Play of the game** is under UI as a replay/highlight view. It needs the game's move history from the Engine.

## Open items from the sheet

- Most features have no description, and 16 of 27 have no hour estimate.
- "Play of the game" has no size estimate.
- "Board display" and "Drag-and-drop pieces" have no tags.
- The Risk Analysis column is empty for every feature.
- "Elo rating" is marked "Would", which isn't a standard MoSCoW level. It probably means Could or Won't.
- "Skins" is marked Must, which is unusual for a cosmetic feature. Worth confirming with the team.
- "Rank titles" depend on the Leaderboard (Should) or Elo (Would), so they can't ship before one of those.
