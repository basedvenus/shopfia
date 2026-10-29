import { z } from "zod";

const money = z.number().int().min(0).max(100_000_000);
const count = z.number().positive().max(100_000);
const text = z.string().trim().min(1).max(2000);
export const pricingTypes = { fixed: "Fixed price", hour: "Per hour", person: "Per person", item: "Per item", package: "Package", custom: "Custom quote" } as const;
export const extraTypes = { flat: "Flat fee", item: "Per item", person: "Per person", hour: "Per hour", quoted: "Quoted separately" } as const;
const packageSchema = z.object({ id: text, name: text, price: money, inclusions: text, coverage: text });
const baseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed"), rate: money }),
  z.object({ type: z.literal("hour"), rate: money, minimum: count, increment: z.union([z.literal(0.5), z.literal(1)]) }),
  z.object({ type: z.literal("person"), rate: money, minimum: count.int(), maximum: count.int().optional() }),
  z.object({ type: z.literal("item"), rate: money, label: text, minimum: count.int(), increment: count.int() }),
  z.object({ type: z.literal("package"), packages: z.array(packageSchema).min(1).max(30) }),
  z.object({ type: z.literal("custom"), questions: z.array(text).min(1).max(20), minimum: money.optional() })
]);
export const extraSchema = z.object({
  id: text, name: text, description: text, type: z.enum(["flat", "item", "person", "hour", "quoted"]),
  rate: money.optional(), minimum: count.default(1), maximum: count.optional(), increment: count.default(1),
  separateHours: z.boolean().default(false), locationRequired: z.boolean().default(false)
}).superRefine((extra, ctx) => {
  if (extra.type !== "quoted" && extra.rate === undefined) ctx.addIssue({ code: "custom", path: ["rate"], message: "Enter a price or choose Quoted separately." });
  if (extra.maximum !== undefined && extra.maximum < extra.minimum) ctx.addIssue({ code: "custom", path: ["maximum"], message: "Maximum must meet the minimum." });
  if ((extra.type === "item" || extra.type === "person") && (!Number.isInteger(extra.minimum) || !Number.isInteger(extra.increment) || (extra.maximum !== undefined && !Number.isInteger(extra.maximum)))) ctx.addIssue({ code: "custom", message: "Items and people use whole quantities." });
});
export const servicePricingSchema = z.object({
  version: z.literal(1), id: text, name: text, description: text, inclusions: text,
  base: baseSchema, extras: z.array(extraSchema).max(40)
}).superRefine((service, ctx) => {
  if (service.base.type === "person" && service.base.maximum !== undefined && service.base.maximum < service.base.minimum) ctx.addIssue({ code: "custom", path: ["base", "maximum"], message: "Maximum must meet the minimum." });
  const ids = service.extras.map(extra => extra.id);
  if (service.base.type === "package") ids.push(...service.base.packages.map(pkg => pkg.id));
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Each option needs a unique ID." });
});
export type ServicePricing = z.infer<typeof servicePricingSchema>;
export type BasePricing = ServicePricing["base"];
export type Extra = ServicePricing["extras"][number];
export type Selection = { quantity?: number; packageId?: string; guests?: number; hours?: number; extras: Record<string, number | true>; answers: string[]; location: string; eventDate: string; promoCode: string };
export type PriceLine = { id: string; name: string; scope: string; quantity: number; unit: string; rate: number | null; amount: number | null; calculation: string };
export const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
export function minimumPrice(service: ServicePricing): number | null {
  const b = service.base;
  if (b.type === "custom") return b.minimum ?? null;
  if (b.type === "package") return Math.min(...b.packages.map(pkg => pkg.price));
  return Math.round(b.rate * (b.type === "fixed" ? 1 : b.minimum));
}
export function compareMinimumPrice(a: ServicePricing, b: ServicePricing) {
  const left = minimumPrice(a);
  const right = minimumPrice(b);
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
}
export function priceLabel(service: ServicePricing) {
  const b = service.base;
  if (b.type === "custom") return b.minimum === undefined ? "Request a quote" : `Custom pricing · ${usd(b.minimum)} minimum booking`;
  if (b.type === "fixed") return `${usd(b.rate)} per booking`;
  if (b.type === "package") return `Packages from ${usd(minimumPrice(service)!)}`;
  const unit = b.type === "hour" ? "hour" : b.type === "person" ? "person" : b.label;
  return `${usd(b.rate)}/${unit} · ${b.type === "item" ? `Minimum ${b.minimum}` : `${b.minimum}-${unit} minimum`} · From ${usd(minimumPrice(service)!)}`;
}
export function initialSelection(service: ServicePricing): Selection {
  const b = service.base;
  return { quantity: "rate" in b && b.type !== "fixed" ? b.minimum : undefined, packageId: b.type === "package" ? b.packages[0]?.id : undefined, extras: {}, answers: [], location: "", eventDate: "", promoCode: "" };
}
function validQuantity(quantity: number | undefined, minimum: number, increment: number, maximum?: number) {
  return quantity !== undefined && Number.isFinite(quantity) && quantity >= minimum && (maximum === undefined || quantity <= maximum) && Math.abs((quantity - minimum) / increment - Math.round((quantity - minimum) / increment)) < 0.00001;
}
export function estimateService(input: ServicePricing, selection: Selection) {
  const service = servicePricingSchema.parse(input);
  const b = service.base;
  const lines: PriceLine[] = [];
  const errors: string[] = [];
  const add = (id: string, name: string, scope: string, quantity: number, unit: string, rate: number | null, calculation?: string) => lines.push({ id, name, scope, quantity, unit, rate, amount: rate === null ? null : Math.round(rate * quantity), calculation: calculation ?? (rate === null ? "Price pending" : `${quantity} ${unit} × ${usd(rate)}`) });
  if (b.type === "fixed") add(service.id, service.name, service.inclusions, 1, "booking", b.rate, "Fixed price");
  else if (b.type === "package") {
    const pkg = b.packages.find(p => p.id === selection.packageId);
    if (!pkg) errors.push("Choose a package.");
    else add(pkg.id, pkg.name, `${pkg.inclusions} · ${pkg.coverage}`, 1, "package", pkg.price, "Package price");
  } else if (b.type === "custom") {
    add(service.id, service.name, service.inclusions, 1, "booking", null);
    if (b.questions.some((_, i) => !selection.answers[i]?.trim())) errors.push("Answer the service request questions.");
  } else {
    const increment = b.type === "person" ? 1 : b.increment;
    if (!validQuantity(selection.quantity, b.minimum, increment, b.type === "person" ? b.maximum : undefined)) errors.push(`Choose at least ${b.minimum}, in increments of ${increment}${b.type === "person" && b.maximum ? `, up to ${b.maximum}` : ""}.`);
    else add(service.id, service.name, service.inclusions, selection.quantity!, b.type === "hour" ? "hours" : b.type === "person" ? "people" : b.label, b.rate);
  }
  for (const id of Object.keys(selection.extras)) {
    const extra = service.extras.find(e => e.id === id);
    if (!extra) { errors.push("An extra is no longer available."); continue; }
    if (extra.locationRequired && !selection.location.trim()) errors.push(`Enter an event location for ${extra.name}.`);
    let quantity = 1;
    let unit = "fee";
    if (extra.type === "person") { quantity = b.type === "person" ? selection.quantity! : selection.guests!; unit = "people"; }
    if (extra.type === "hour") { quantity = !extra.separateHours ? (b.type === "hour" ? selection.quantity! : selection.hours!) : Number(selection.extras[id]); unit = "hours"; }
    if (extra.type === "item") { quantity = Number(selection.extras[id]); unit = "items"; }
    if (!["flat", "quoted"].includes(extra.type) && !validQuantity(quantity, extra.minimum, extra.increment, extra.maximum)) { errors.push(`${extra.name}: use a quantity of at least ${extra.minimum}, in increments of ${extra.increment}${extra.maximum ? `, up to ${extra.maximum}` : ""}.`); continue; }
    add(id, extra.name, extra.description, quantity, unit, extra.type === "quoted" ? null : extra.rate!, extra.type === "flat" ? "Flat fee" : undefined);
  }
  return { lines, errors, subtotal: lines.reduce((sum, line) => sum + (line.amount ?? 0), 0), pending: lines.some(line => line.amount === null) };
}

