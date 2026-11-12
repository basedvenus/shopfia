CREATE TABLE "ConversationInboxState" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
    "state" TEXT NOT NULL CHECK ("state" IN ('archived', 'deleted')),
    PRIMARY KEY ("userId", "conversationId")
);

CREATE INDEX "ConversationInboxState_conversationId_idx"
    ON "ConversationInboxState" ("conversationId");
