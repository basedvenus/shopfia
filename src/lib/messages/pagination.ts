export type MessagePage = "refresh" | "conversations" | "messages" | "inquiries" | "quoteRequests";
export type MessageCollection = Exclude<MessagePage, "refresh">;

export class InvalidMessageCursorError extends Error {
  constructor() {
    super("Invalid pagination cursor");
    this.name = "InvalidMessageCursorError";
  }
}

type CursorScope = {
  userId: string;
  collection: MessageCollection;
  conversationId: string | null;
};

export type MessageCursor = CursorScope & {
  timestamp: string;
  id: string;
};

// Cursors are navigation hints, not authorization tokens. Every query must also
// enforce the authenticated user's participant scope. URI encoding works on the
// server and in the browser and does not require secrets or Node's Buffer API.
export function encodeMessageCursor(cursor: MessageCursor): string {
  return encodeURIComponent(JSON.stringify({ version: 1, ...cursor }));
}

export function decodeMessageCursor(cursor: string, expected: CursorScope): MessageCursor {
  try {
    if (!cursor || cursor.length > 2048) throw new InvalidMessageCursorError();
    const value: unknown = JSON.parse(decodeURIComponent(cursor));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvalidMessageCursorError();
    const decoded = value as Record<string, unknown>;
    if (
      decoded.version !== 1 ||
      decoded.userId !== expected.userId ||
      decoded.collection !== expected.collection ||
      decoded.conversationId !== expected.conversationId ||
      typeof decoded.id !== "string" || !decoded.id || decoded.id.length > 256 ||
      typeof decoded.timestamp !== "string" ||
      !Number.isFinite(Date.parse(decoded.timestamp)) ||
      new Date(decoded.timestamp).toISOString() !== decoded.timestamp
    ) {
      throw new InvalidMessageCursorError();
    }
    return {
      userId: expected.userId,
      collection: expected.collection,
      conversationId: expected.conversationId,
      timestamp: decoded.timestamp,
      id: decoded.id
    };
  } catch {
    // Deliberately identical for malformed, cross-user and cross-thread cursors.
    throw new InvalidMessageCursorError();
  }
}
