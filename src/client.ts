import { DiscordOAuth2Error } from "./error.ts";
import type {
  AddGuildMemberBody,
  Authorization,
  AuthorizeUrlOptions,
  Connection,
  DiscordOAuth2Options,
  GuildMember,
  ListGuildsQuery,
  PartialGuild,
  TokenResponse,
  User,
} from "./types.ts";

export const API_BASE = "https://discord.com/api/v10";

export class DiscordOAuth2 {
  readonly #options: Required<Omit<DiscordOAuth2Options, "botToken">> & { botToken?: string };

  constructor(options: DiscordOAuth2Options) {
    this.#options = { timeout: 10_000, maxRetries: 3, fetch: globalThis.fetch, ...options };
  }

  authorizeUrl({ scope, state, prompt }: AuthorizeUrlOptions): string {
    const params = new URLSearchParams({
      client_id: this.#options.clientId,
      response_type: "code",
      redirect_uri: this.#options.redirectUri,
      scope: scope.join(" "),
    });
    if (state) params.set("state", state);
    if (prompt) params.set("prompt", prompt);
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

  async revokeToken(
    token: string,
    tokenTypeHint: "access_token" | "refresh_token" = "access_token",
  ): Promise<void> {
    await this.#fetch("/oauth2/token/revoke", {
      method: "POST",
      body: this.#form({ token, token_type_hint: tokenTypeHint }),
    });
  }

  getAuthorization(accessToken: string): Promise<Authorization> {
    return this.#bearer(accessToken, "/oauth2/@me");
  }

  /** Requires `identify` (and `email` for the email field). */
  getUser(accessToken: string): Promise<User> {
    return this.#bearer(accessToken, "/users/@me");
  }

  /** Requires `guilds`. */
  getGuilds(accessToken: string, query: ListGuildsQuery = {}): Promise<PartialGuild[]> {
    const params = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    );
    return this.#bearer(accessToken, `/users/@me/guilds?${params}`);
  }

  /** Requires `guilds.members.read`. */
  getGuildMember(accessToken: string, guildId: string): Promise<GuildMember> {
    return this.#bearer(accessToken, `/users/@me/guilds/${encodeURIComponent(guildId)}/member`);
  }

  /** Requires `connections`. */
  getConnections(accessToken: string): Promise<Connection[]> {
    return this.#bearer(accessToken, "/users/@me/connections");
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
    const res = await this.#fetch(
      `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${this.#options.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, access_token: accessToken }),
      },
    );
    return res.status === 201 ? "added" : "already_member";
  }

  #form(params: Record<string, string>): URLSearchParams {
    return new URLSearchParams({
      client_id: this.#options.clientId,
      client_secret: this.#options.clientSecret,
      ...params,
    });
  }

  async #token(params: Record<string, string>): Promise<TokenResponse> {
    const res = await this.#fetch("/oauth2/token", { method: "POST", body: this.#form(params) });
    return res.json();
  }

  async #bearer<T>(accessToken: string, path: string): Promise<T> {
    const res = await this.#fetch(path, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.json();
  }

  async #fetch(path: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.#options.fetch(`${API_BASE}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.#options.timeout),
      });
      if (res.ok) return res;

      const body: unknown = await res.json().catch(() => null);
      if (res.status === 429 && attempt < this.#options.maxRetries) {
        const retryAfter = Number(
          (body as { retry_after?: number } | null)?.retry_after ??
            res.headers.get("retry-after") ??
            1,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw new DiscordOAuth2Error(res.status, body);
    }
  }
}
