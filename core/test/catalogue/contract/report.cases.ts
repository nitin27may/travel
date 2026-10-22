// report: the link answer, input limits.
import { expect } from "vitest";
import { API_LIMITS, reportResult } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const reportCases: ContractCase[] = [
  {
    id: "report.link",
    title: "a report answers a link that names the page; a page that is not a path, or text over the cap, is invalid_input",
    method: "report",
    async run(store, t) {
      const page = `/places/${t.facts.placeSlug}/`;
      const got = expectOk(await store.report({ page }));
      expect(reportResult.safeParse(got).success).toBe(true);
      if (got.kind === "link") expect(got.url).toContain(encodeURIComponent(page));
      expectError(await store.report({ page: "https://elsewhere.example/" }), "invalid_input");
      expectError(await store.report({ page, text: "x".repeat(API_LIMITS.reportText.max + 1) }), "invalid_input");
    },
  },
];