export const promotionSchema = z.object({
  id: text, name: text, type: z.enum(["percent", "fixed"]), value: z.number().positive(),
  eligibleIds: z.array(text).min(1), startsAt: z.string().datetime(), endsAt: z.string().datetime(),
  timezone: text.refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid timezone."),
  code: z.string().trim().optional(), eventFrom: z.string().optional(), eventTo: z.string().optional()
}).superRefine((p, ctx) => {
  if (p.type === "percent" && p.value > 100) ctx.addIssue({ code: "custom", message: "Percentage cannot exceed 100%." });
  if (p.type === "fixed" && !Number.isInteger(p.value)) ctx.addIssue({ code: "custom", message: "Use whole cents." });
  if (Date.parse(p.endsAt) <= Date.parse(p.startsAt)) ctx.addIssue({ code: "custom", message: "End must follow start." });
  if (p.eventFrom && p.eventTo && p.eventTo < p.eventFrom) ctx.addIssue({ code: "custom", message: "Event end must follow event start." });
});
export type Promotion = z.infer<typeof promotionSchema>;
export function applyPromotion(lines: PriceLine[], promotions: Promotion[], context: { now: string; eventDate: string; code: string }) {
  let best: { discount: number; promotion?: Promotion } = { discount: 0 };
  for (const raw of promotions) {
    const parsed = promotionSchema.safeParse(raw);
    if (!parsed.success) continue;
    const p = parsed.data;
    const now = Date.parse(context.now);
    if (!Number.isFinite(now) || now < Date.parse(p.startsAt) || now > Date.parse(p.endsAt)) continue;
    if (p.code && p.code.toLowerCase() !== context.code.trim().toLowerCase()) continue;
    if ((p.eventFrom || p.eventTo) && !context.eventDate) continue;
    if ((p.eventFrom && context.eventDate < p.eventFrom) || (p.eventTo && context.eventDate > p.eventTo)) continue;
    const eligible = lines.filter(line => p.eligibleIds.includes(line.id)).reduce((sum, line) => sum + (line.amount ?? 0), 0);
    const discount = Math.min(eligible, p.type === "percent" ? Math.round(eligible * p.value / 100) : p.value);
    if (discount > best.discount) best = { discount, promotion: p };
  }
  return best;
}

