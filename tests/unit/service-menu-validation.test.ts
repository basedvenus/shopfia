import { describe, expect, it } from "vitest";
import { estimateService, initialSelection, readStructuredPricing, servicePricingSchema, type ServicePricing } from "@/lib/service-pricing";
import { serviceFormIssues } from "@/lib/service-form-validation";
import { serviceTemplates } from "@/lib/service-templates";

const withMenu: ServicePricing = { ...serviceTemplates.cookies, menus: [{ id: "flavors", name: "Flavors", options: ["Vanilla", "Chocolate"], selection: "single", required: true }] };

describe("service menu choices", () => {
  it("preserves services saved before menus were added", () => {
    expect(readStructuredPricing(serviceTemplates.cart)).not.toBeNull();
  });
  it("requires a choice and carries it into quote scope without adding a charge", () => {
    const selection = initialSelection(withMenu);
    expect(estimateService(withMenu, selection).errors).toContain("Choose one option for Flavors.");
    const result = estimateService(withMenu, { ...selection, menus: { flavors: ["Vanilla"] } });
    expect(result.errors).toEqual([]);
    expect(result.subtotal).toBe(12000);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].scope).toContain("Flavors: Vanilla");
  });
  it("rejects a removed option, duplicate selection, or multiple choices in a single-choice menu", () => {
    for (const choices of [["Unknown"], ["Vanilla", "Vanilla"], ["Vanilla", "Chocolate"]]) {
      expect(estimateService(withMenu, { ...initialSelection(withMenu), menus: { flavors: choices } }).errors).toContain("Choose valid options for Flavors.");
    }
  });
  it("supports multiple included choices and display-only menus", () => {
    const service = { ...withMenu, menus: [{ ...withMenu.menus![0], selection: "multiple" as const }] };
    const result = estimateService(service, { ...initialSelection(service), menus: { flavors: ["Vanilla", "Chocolate"] } });
    expect(result.errors).toEqual([]);
    expect(result.subtotal).toBe(12000);
    const display = { ...service, menus: [{ ...service.menus[0], selection: "display" as const }] };
    expect(estimateService(display, initialSelection(display)).errors).toEqual([]);
  });
  it("ignores empty lines but rejects empty and duplicate menus", () => {
    const valid = servicePricingSchema.parse({ ...withMenu, menus: [{ ...withMenu.menus![0], options: ["Vanilla", "", "  "] }] });
    expect(valid.menus![0].options).toEqual(["Vanilla"]);
    for (const options of [[], ["Vanilla", "vanilla"]]) expect(servicePricingSchema.safeParse({ ...withMenu, menus: [{ ...withMenu.menus![0], options }] }).success).toBe(false);
  });
});

describe("save feedback", () => {
  it("names every missing field instead of silently disabling Save", () => {
    const issues = serviceFormIssues(serviceTemplates.blank, [], false);
    expect(issues.map(issue => issue.label)).toEqual(expect.arrayContaining(["Service name", "Description", "What’s included", "Service categories", "Template review"]));
  });
  it("matches the save action's description minimum", () => {
    expect(serviceFormIssues({ ...serviceTemplates.cookies, description: "Too short" }, ["catering"], true)).toEqual([{ label: "Description", message: "Add a little more detail to the description (at least 20 characters)." }]);
  });
  it("identifies an incomplete extra inside its own collapsed group", () => {
    const service = structuredClone(serviceTemplates.cart);
    service.extras[0].description = "";
    expect(serviceFormIssues(service, ["cart"], true)).toEqual([{ label: "Add-on description", group: "extras.0", message: "Additional assistant: Complete add-on description." }]);
  });
  it("allows a completed service and identifies an empty menu", () => {
    expect(serviceFormIssues(withMenu, ["cookies"], true)).toEqual([]);
    const issues = serviceFormIssues({ ...withMenu, menus: [{ ...withMenu.menus![0], options: [] }] }, ["cookies"], true);
    expect(issues[0]).toMatchObject({ label: "Menu choices", group: "menus.0" });
  });
});
