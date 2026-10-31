Hey team, here’s what we discussed this morning.

We’d like to do games, but games with hidden information or randomness would require cryptography that’s probably too complicated to get right in 5 weeks time.
So we decided to do chess, which is much easier to do on atproto because we can do fully client-side peer-to-peer gameplay without encryption. It’s possible because the starting game state is the same for every game, and all the information about the game state is public at every step.

In the google sheet linked above we started to sketch out the features that we’d want in a chess app.

This weekend, go ahead and explore. Play chess on websites like chess.com. Look for other alternatives as well. Check out checkmate.blue for the main atproto implementation. Maybe there are others? On Monday, we’ll talk about design considerations and architecture. On Tuesday, we can mob to build a skeleton of the project if we’re ready, and then we can start handing out issues etc.

If you want to use AI to slop together a mockup this weekend, do it! That’ll be a great way to explore what’s possible and what the constraints/risks are.

See you on monday, and enjoy the weekend! :jack_o_lantern:
ref: http://chess.com/