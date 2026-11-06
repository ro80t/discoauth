import { expect, it, vi } from "vitest";

import { REST } from "./rest.ts";

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

const setup = (...responses: Response[]) => {
  const fetch = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  return { rest: new REST({ fetch }), fetch };
};

it("fills path params, query and json body", async () => {
  const { rest, fetch } = setup(json(200, []), json(200, { platform_name: "x" }));
  await rest.request("get", "/users/@me/applications/{application_id}/entitlements", {
    auth: "Bearer t",
    path: { application_id: "a/1" },
    query: { sku_ids: ["1", "2"], exclude_consumed: true },
  });
  expect(fetch.mock.calls[0]![0]).toBe(
    "https://discord.com/api/v10/users/@me/applications/a%2F1/entitlements?sku_ids=1%2C2&exclude_consumed=true",
  );

  await rest.request("put", "/users/@me/applications/{application_id}/role-connection", {
    auth: "Bearer t",
    path: { application_id: "a" },
    body: { platform_name: "x" },
  });
  const [, init] = fetch.mock.calls[1]!;
  expect(init.method).toBe("PUT");
  expect(init.headers).toEqual({ Authorization: "Bearer t", "Content-Type": "application/json" });
  expect(JSON.parse(init.body as string)).toEqual({ platform_name: "x" });
});

it("resolves undefined on 204", async () => {
  const { rest } = setup(json(204, null));
  expect(
    await rest.request("delete", "/users/@me/applications/{application_id}/role-connection", {
      auth: "Bearer t",
      path: { application_id: "a" },
    }),
  ).toBeUndefined();
});

it("rejects wrong shapes at compile time", () => {
  const rest = new REST({ fetch: vi.fn<typeof fetch>() });
  // @ts-expect-error missing path params
  void rest.request("get", "/users/@me/guilds/{guild_id}/member", { auth: "" }).catch(() => {});
  // @ts-expect-error method not in the schema
  void rest.request("post", "/users/@me", { auth: "" }).catch(() => {});
  void rest
    // @ts-expect-error missing body
    .request("put", "/guilds/{guild_id}/members/{user_id}", {
      auth: "",
      path: { guild_id: "", user_id: "" },
    })
    .catch(() => {});
  expect.assertions(0);
});
