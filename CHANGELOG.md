# discoauth

## 0.1.0

### Minor Changes

- 9000ca7: Add `REST`, a typed request wrapper generated from the schema (exposed as `oauth.rest`), and new helpers: `getUserInfo`, `getEntitlements`, `getRoleConnection` / `updateRoleConnection` / `deleteRoleConnection` and `clientCredentials`. `OAuth2Scope` now includes scopes the spec only lists on operations (e.g. `applications.commands.update`).

## 0.0.1

### Patch Changes

- cb6a2e3: Split `src/index.ts` into `client.ts`, `types.ts`, `error.ts` and `cdn.ts`. Public exports are unchanged.
