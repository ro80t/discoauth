import { expect, it } from "vitest";

import { avatarUrl } from "./cdn.ts";

it("avatarUrl picks gif for animated hashes", () => {
  expect(avatarUrl({ id: "1", avatar: "a_x" }, 64)).toBe(
    "https://cdn.discordapp.com/avatars/1/a_x.gif?size=64",
  );
  expect(avatarUrl({ id: "1", avatar: "x" })).toBe("https://cdn.discordapp.com/avatars/1/x.png");
  expect(avatarUrl({ id: "1", avatar: null })).toBeNull();
});
