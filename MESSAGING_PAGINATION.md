# Bounded website messaging

The website opts into `GET /api/messages?paged=1`. The default endpoint is
unchanged for existing mobile clients. Those clients retain the legacy first-30
conversation limit and unbounded nested histories; the compatibility path is not
a concurrency-capacity fix for mobile.

Paged requests accept `page=refresh|conversations|messages|inquiries|quoteRequests`,
`conversationId`, and the opaque `cursor` returned for the matching collection.
Refresh also accepts an optional `quoteRequestId`, or an `orderId` from the
existing checkout-return URL. Either can add at most one authorized older quote
without changing the normal history cursor; an explicit quote ID takes priority.
Cursors are navigation tokens, not credentials. Authorization is independently
applied to every query, with cursor owner/collection/conversation validation.
Malformed or mismatched cursors return the same generic 400 response.

Refresh returns at most 30 inbox rows (one message/inquiry preview each) plus the
selected thread, including when it is outside that inbox page. Thread windows
are 50 messages, 20 inquiries, and 20 quote requests (plus one targeted quote). Extra sentinel rows establish
whether more history exists. Pagination metadata exposes the next conversation
page and separate older-history cursors. Selected arrays retain the existing
ascending rendering order. Loaded pages are merged by ID; refresh replaces the
fetched versions without discarding already loaded history. If more than a full
window arrives between refreshes, the cursor moves to the new window's boundary
so the gap remains retrievable with Load older.

The visible selected thread marks only the incoming message IDs actually fetched
as read. Incoming rows arriving after that read are not blindly marked. Failed
requests retain prior unread state and show a retry action. Read writes happen
in authenticated API requests, never the initial server render. Polling pauses
when hidden and refreshes on return. Requests are coalesced, abortable on thread
switch, timed out after 20 seconds, and stale responses cannot overwrite the
current selection. Older loaded history is preserved while newer messages arrive.

No database schema or migration changes are included. Existing indexes are used;
real query plans, high concurrency, and database integration are not established
by mocked unit tests. Authenticated browser/end-to-end coverage is also separate
from isolated client lifecycle tests and the default build.

## Historical quote and inquiry behavior

An older quote is refreshed through the same authorization scope before it is
opened. The focused quote continues to refresh on subsequent polls. Legacy
inquiry messages are no longer paired with independent inquiry pages by array
position; only explicit inquiry IDs attach a brief to a message. An unloaded
brief leaves a readable placeholder, and its inquiry history remains pageable.

Historical vendor quotes are view-only. Older unquoted requests have no Build
control. The current request retains the existing editor workflow. The existing
quote-writing API still selects the latest request at submission; this candidate
does not claim to fix its pre-existing concurrent-edit/creation race. No quote,
order, Stripe, or checkout mutation API is changed.

## Validation and remaining limits

The isolated unit suite, TypeScript, ESLint, and default production build run
without any real database. Tests mock Prisma and block accidental connections.
The build uses a disabled loopback database URL. Existing image lint warnings
remain. There are no new dependencies or services.

Bounded returned rows do not establish bounded database work: current indexes
may still require scans/sorts for timestamp/id ordering and unread aggregation.
Real PostgreSQL query plans and concurrent-user load remain unverified. Existing
mobile consumers keep the original first-30/unbounded-history behavior until
explicitly migrated. Message-history scroll anchoring is implemented; detailed
inquiry/quote-card geometry still needs authenticated browser QA.
