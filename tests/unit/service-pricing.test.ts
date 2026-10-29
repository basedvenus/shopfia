import { describe, expect, it } from "vitest";
import { acceptQuoteVersion, applyPromotion, calculateQuote, compareMinimumPrice, estimateService, initialSelection, minimumPrice, priceLabel, readStructuredPricing, sendQuoteVersion, servicePricingSchema, type BasePricing, type PriceLine, type Promotion, type ServicePricing } from "@/lib/service-pricing";

const make = (base: BasePricing): ServicePricing => ({ version: 1, id: "service", name: "Catering", description: "Event catering", inclusions: "Food and preparation", base, extras: [] });
const person = make({ type: "person", rate: 2500, minimum: 20, maximum: 100 });
const flatExtra = { id: "dessert", name: "Dessert", description: "Dessert station", type: "flat" as const, rate: 10000, minimum: 1, increment: 1, separateHours: false, locationRequired: false };
const line: PriceLine = { id: "service", name: "Catering", scope: "Food", quantity: 40, unit: "people", rate: 2500, amount: 100000, calculation: "40 people × $25" };
const promotion: Promotion = { id: "sale", name: "Celebration", type: "percent", value: 20, eligibleIds: ["service"], startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z", timezone: "America/Los_Angeles" };
const now = "2026-10-28T12:00:00Z";
const context = { now, eventDate: "2026-12-01", code: "" };

describe("structured service pricing", () => {
  it.each([
    [{ type: "fixed", rate: 25000 }, 25000],
    [{ type: "hour", rate: 10000, minimum: 3, increment: 0.5 }, 30000],
    [{ type: "person", rate: 2500, minimum: 20 }, 50000],
    [{ type: "item", rate: 500, minimum: 24, increment: 12, label: "cookie" }, 12000],
    [{ type: "custom", questions: ["What do you need?"], minimum: 50000 }, 50000],
    [{ type: "custom", questions: ["What do you need?"] }, null]
  ])("derives the actual minimum for %j", (base, expected) => expect(minimumPrice(make(base as BasePricing))).toBe(expected));
  it("does not infer legacy pricing or turn an unpriced quote into $0", () => {
    expect(readStructuredPricing({ basePriceCents: 20000, variantsJson: [] })).toBeNull();
    expect(priceLabel(make({ type: "custom", questions: ["Scope?"] }))).toBe("Request a quote");
  });
  it("sorts unpriced custom services after priced services", () => {
    const unpriced = make({ type: "custom", questions: ["Scope?"] });
    expect([unpriced, person].sort(compareMinimumPrice)[1]).toBe(unpriced);
  });
  it("requires names, descriptions and inclusions", () => {
    for (const key of ["name", "description", "inclusions"]) expect(servicePricingSchema.safeParse({ ...person, [key]: "" }).success).toBe(false);
  });
  it("enforces hourly minimums and half-hour increments", () => {
    const service = make({ type: "hour", rate: 10000, minimum: 3, increment: 0.5 });
    for (const quantity of [1, 3.25, NaN]) expect(estimateService(service, { ...initialSelection(service), quantity }).errors.length).toBeGreaterThan(0);
    expect(estimateService(service, { ...initialSelection(service), quantity: 3.5 }).subtotal).toBe(35000);
  });
  it("enforces batch increments relative to the minimum", () => {
    const service = make({ type: "item", rate: 500, minimum: 24, increment: 12, label: "cookie" });
    expect(estimateService(service, { ...initialSelection(service), quantity: 25 }).errors).not.toHaveLength(0);
    expect(estimateService(service, { ...initialSelection(service), quantity: 36 }).subtotal).toBe(18000);
  });
  it("enforces guest maximum and whole people", () => {
    for (const quantity of [101, 20.5]) expect(estimateService(person, { ...initialSelection(person), quantity }).errors.length).toBeGreaterThan(0);
  });
  it("calculates the requested 970-dollar example with shared guest count", () => {
    const service = { ...person, extras: [flatExtra, { ...flatExtra, id: "tableware", name: "Tableware", type: "person" as const, rate: 400 }] };
    const result = estimateService(service, { ...initialSelection(service), quantity: 30, extras: { dessert: true, tableware: true } });
    expect(result.errors).toEqual([]); expect(result.subtotal).toBe(97000); expect(result.lines[2].quantity).toBe(30);
    expect(estimateService(service, initialSelection(service)).subtotal).toBe(50000);
  });
  it("shares base hours unless separate hours are enabled", () => {
    const service = { ...make({ type: "hour", rate: 10000, minimum: 3, increment: 0.5 }), extras: [{ ...flatExtra, type: "hour" as const, rate: 3000 }] };
    expect(estimateService(service, { ...initialSelection(service), extras: { dessert: true } }).subtotal).toBe(39000);
    service.extras[0].separateHours = true;
    expect(estimateService(service, { ...initialSelection(service), extras: { dessert: 2 } }).subtotal).toBe(36000);
  });
  it("keeps quoted extras pending and requires their location", () => {
    const service = { ...person, extras: [{ ...flatExtra, type: "quoted" as const, locationRequired: true }] };
    const result = estimateService(service, { ...initialSelection(service), extras: { dessert: true } });
    expect(result.pending).toBe(true); expect(result.lines[1].amount).toBeNull(); expect(result.errors[0]).toContain("location");
  });
  it("supports named packages with their own coverage", () => {
    const service = make({ type: "package", packages: [{ id: "a", name: "Small", price: 30000, inclusions: "Play setup", coverage: "8 children" }, { id: "b", name: "Large", price: 50000, inclusions: "Large setup", coverage: "15 children" }] });
    expect(minimumPrice(service)).toBe(30000);
    const result = estimateService(service, { ...initialSelection(service), packageId: "b" });
    expect(result.subtotal).toBe(50000); expect(result.lines[0].scope).toContain("15 children");
  });
  it("requires custom questions and does not treat a minimum as a fixed quote", () => {
    const service = make({ type: "custom", minimum: 50000, questions: ["Scope?"] });
    expect(estimateService(service, initialSelection(service)).errors).toHaveLength(1);
    const result = estimateService(service, { ...initialSelection(service), answers: ["Floral installation"] });
    expect(result.pending).toBe(true); expect(result.lines[0].amount).toBeNull();
  });
});
describe("promotions and negotiated totals", () => {
  it("discounts eligible lines only, never stacks, and caps fixed amounts", () => {
    const other = { ...line, id: "extra", amount: 10000 };
    expect(applyPromotion([line, other], [promotion, { ...promotion, id: "other", type: "fixed", value: 5000 }], context).discount).toBe(20000);
    expect(applyPromotion([line], [{ ...promotion, type: "fixed", value: 200000 }], context).discount).toBe(100000);
  });
  it("enforces codes, booking deadlines and event date windows", () => {
    expect(applyPromotion([line], [{ ...promotion, code: "PARTY" }], context).discount).toBe(0);
    expect(applyPromotion([line], [{ ...promotion, code: "PARTY" }], { ...context, code: "party" }).discount).toBe(20000);
    expect(applyPromotion([line], [promotion], { ...context, now: "2026-12-01T00:00:00Z" }).discount).toBe(0);
    expect(applyPromotion([line], [{ ...promotion, eventTo: "2026-11-30" }], context).discount).toBe(0);
    expect(applyPromotion([line], [{ ...promotion, eventFrom: "2026-11-30" }], { ...context, eventDate: "" }).discount).toBe(0);
  });
  it("allows a 1000 to 200 agreement and calculates booking payment from the full total", () => {
    const totals = calculateQuote([line], 0, 20000, [{ id: "delivery", name: "Delivery", amount: 2500 }], 1800, 50);
    expect(totals.adjustment).toBe(-80000); expect(totals.total).toBe(24300); expect(totals.bookingPayment).toBe(12150); expect(totals.balance).toBe(12150);
  });
  it("does not deduct a promotion twice after a manual agreement", () => {
    expect(calculateQuote([line], 20000, 20000, [], 0, 50)).toMatchObject({ calculated: 80000, adjustment: -60000, agreed: 20000, total: 20000 });
  });
  it("permits a vendor minimum exception, but rejects invalid amounts", () => {
    expect(calculateQuote([{ ...line, quantity: 1 }], 0, undefined, [], 0, 100).total).toBe(2500);
    expect(() => calculateQuote([line], 0, -1, [], 0, 50)).toThrow();
    expect(() => calculateQuote([line], 0, 20000, [], 0, 101)).toThrow();
    expect(() => calculateQuote([line], 0, 20000, [{ id: "x", name: "Catering", amount: 20 }], 0, 50)).toThrow(/twice/);
  });
  it("requires pricing for pending scope or an explicit all-inclusive agreement", () => {
    const pending = [{ ...line, rate: null, amount: null }];
    expect(() => calculateQuote(pending, 0, undefined, [], 0, 50)).toThrow(/pending/);
    expect(calculateQuote(pending, 0, 25000, [], 0, 50).total).toBe(25000);
  });
});
describe("immutable formal quote revisions", () => {
  const draft = { expiresAt: "2026-11-01T00:00:00Z", lines: [line], charges: [], tax: 0, explanation: "", totals: calculateQuote([line], 0, 20000, [], 0, 50) };
  it("supersedes unsent approvals and rejects approving an old version", () => {
    const first = sendQuoteVersion([], draft, now);
    const second = sendQuoteVersion(first, draft, now);
    expect(second[0].status).toBe("superseded"); expect(first[0].status).toBe("sent");
    expect(() => acceptQuoteVersion(second, first[0].id, now)).toThrow();
  });
  it("preserves accepted prices and demands approval for a later revision", () => {
    const first = sendQuoteVersion([], draft, now);
    const accepted = acceptQuoteVersion(first, first[0].id, now);
    const second = sendQuoteVersion(accepted, { ...draft, totals: calculateQuote([line], 0, 30000, [], 0, 50) }, now);
    expect(second[0].status).toBe("accepted"); expect(second[0].totals.total).toBe(20000); expect(second[1].status).toBe("sent"); expect(second[1].totals.total).toBe(30000);
  });
  it("rejects expired quotes and snapshots scope without reference sharing", () => {
    const history = sendQuoteVersion([], draft, now);
    expect(history[0].lines).not.toBe(draft.lines);
    expect(() => acceptQuoteVersion(history, history[0].id, "2026-12-01T00:00:00Z")).toThrow();
  });
});
