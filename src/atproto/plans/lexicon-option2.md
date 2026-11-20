# Discarded Lexicon Design: Discrete Move Records

This is another design we considered for a lexicon and ulitmately rejected, favoring a iteratively updated game record design. 

## Design

| **Record** | **Data**                                                                                       | **Purpose**                                                                            |
|------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| game       | opponent, color, optional challenge strong ref, status                                         | Represents a chess game challenge and tracks overall state information.                |
| move       | game strong ref, prev strong ref to opponent's last move, san, fen                        | Represents a single move in the chess game                                             |
| reject     | subject strong ref (points to opponent's offending move record), reason code, optional message | Represents a request for opponent to replay move because the client deemed it invalid. |

Here's what gameplay would look like in this system. The first bits work pretty much the same way:

1. Logged in player Alice wants to challenge Bob to a game of chess.
2. Alice types in Bob's handle in the frontend and clicks a button.
3. Alice's client takes the following actions:
  1. Searches for Bob's DID using his handle. Assuming it finds it... 
  2. Creates a game record with Alice as the white player, Bob as the challenged player. **(no starting board state because the game record doesn't track board state).**
  3. Creates an url that includes the AT URI for the new game record.
4. Alice sends this to Bob
5. Bob opens the link and logs into the chess app with his atproto handle
6. Bob's client... 
  1. parses the AT URI, which gives the challenger's DID + collection + rkey.
  2. resolves the challenger's DID to a PDS endpoint
  3. gets Alice's game record from that PDS
  4. Checks the `opponent` field in that record and matches it against Bob's DID. If it's not, this challenge is for someone else.
  5. If it's a match, Bob writes his own `game` record which strong refs the challenge and starts watching the challenger's repo.

Here's what's different:

7. Alice makes a move on her UI
8. The client creates a new move record with:
  1. Strong ref to her `game` record
  2. strong ref to Bob's last move
  3. SAN notation of her new move
  4. resulting FEN from her move 

For the opening move of the game, Alice would have the `prev` field of her move reference Bob's `game` record that he created to accept her challenge. Bob would verify this as part of his first move checks.
  
*(ply not necessary as a separate field since that's derivable from the FEN. The procedure is 2 x (fullmove - 1) + (1 if Black is next, otherwise 0))* 

Bob's client catches this from the Jetstream and does the following:

9.  If Alice resigned, the game ends and Bob does nothing.
10. If Alice made a move, Bob does the following checks:
  11. checks if it was Alice's turn (fail -> `wrongTurn`)
  12. checks if the game strong ref references the game Bob is currently playing (fail -> ignored, this is for a different game)
  13. checks if the prev strong ref references Bob's last move (fail -> `badPrev`)
  14. checks if Alice's move was legal (fail -> `illegalMove`)
  15. checks if Alice's FEN matches computed FEN from Alice's move + Bob's understanding of the game history up to this point (fail -> `fenMismatch`)
11. If all checks pass, Alice made a legal move. 
12. Bob makes a move on his UI.

## Tradeoffs

The difference between options 1 (the design we ended up deciding) and 2 really just comes down to where the state exists. Option 1 stores game state for each game in one unified location. Option 2 stores it across an auditable sequence of move records. My recommendation was to choose Option 1. It's a lot simpler of a design to implement, and at the end of the game you get a clear single record of the entire game in both players' repos.
