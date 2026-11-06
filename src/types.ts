import type { OAuth2Scope, operations } from "./schema.auto.ts";

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

/** `/oauth2/token` is not part of Discord's OpenAPI spec, so this one is written by hand. */
export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type AuthorizeUrlOptions = {
  scope: OAuth2Scope[];
  state?: string;
  prompt?: "consent" | "none";
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
  clientSecret: string;
  redirectUri: string;
  /** Only needed for {@link DiscordOAuth2.joinGuild}. */
  botToken?: string;
};
