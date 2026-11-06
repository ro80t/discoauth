---
"discoauth": minor
---

Add `REST`, a typed request wrapper generated from the schema (exposed as `oauth.rest`), and new helpers: `getUserInfo`, `getEntitlements`, `getRoleConnection` / `updateRoleConnection` / `deleteRoleConnection` and `clientCredentials`. `OAuth2Scope` now includes scopes the spec only lists on operations (e.g. `applications.commands.update`).
