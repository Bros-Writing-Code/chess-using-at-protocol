# Lexicon

Our overall design principle is to treat opponents' moves as untrusted user data. We always validate their moves on our client with the chess engine to ensure that we agree on the current state of the game.

## The Architecture: Updates to Game Records

| **Record** | **Data**                                                                                                                                   | **Purpose**                                                                                                              |
|------------|--------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `game`       | opponent DID, color, optional challenge strong ref, pgn, fen, and status (active / resigned)                                               | Tracks full game state, move history, and also acts as a challenge to another player or an acceptance of that challenge. |
| `reject`     | subject strong ref (points to opponent's offending game record update), reason code, optional message  | Exists as a request for opponent to redo their previous move after performing an illegal one.                            |

In this version of the system, the gameplay process would look like the following:

1. Logged in player Alice wants to challenge Bob to a game of chess.
2. Alice types in Bob's handle in the frontend and clicks a button.
3. Alice's client takes the following actions:
  1. Searches for Bob's DID using his handle. Assuming it finds it... 
  2. Creates a game record with a starting board state, Alice as the white player, Bob as the challenged player
  3. Creates an url that includes the AT URI for the new game record.
4. Alice sends this to Bob
5. Bob opens the link and logs into the chess app with his atproto handle
6. Bob's client... 
  1. parses the AT URI, which gives the challenger's DID + collection + rkey.
  2. resolves the challenger's DID to a PDS endpoint
  3. gets Alice's game record from that PDS
  4. Checks the `opponent` field in that record and matches it against Bob's DID. If it's not, this challenge is for someone else.
  5. If it's a match, Bob writes his own `game` record which strong refs the challenge and starts watching the challenger's repo.
7. Alice makes a move on the UI.
8. The client updates her `game` record by appending the move on the PGN notation and rewriting the FEN. 
9. Bob's client detects the update with his filtered Jetstream listener.
10. If Alice updated her status to "Resigned," the game is over and Bob takes no further actions.
11. Bob's client compares the PGN to his PGN.
  1. It checks whether it was Alice's turn. (fail -> wrongTurn)
  2. It checks whether exactly one new move was appended beyond the accepted state (fail -> badPrev)
  3. If the previous check passed, it checks the one new move that was added with the check engine (fail -> illegalMove)
  4. It computes the resulting FEN from Alice's full PGN and matches it to Alice's FEN  (fail -> badFEN)
12. Bob makes a move on the UI.

If Alice's Jetstream listener notices that Bob rejected her move while she's waiting for him to take his turn, she would ideally rectify the mistake by making another update to her game record.
- If her most recent move is an illegal move, she could just choose a different move
- If she miscomputed the FEN, she could try computing it again
- If she appended too much information to the PGN, she could fix those kinds of errors
- If Alice and Bob disagree on the history of the game up to that point, we sort of reach an unresolvable deadlock, especially if Bob keeps sending more reject records. At that point, it would be best to leave the game unfinished. We don't auto-end the game. We should only end games if there's a timeout or one of the players forfeits.
If Alice fixes her error and writes the fix to her repo, then Bob would take his turn and play would continue as normal.
