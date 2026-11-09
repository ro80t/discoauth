import type { components, OAuth2Scope, operations } from "./schema.auto.ts";

type Json<O extends keyof operations> = operations[O]["responses"] extends {
  200: { content: { "application/json": infer R } };
}
  ? R
  : never;

export type User = Json<"get_my_user">;
export type PartialGuild = NonNullable<Json<"list_my_guilds">>[number];
export type GuildMember = Json<"get_my_guild_member">;
export type Connection = NonNullable<Json<"list_my_connections">>[number];
export type Authorization = Json<"get_my_oauth2_authorization">;
export type ListGuildsQuery = NonNullable<operations["list_my_guilds"]["parameters"]["query"]>;
export type UserInfo = Json<"get_openid_connect_userinfo">;
export type RoleConnection = Json<"get_application_user_role_connection">;
export type UpdateRoleConnectionBody =
  operations["update_application_user_role_connection"]["requestBody"]["content"]["application/json"];
export type Entitlement = NonNullable<Json<"get_current_user_application_entitlements">>[number];
export type ListEntitlementsQuery = NonNullable<
  operations["get_current_user_application_entitlements"]["parameters"]["query"]
>;
export type AddGuildMemberBody = Omit<
  operations["add_guild_member"]["requestBody"]["content"]["application/json"],
  "access_token"
>;
export type AddGroupDMRecipientBody = Omit<
  operations["add_group_dm_user"]["requestBody"]["content"]["application/json"],
  "access_token"
>;

/** `/oauth2/token` is not part of Discord's OpenAPI spec, so this one is written by hand. */
export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
  /** Present when `scope` includes `openid`: an RS256 JWT signed by https://discord.com/api/oauth2/keys. */
  id_token?: string;
  /** Present when `scope` includes `bot`: the guild the bot was added to. */
  guild?: components["schemas"]["GuildResponse"];
  /** Present when `scope` includes `webhook.incoming`. Store `id` and `token` to execute it. */
  webhook?: components["schemas"]["ApplicationIncomingWebhookResponse"] & {
    token: string;
    url: string;
  };
};

/**
 * Any {@link OAuth2Scope} with editor completion, plus any other string so scopes Discord adds
 * before the next regeneration still type-check.
 */
export type OAuth2ScopeInput = OAuth2Scope | (string & {});

export type AuthorizeUrlOptions = {
  scope: OAuth2ScopeInput[];
  state?: string;
  /** `token` is the implicit grant: the token comes back in the redirect URL fragment, with no refresh token. */
  response_type?: "code" | "token";
  /** PKCE challenge from {@link createPKCE}; `code_challenge_method=S256` is added for you. */
  code_challenge?: string;
  prompt?: "consent" | "none";
  /** Installation context when `scope` includes `applications.commands`: 0 guild, 1 user. */
  integration_type?: 0 | 1;
  /** Bot permissions bitfield, for the `bot` scope. */
  permissions?: string | bigint;
  /** Pre-selects a guild for `bot` / `webhook.incoming`. */
  guild_id?: string;
  disable_guild_select?: boolean;
};

export type ExchangeCodeOptions = {
  /** PKCE verifier from {@link createPKCE}; required when the authorize URL had a `code_challenge`. */
  codeVerifier?: string | undefined;
};

export type RESTOptions = {
  /** Per-request timeout in ms. Default 10000. */
  timeout?: number;
  /** How many times a 429 is retried before throwing. Default 3. */
  maxRetries?: number;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
};

export type DiscordOAuth2Options = RESTOptions & {
  clientId: string;
  /** Omit for a Public Client (PKCE without a secret). */
  clientSecret?: string;
  redirectUri: string;
  /** Only needed for {@link DiscordOAuth2.joinGuild}. */
  botToken?: string;
};
