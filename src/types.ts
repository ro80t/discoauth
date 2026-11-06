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

export type DiscordOAuth2Options = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Only needed for {@link DiscordOAuth2.joinGuild}. */
  botToken?: string;
  /** Per-request timeout in ms. Default 10000. */
  timeout?: number;
  /** How many times a 429 is retried before throwing. Default 3. */
  maxRetries?: number;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
};
