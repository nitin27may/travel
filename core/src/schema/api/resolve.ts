// `resolveRefs` on the API surface (visitor spec 4.5, 8.2; FAV-1W): `GET /api/v1/resolve?ref=<value>&ref=<value>`. The query and the
// answer are FAV-C's (../favourites.ts); this file re-exports them beside the other API contracts and adds the URL side for OpenAPI.
// The rules (validation, the 48 cap, the privacy of a pinned page that is not public) live in core/src/favourites/resolve.ts.
import { z } from "zod";
import { REF_MAX } from "./common.ts";
import { RESOLVE_MAX } from "../favourites.ts";

export { RESOLVE_MAX, RESOLVE_STATES, resolveAnswer, resolveInput, resolveQuery, resolveRow } from "../favourites.ts";
export type { ResolveAnswer, ResolveQuery, ResolveRow, ResolveState } from "../favourites.ts";

/**
 * The URL side: `ref` repeated once per value, in the order the answer comes back (a handle `place:<slug>`, `trip:<slug>`, or a public
 * ref). OpenAPI documents it as a form-exploded array; core/src/favourites/resolve.ts `resolveQueryOf` decodes it. The bounds here are
 * documentation: a 49th value still reaches the handler, which answers `too_large`, and a bad value is `invalid_input` naming its index.
 */
export const resolveHttpQuery = z.strictObject({ ref: z.array(z.string().max(REF_MAX)).max(RESOLVE_MAX).optional() });
export type ResolveHttpQuery = z.infer<typeof resolveHttpQuery>;
