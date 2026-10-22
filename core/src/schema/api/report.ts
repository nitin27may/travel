// Report a problem on a page (11.2, Q63, Q70). Today the answer is the public feedback form's URL; a server later stores the report.
// No personal data is taken: the page path, a kind and optional free text.
import { z } from "zod";
import { API_LIMITS } from "./limits.ts";

export const REPORT_KINDS = ["wrong", "missing", "broken_link", "other"] as const;

export const reportInput = z.strictObject({
  /** the page the visitor was on: a site path such as `/places/moraine-lake/`; nothing else about the visit */
  page: z.string().min(1).max(300).regex(/^\/[^\s?#]*$/),
  kind: z.enum(REPORT_KINDS).optional(),
  text: z.string().max(API_LIMITS.reportText.max).optional(),
});

/** `link`: open this URL (now). `submitted`: a server stored it (later). When reporting is off the store answers `not_available`. */
export const reportResult = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("link"), url: z.string().min(1) }),
  z.strictObject({ kind: z.literal("submitted"), id: z.string().min(1) }),
]);

export type ReportInput = z.infer<typeof reportInput>;
export type ReportResult = z.infer<typeof reportResult>;
