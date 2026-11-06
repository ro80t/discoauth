# discoauth

Discord OAuth2 client with no runtime dependencies. Response types are generated from [Discord's official OpenAPI spec](https://github.com/discord/discord-api-spec), keeping only the endpoints an OAuth2 app calls.

```ts
import { avatarUrl, DiscordOAuth2 } from "discoauth";

const oauth = new DiscordOAuth2({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: "https://example.com/auth",
  botToken: process.env.DISCORD_TOKEN, // only for joinGuild
});

// /login
const state = crypto.randomUUID(); // store in a cookie / session
redirect(oauth.authorizeUrl({ scope: ["identify", "email", "guilds", "guilds.join"], state }));

// /auth?code=...&state=...  (check state first)
const { access_token, refresh_token } = await oauth.exchangeCode(code);
const user = await oauth.getUser(access_token);
avatarUrl(user, 256);
await oauth.getGuilds(access_token, { with_counts: true });
await oauth.joinGuild(access_token, guildId, user.id); // "added" | "already_member"
await oauth.refreshToken(refresh_token);
```

If Discord returns a non-2xx response, the method throws `DiscordOAuth2Error` (`status`, `body`). A 429 is retried using `retry_after`, up to `maxRetries` times (default 3).

## Migrating from Distopia `OAuth2Controller`

| Distopia                  | here                                                     |
| ------------------------- | -------------------------------------------------------- |
| `parseCode(code)`         | `exchangeCode(code)` (snake_case token response)         |
| `resetAccessToken(rt)`    | `refreshToken(rt)`                                       |
| `fetchUserInfo(at)`       | `getUser(at)` + `avatarUrl()` / `bannerUrl()`            |
| `fetchGuilds(at)`         | `getGuilds(at, { with_counts: true })`                   |
| `joinGuild(uid, gid, at)` | `joinGuild(at, gid, uid)` → `"added"`/`"already_member"` |
| `null` on failure         | throws `DiscordOAuth2Error`                              |

## Development

```sh
bun install
bun run generate   # re-fetch the Discord spec -> src/schema.auto.ts
bun run test       # vitest
bun run lint       # oxfmt --check && oxlint
bun run typecheck
bun run build      # tsdown -> dist (esm + cjs + d.ts)
```

To add an endpoint, add it to `KEEP` in `scripts/generate.ts`.

## Release

1. Run `bunx changeset` in your PR to record the change and bump type.
2. Once it lands on `main`, CI opens a "Version Packages" PR (version bump + CHANGELOG).
3. Merging that PR publishes to npm (Trusted Publishing + provenance), pushes the tag and creates a GitHub release.
