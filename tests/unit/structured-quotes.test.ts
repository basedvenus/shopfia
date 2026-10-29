import { beforeEach, expect, it, vi } from "vitest";
import { estimateService, initialSelection } from "@/lib/service-pricing";
import { serviceTemplates } from "@/lib/service-templates";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  tx: {
    $executeRaw: vi.fn(),
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    quoteRequest: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    quote: { create: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() }
  }
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: () => null }));
vi.mock("@/lib/db", () => ({ db: { $transaction: (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx) } }));
import { POST } from "@/app/api/messages/structured-quotes/route";

const conversationId = "c1234567890123456789012345";
const requestId = "c2234567890123456789012345";
const quoteId = "c3234567890123456789012345";
const service = serviceTemplates.catering;
const selection = initialSelection(service);
const lines = estimateService(service, selection).lines;
const source = { id: requestId, conversationId, offeringId: "service", buyerId: "buyer", vendorId: "business", attachments: [], quote: null, pricingSnapshot: { version: 1, service, selection, lines, promotions: [] } };
const input = { conversationId, quoteRequestId: requestId, previousQuoteId: null as string | null, lines, finalPrice: 20000, charges: [{ id: "delivery", name: "Delivery", amount: 1000 }], tax: 500, depositPercent: 50, explanation: "Agreed price", expiresAt: "2099-01-01T00:00:00.000Z" };
const send = (data = input) => POST(new Request("https://shopfia.app/api/messages/structured-quotes", { method: "POST", body: JSON.stringify(data) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "vendor", role: "VENDOR" } });
  mocks.tx.conversation.findUnique.mockResolvedValue({ id: conversationId, vendorId: "vendor" });
  mocks.tx.quoteRequest.findUnique.mockResolvedValue(source);
  mocks.tx.quoteRequest.findFirst.mockResolvedValue(source);
  mocks.tx.quoteRequest.create.mockResolvedValue({ id: "revision" });
  mocks.tx.quote.create.mockResolvedValue({ id: quoteId });
});

it("calculates the final total and deposit on the server, ignoring supplied line amounts", async () => {
  const response = await send({ ...input, lines: lines.map(line => ({ ...line, amount: 1 })) });
  expect(response.status).toBe(200);
  const saved = mocks.tx.quote.create.mock.calls[0][0].data;
  expect(saved.amountCents).toBe(21500);
  expect(saved.depositAmountCents).toBe(10750);
  expect(saved.lineItemsJson.structured.lines[0].amount).toBe(lines[0].quantity * lines[0].rate!);
  expect(saved.lineItemsJson.structured.totals.agreed).toBe(20000);
});

it("rejects another vendor without creating a quote", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "other", role: "VENDOR" } });
  expect((await send()).status).toBe(400);
  expect(mocks.tx.quote.create).not.toHaveBeenCalled();
});

it("creates an immutable revision and supersedes the previous unpaid quote", async () => {
  mocks.tx.quoteRequest.findUnique.mockResolvedValue({ ...source, quote: { id: quoteId, status: "SENT", orders: [], lineItemsJson: { structured: { version: 1 } } } });
  const response = await send({ ...input, previousQuoteId: quoteId });
  expect(response.status).toBe(200);
  expect(mocks.tx.quote.update.mock.calls[0][0].data.status).toBe("EXPIRED");
  expect(mocks.tx.quote.create.mock.calls[0][0].data.quoteRequestId).toBe("revision");
  expect(mocks.tx.quote.create.mock.calls[0][0].data.lineItemsJson.structured.version).toBe(2);
});

it("does not overwrite a quote with payment activity", async () => {
  mocks.tx.quoteRequest.findUnique.mockResolvedValue({ ...source, quote: { id: quoteId, status: "ACCEPTED", orders: [{ status: "awaiting_payment" }] } });
  expect((await send({ ...input, previousQuoteId: quoteId })).status).toBe(400);
  expect(mocks.tx.quote.update).not.toHaveBeenCalled();
  expect(mocks.tx.quote.create).not.toHaveBeenCalled();
});
