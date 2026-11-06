import { DiscordOAuth2Error } from "./error.ts";
import type { paths } from "./schema.auto.ts";
import type { RESTOptions } from "./types.ts";

export const API_BASE = "https://discord.com/api/v10";

type Method = "get" | "put" | "post" | "patch" | "delete";
type Op = { parameters: unknown; responses: unknown };

/** HTTP methods the schema defines for `P`. */
export type Methods<P extends keyof paths> = {
  [M in Method]: paths[P][M] extends Op ? M : never;
}[Method];

export type Operation<P extends keyof paths, M extends Methods<P>> = Extract<paths[P][M], Op>;

type Json<R> = R extends { content: { "application/json": infer B } } ? B : undefined;

/** Body of the 2xx response(s); `undefined` for 204. */
export type RESTResponse<O> = O extends { responses: infer R }
  ? Json<R[keyof R & (200 | 201 | 204)]>
  : never;

/** `path` / `query` / `body` appear only when the operation has them. */
export type RESTRequest<O> = {
  /** Full `Authorization` header value, e.g. `Bearer <token>` or `Bot <token>`. */
  auth: string;
} & (O extends { parameters: { path: infer X } } ? { path: X } : unknown) &
  (O extends { parameters: { query?: infer Q } }
    ? [Exclude<Q, undefined>] extends [never]
      ? unknown
      : { query?: Q }
    : unknown) &
  (O extends { requestBody: { content: { "application/json": infer B } } } ? { body: B } : unknown);

/** Typed wrapper over the endpoints in `schema.auto.ts`, with timeout and 429 retry. */
export class REST {
  readonly #options: Required<RESTOptions>;

  constructor(options: RESTOptions = {}) {
    this.#options = { timeout: 10_000, maxRetries: 3, fetch: globalThis.fetch, ...options };
  }

  async request<P extends keyof paths, M extends Methods<P>>(
    method: M,
    path: P,
    request: RESTRequest<Operation<P, M>>,
  ): Promise<RESTResponse<Operation<P, M>>> {
    const {
      auth,
      path: params = {},
      query = {},
      body,
    } = request as {
      auth: string;
      path?: Record<string, string>;
      query?: Record<string, unknown>;
      body?: unknown;
    };
    const url = path.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(params[key]!));
    const search = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)]),
    );
    const res = await this.raw(search.size ? `${url}?${search}` : url, {
      method: method.toUpperCase(),
      headers:
        body === undefined
          ? { Authorization: auth }
          : { Authorization: auth, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.status === 204 ? (undefined as never) : res.json();
  }

  /** Untyped escape hatch for endpoints outside the spec (e.g. `/oauth2/token`). */
  async raw(path: string, init: RequestInit): Promise<Response> {
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