export type SeparateCharge = { id: string; name: string; amount: number };
export function calculateQuote(lines: PriceLine[], discount: number, finalPrice: number | undefined, charges: SeparateCharge[], tax: number, depositPercent: number) {
  if (!lines.length || lines.some(l => !Number.isFinite(l.quantity) || l.quantity <= 0 || (l.rate !== null && (!Number.isSafeInteger(l.rate) || l.rate < 0)))) throw new Error("Enter valid quantities and rates.");
  if (finalPrice === undefined && lines.some(l => l.rate === null)) throw new Error("Price each pending item or enter a final agreed price covering the entire scope.");
  const regular = lines.reduce((sum, l) => sum + Math.round(l.quantity * (l.rate ?? 0)), 0);
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > regular) throw new Error("Invalid promotion amount.");
  const calculated = regular - discount;
  const agreed = finalPrice ?? calculated;
  for (const amount of [agreed, tax, ...charges.map(c => c.amount)]) if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Enter valid non-negative prices.");
  if (charges.some(c => !c.name.trim())) throw new Error("Name each separate charge.");
  const names = [...lines.map(l => l.name), ...charges.map(c => c.name)].map(name => name.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("A charge is listed twice. Include it once or use a distinct name for a different charge.");
  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) throw new Error("Booking payment must be 0–100%.");
  const total = agreed + charges.reduce((sum, c) => sum + c.amount, 0) + tax;
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Final total must be greater than zero.");
  const bookingPayment = Math.round(total * depositPercent / 100);
  // An unpriced scope has no regular total to negotiate against. Its agreed price covers it explicitly.
  return { regular, discount, calculated, agreed, adjustment: lines.some(l => l.rate === null) ? 0 : agreed - calculated, total, bookingPayment, balance: total - bookingPayment };
}
export type QuoteVersion = { id: string; version: number; status: "sent" | "accepted" | "superseded"; createdAt: string; expiresAt: string; acceptedAt?: string; lines: PriceLine[]; charges: SeparateCharge[]; tax: number; explanation: string; promotion?: Promotion; totals: ReturnType<typeof calculateQuote> };
export function sendQuoteVersion(history: QuoteVersion[], draft: Omit<QuoteVersion, "id" | "version" | "status" | "createdAt">, now: string): QuoteVersion[] {
  if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(draft.expiresAt)) || Date.parse(draft.expiresAt) <= Date.parse(now)) throw new Error("Choose a future quote deadline.");
  const current = structuredClone(draft);
  return [...history.map(q => q.status === "sent" ? { ...q, status: "superseded" as const } : q), { ...current, id: `quote-${history.length + 1}`, version: history.length + 1, status: "sent", createdAt: now }];
}
export function acceptQuoteVersion(history: QuoteVersion[], id: string, now: string) {
  const current = history.at(-1);
  if (!Number.isFinite(Date.parse(now)) || !current || current.id !== id || current.status !== "sent" || Date.parse(current.expiresAt) <= Date.parse(now)) throw new Error("Only the current, unexpired quote can be approved.");
  return history.map(q => q.id === id ? { ...q, status: "accepted" as const, acceptedAt: now } : q);
}
// No inference from legacy price or packages: a vendor must explicitly choose a pricing type.
export function readStructuredPricing(value: unknown): ServicePricing | null {
  const result = servicePricingSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const selectionSchema = z.object({ quantity: count.optional(), packageId: z.string().max(120).optional(), guests: count.int().optional(), hours: count.optional(), extras: z.record(z.union([count, z.literal(true)])), answers: z.array(z.string().max(2000)).max(20), location: z.string().max(240), eventDate: z.string().max(40), promoCode: z.string().max(100) });
