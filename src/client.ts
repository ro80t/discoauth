import { REST } from "./rest.ts";
import type {
  AddGroupDMRecipientBody,
  AddGuildMemberBody,
  Authorization,
  AuthorizeUrlOptions,
  Connection,
  DiscordOAuth2Options,
  Entitlement,
  GuildMember,
  ListEntitlementsQuery,
  ListGuildsQuery,
  OAuth2ScopeInput,
  PartialGuild,
  RoleConnection,
  TokenResponse,
  UpdateRoleConnectionBody,
  User,
  UserInfo,
} from "./types.ts";

export class DiscordOAuth2 {
  readonly #options: DiscordOAuth2Options;
  /** Typed access to every endpoint in the schema, for anything the helpers below don't cover. */
  readonly rest: REST;

  constructor(options: DiscordOAuth2Options) {
    this.#options = options;
    this.rest = new REST(options);
  }

  authorizeUrl({ scope, ...rest }: AuthorizeUrlOptions): string {
    const params = new URLSearchParams({
      client_id: this.#options.clientId,
      response_type: "code",
      redirect_uri: this.#options.redirectUri,
      scope: scope.join(" "),
    });
    for (const [key, value] of Object.entries(rest))
      if (value !== undefined) params.set(key, String(value));
    return `https://discord.com/oauth2/authorize?${params}`;
  }

  exchangeCode(code: string): Promise<TokenResponse> {
    return this.#token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.#options.redirectUri,
    });
  }

  refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.#token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  /** Token for the app's own (bot owner's) account; no refresh token is issued. */
  clientCredentials(scope: OAuth2ScopeInput[]): Promise<Omit<TokenResponse, "refresh_token">> {
    return this.#token({ grant_type: "client_credentials", scope: scope.join(" ") });
  }

  async revokeToken(
    token: string,
    tokenTypeHint: "access_token" | "refresh_token" = "access_token",
  ): Promise<void> {
    await this.rest.raw("/oauth2/token/revoke", {
      method: "POST",
      body: this.#form({ token, token_type_hint: tokenTypeHint }),
    });
  }

  getAuthorization(accessToken: string): Promise<Authorization> {
    return this.rest.request("get", "/oauth2/@me", { auth: `Bearer ${accessToken}` });
  }

  /** Requires `identify` (and `email` for the email field). */
  getUser(accessToken: string): Promise<User> {
    return this.rest.request("get", "/users/@me", { auth: `Bearer ${accessToken}` });
  }

  /** OpenID Connect userinfo. Requires `openid`. */
  getUserInfo(accessToken: string): Promise<UserInfo> {
    return this.rest.request("get", "/oauth2/userinfo", { auth: `Bearer ${accessToken}` });
  }

  /** Requires `guilds`. */
  getGuilds(accessToken: string, query: ListGuildsQuery = {}): Promise<PartialGuild[]> {
    return this.rest.request("get", "/users/@me/guilds", {
      auth: `Bearer ${accessToken}`,
      query,
    }) as Promise<PartialGuild[]>;
  }

  /** Requires `guilds.members.read`. */
  getGuildMember(accessToken: string, guildId: string): Promise<GuildMember> {
    return this.rest.request("get", "/users/@me/guilds/{guild_id}/member", {
      auth: `Bearer ${accessToken}`,
      path: { guild_id: guildId },
    });
  }

  /** Requires `connections`. */
  getConnections(accessToken: string): Promise<Connection[]> {
    return this.rest.request("get", "/users/@me/connections", {
      auth: `Bearer ${accessToken}`,
    }) as Promise<Connection[]>;
  }

  /** The user's entitlements for this app. */
  getEntitlements(accessToken: string, query: ListEntitlementsQuery = {}): Promise<Entitlement[]> {
    return this.rest.request("get", "/users/@me/applications/{application_id}/entitlements", {
      auth: `Bearer ${accessToken}`,
      path: { application_id: this.#options.clientId },
      query,
    }) as Promise<Entitlement[]>;
  }

  /** Linked Roles metadata for this app. Requires `role_connections.write`. */
  getRoleConnection(accessToken: string): Promise<RoleConnection> {
    return this.rest.request("get", "/users/@me/applications/{application_id}/role-connection", {
      auth: `Bearer ${accessToken}`,
      path: { application_id: this.#options.clientId },
    });
  }

  /** Requires `role_connections.write`. */
  updateRoleConnection(
    accessToken: string,
    body: UpdateRoleConnectionBody,
  ): Promise<RoleConnection> {
    return this.rest.request("put", "/users/@me/applications/{application_id}/role-connection", {
      auth: `Bearer ${accessToken}`,
      path: { application_id: this.#options.clientId },
      body,
    });
  }

  /** Requires `role_connections.write`. */
  deleteRoleConnection(accessToken: string): Promise<void> {
    return this.rest.request("delete", "/users/@me/applications/{application_id}/role-connection", {
      auth: `Bearer ${accessToken}`,
      path: { application_id: this.#options.clientId },
    });
  }

  /**
   * Adds the user to a guild (`guilds.join` scope + `botToken`, and the bot must be in the guild).
   * Resolves `"added"` on 201 or `"already_member"` on 204.
   */
  async joinGuild(
    accessToken: string,
    guildId: string,
    userId: string,
    body: AddGuildMemberBody = {},
  ): Promise<"added" | "already_member"> {
    if (!this.#options.botToken) throw new Error("joinGuild requires the botToken option");
    const member = await this.rest.request("put", "/guilds/{guild_id}/members/{user_id}", {
      auth: `Bot ${this.#options.botToken}`,
      path: { guild_id: guildId, user_id: userId },
      body: { ...body, access_token: accessToken },
    });
    return member === undefined ? "already_member" : "added";
  }

  /** Adds the user to a group DM (`gdm.join` scope + `botToken`). */
  async addGroupDMRecipient(
    accessToken: string,
    channelId: string,
    userId: string,
    body: AddGroupDMRecipientBody = {},
  ): Promise<void> {
    if (!this.#options.botToken)
      throw new Error("addGroupDMRecipient requires the botToken option");
    await this.rest.request("put", "/channels/{channel_id}/recipients/{user_id}", {
      auth: `Bot ${this.#options.botToken}`,
      path: { channel_id: channelId, user_id: userId },
      body: { ...body, access_token: accessToken },
    });
  }

  #form(params: Record<string, string>): URLSearchParams {
    return new URLSearchParams({
      client_id: this.#options.clientId,
      client_secret: this.#options.clientSecret,
      ...params,
    });
  }

  async #token(params: Record<string, string>): Promise<TokenResponse> {
    const res = await this.rest.raw("/oauth2/token", { method: "POST", body: this.#form(params) });
    return res.json();
  }
}
