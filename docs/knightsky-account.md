# knightsky.app Account Information

James owns the `knightsky.app` domain, registered through AWS Route 53 until 2027-11-16. It is also the handle of the project's atproto account, [@knightsky.app](https://bsky.app/profile/knightsky.app) (DID `did:plc:4jwu5r3kihk5btmr7nqtvt2r`), hosted on Bluesky's PDS. Ask James if you need access.

## DNS records

Both TXT records live in Route 53. Don't delete them.

| Name                     | Value                                    | Purpose                                        |
|--------------------------|------------------------------------------|------------------------------------------------|
| `_atproto.knightsky.app` | `"did=did:plc:4jwu5r3kihk5btmr7nqtvt2r"` | Verifies the `knightsky.app` handle            |
| `_lexicon.knightsky.app` | `"did=did:plc:4jwu5r3kihk5btmr7nqtvt2r"` | Points `app.knightsky.*` NSIDs at this account |

## Lexicons

The [account repo](https://pdsls.dev/at://did:plc:4jwu5r3kihk5btmr7nqtvt2r/com.atproto.lexicon.schema) holds the published `app.knightsky.game` and `app.knightsky.reject` schemas as `com.atproto.lexicon.schema` records, keyed by NSID. After changing a file in `src/atproto/lexicons/app/knightsky/`, republish by running this zsh script from the repo root. It needs `curl` and `jq`, plus an app password for the account (ask James).

Published schemas should only change in backwards-compatible ways, such as adding optional fields. Don't rename, remove, or tighten existing fields.

```zsh
PDS=https://discina.us-west.host.bsky.network
DID=did:plc:4jwu5r3kihk5btmr7nqtvt2r
read -s "APP_PW?App password: "; echo

JWT=$(curl -s -X POST "$PDS/xrpc/com.atproto.server.createSession" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$DID\",\"password\":\"$APP_PW\"}" | jq -r .accessJwt)

for f in src/atproto/lexicons/app/knightsky/*.json; do
  NSID=$(jq -r .id "$f")
  jq -n --arg repo "$DID" --arg rkey "$NSID" --slurpfile rec "$f" \
    '{repo:$repo, collection:"com.atproto.lexicon.schema", rkey:$rkey,
      record:($rec[0] + {"$type":"com.atproto.lexicon.schema"})}' |
  curl -s -X POST "$PDS/xrpc/com.atproto.repo.putRecord" \
    -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' -d @-
  echo
done
unset APP_PW JWT
```

Each record should print a `{"uri":"at://...","cid":"..."}` line. `null` or an auth error means the login failed.
