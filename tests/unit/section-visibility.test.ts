import { expect, it } from "vitest";
import { sanitizeHiddenStorefrontSections } from "@/lib/businesses";

it("allows hiding and restoring any approved section without accepting unknown sections", () => {
 expect(sanitizeHiddenStorefrontSections(["hero", "final-quote", "portfolio", "all-services", "hero", "unknown"])).toEqual(["hero", "final-quote", "portfolio", "all-services"]);
 expect(sanitizeHiddenStorefrontSections([])).toEqual([]);
});
