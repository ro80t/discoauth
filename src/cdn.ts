export const CDN_BASE = "https://cdn.discordapp.com";

type Image = { id: string; avatar?: string | null; banner?: string | null };

const cdn = (path: string, hash: string, size?: number): string =>
  `${CDN_BASE}/${path}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}${size ? `?size=${size}` : ""}`;

export const avatarUrl = (user: Image, size?: number): string | null =>
  user.avatar ? cdn(`avatars/${user.id}`, user.avatar, size) : null;

export const bannerUrl = (user: Image, size?: number): string | null =>
  user.banner ? cdn(`banners/${user.id}`, user.banner, size) : null;
