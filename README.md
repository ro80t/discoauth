# discoauth

Discord OAuth2 client with no runtime dependencies. Response types are generated from [Discord's official OpenAPI spec](https://github.com/discord/discord-api-spec), keeping only the endpoints an OAuth2 app calls.

```ts
import { avatarUrl, createPKCE, DiscordOAuth2 } from "discoauth";

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

// also: getUserInfo (openid), getGuildMember, getConnections, getEntitlements,
// get/update/deleteRoleConnection (Linked Roles), addGroupDMRecipient (gdm.join),
// clientCredentials, revokeToken

// bot / webhook.incoming: extra authorize params, and the token response carries `guild` / `webhook`
oauth.authorizeUrl({ scope: ["bot", "applications.commands"], permissions: 8n, guild_id });
const { webhook } = await oauth.exchangeCode(code); // scope: ["webhook.incoming"]
```

PKCE (S256) works with or without `clientSecret` (omit it for a Public Client). `openid` adds `id_token` to the token response; `response_type: "token"` gives the implicit grant.

```ts
const { verifier, challenge } = await createPKCE(); // keep verifier in the session
redirect(oauth.authorizeUrl({ scope: ["identify"], state, code_challenge: challenge }));
await oauth.exchangeCode(code, { codeVerifier: verifier });
```

`OAuth2Scope` covers every scope in the spec plus the documented-only ones (`identify.premium`, `sdk.social_layer`, `sdk.social_layer_presence`). Scopes used over RPC / gateway / Social SDK (`rpc.*`, `voice`, `activities.*`, `relationships.read`, ...) only need to be requested; Bearer-usable endpoints for `applications.commands.update`, `applications.commands.permissions.update` and `applications.entitlements` are typed in `oauth.rest`:

```ts
const { access_token } = await oauth.clientCredentials(["applications.commands.update"]);
await oauth.rest.request("get", "/applications/{application_id}/commands", {
  auth: `Bearer ${access_token}`,
  path: { application_id: clientId },
});
```

If Discord returns a non-2xx response, the method throws `DiscordOAuth2Error` (`status`, `body`). A 429 is retried using `retry_after`, up to `maxRetries` times (default 3).

## Typed REST

`oauth.rest` (or `new REST()`) calls any endpoint in the bundled schema with path params, query, body and response typed from the spec:

```ts
const member = await oauth.rest.request("get", "/users/@me/guilds/{guild_id}/member", {
  auth: `Bearer ${access_token}`,
  path: { guild_id: guildId },
});
```

`rest.raw(path, init)` is the untyped fallback (same timeout / 429 retry / error handling).

## Migrating from Distopia `OAuth2Controller`

| Distopia                  | here                                                     |
| ------------------------- | -------------------------------------------------------- |
| `parseCode(code)`         | `exchangeCode(code)` (snake_case token response)         |
| `resetAccessToken(rt)`    | `refreshToken(rt)`                                       |
| `fetchUserInfo(at)`       | `getUser(at)` + `avatarUrl()` / `bannerUrl()`            |
| `fetchGuilds(at)`         | `getGuilds(at, { with_counts: true })`                   |
| `joinGuild(uid, gid, at)` | `joinGuild(at, gid, uid)` → `"added"`/`"already_member"` |
| `null` on failure         | throws `DiscordOAuth2Error`                              |

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).
