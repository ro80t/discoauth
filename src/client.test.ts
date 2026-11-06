import { describe, expect, it, vi } from "vitest";

import { DiscordOAuth2 } from "./client.ts";
import { DiscordOAuth2Error } from "./error.ts";

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

const setup = (...responses: Response[]) => {
  const fetch = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  const oauth = new DiscordOAuth2({
    clientId: "id",
    clientSecret: "secret",
    redirectUri: "https://example.com/auth?x=1",
    botToken: "bot",
    fetch,
  });
  return { oauth, fetch };
};

describe("DiscordOAuth2", () => {
  it("builds the authorize url", () => {
    const url = new URL(setup().oauth.authorizeUrl({ scope: ["identify", "guilds"], state: "s" }));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "id",
      response_type: "code",
      redirect_uri: "https://example.com/auth?x=1",
      scope: "identify guilds",
      state: "s",
    });
  });

  it("exchanges a code with form-encoded credentials", async () => {
    const token = { access_token: "a", refresh_token: "r" };
    const { oauth, fetch } = setup(json(200, token));
    expect(await oauth.exchangeCode("c")).toEqual(token);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://discord.com/api/v10/oauth2/token");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      client_id: "id",
      client_secret: "secret",
      grant_type: "authorization_code",
      code: "c",
      redirect_uri: "https://example.com/auth?x=1",
    });
  });

  it("retries 429 using retry_after, then returns", async () => {
    const { oauth, fetch } = setup(json(429, { retry_after: 0 }), json(200, { id: "1" }));
    expect(await oauth.getUser("t")).toEqual({ id: "1" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![1].headers).toEqual({ Authorization: "Bearer t" });
  });

  it("throws DiscordOAuth2Error after exhausting retries or on 4xx", async () => {
    const limited = setup(...Array.from({ length: 4 }, () => json(429, { retry_after: 0 })));
    await expect(limited.oauth.getUser("t")).rejects.toBeInstanceOf(DiscordOAuth2Error);
    expect(limited.fetch).toHaveBeenCalledTimes(4);

    const { oauth } = setup(json(401, { message: "401: Unauthorized" }));
    await expect(oauth.getGuilds("t")).rejects.toMatchObject({ status: 401 });
  });

  it("encodes guild query and joinGuild path", async () => {
    const { oauth, fetch } = setup(json(200, []), json(201, {}), json(204, null));
    await oauth.getGuilds("t", { with_counts: true, limit: 10 });
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://discord.com/api/v10/users/@me/guilds?with_counts=true&limit=10",
    );
    expect(await oauth.joinGuild("t", "g/1", "u")).toBe("added");
    expect(fetch.mock.calls[1]![0]).toBe("https://discord.com/api/v10/guilds/g%2F1/members/u");
    expect(JSON.parse(fetch.mock.calls[1]![1].body as string)).toEqual({ access_token: "t" });
    expect(await oauth.joinGuild("t", "g", "u")).toBe("already_member");
  });

  it("requests client_credentials and scopes role connections to clientId", async () => {
    const { oauth, fetch } = setup(json(200, { access_token: "a" }), json(200, {}));
    await oauth.clientCredentials(["identify", "applications.commands.update"]);
    expect(Object.fromEntries(fetch.mock.calls[0]![1].body as URLSearchParams)).toMatchObject({
      grant_type: "client_credentials",
      scope: "identify applications.commands.update",
    });
    await oauth.getRoleConnection("t");
    expect(fetch.mock.calls[1]![0]).toBe(
      "https://discord.com/api/v10/users/@me/applications/id/role-connection",
    );
  });
});
