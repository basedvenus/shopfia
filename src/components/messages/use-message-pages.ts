"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { mergeMessagePages } from "@/lib/messages/client-state";
import type { MessagePage, PagedMessagesPayload } from "@/lib/messages/paged-query";

export function isMessagesVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function useMessagePages(initialPayload: PagedMessagesPayload, selectedConversationId: string | null, threadVisible = true) {
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canMarkRead = useRef(threadVisible);
  const selected = useRef(selectedConversationId);
  const active = useRef<AbortController | null>(null);
  const pendingRefresh = useRef(false);
  const pendingWaiters = useRef<Array<(payload: PagedMessagesPayload | undefined) => void>>([]);
  const focusedQuote = useRef<{ conversationId: string | null; id?: string; orderId?: string } | null>(null);
  const extendedInbox = useRef(false);
  const refreshRef = useRef<() => Promise<PagedMessagesPayload | undefined>>(async () => undefined);
  useLayoutEffect(() => {
    canMarkRead.current = threadVisible;
    selected.current = selectedConversationId;
  }, [threadVisible, selectedConversationId]);

  const requestPage = useCallback(async (page: MessagePage, cursor?: string | null, markRead = false): Promise<PagedMessagesPayload | undefined> => {
    if (!isMessagesVisible() || selected.current !== selectedConversationId) return;
    if (active.current) {
      if (page === "refresh") {
        pendingRefresh.current = true;
        return new Promise((resolve) => { pendingWaiters.current.push(resolve); });
      }
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    const requestedConversation = selectedConversationId;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ paged: "1", page });
      if (requestedConversation) params.set("conversationId", requestedConversation);
      if (cursor) params.set("cursor", cursor);
      if (markRead && canMarkRead.current) params.set("markRead", "1");
      if (page === "refresh" && focusedQuote.current?.conversationId === requestedConversation) {
        if (focusedQuote.current.id) params.set("quoteRequestId", focusedQuote.current.id);
        else if (focusedQuote.current.orderId) params.set("orderId", focusedQuote.current.orderId);
      }
      const response = await fetch(`/api/messages?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Messages could not be refreshed. Please try again.");
      const next = await response.json() as PagedMessagesPayload;
      if (controller.signal.aborted || active.current !== controller || selected.current !== requestedConversation) return;
      if (page === "conversations") extendedInbox.current = true;
      setPayload((previous) => mergeMessagePages(previous, next, extendedInbox.current));
      return next;
    } catch {
      if (active.current === controller && selected.current === requestedConversation && isMessagesVisible()) {
        setError("Messages could not be refreshed. Please try again.");
      }
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
        if (pendingRefresh.current) {
          pendingRefresh.current = false;
          const waiters = pendingWaiters.current.splice(0);
          void refreshRef.current().then((result) => waiters.forEach((resolve) => resolve(result)));
        }
      }
    }
  }, [selectedConversationId]);

  const refreshMessages = useCallback(async ({ markRead = true, quoteRequestId, orderId }: { markRead?: boolean; quoteRequestId?: string; orderId?: string } = {}) => {
    if (selected.current !== selectedConversationId) return;
    if (quoteRequestId || orderId) focusedQuote.current = { conversationId: selectedConversationId, id: quoteRequestId, orderId };
    return requestPage("refresh", null, markRead);
  }, [requestPage, selectedConversationId]);
  useLayoutEffect(() => {
    refreshRef.current = () => refreshMessages();
  }, [refreshMessages]);

  const loadPage = useCallback(async (page: Exclude<MessagePage, "refresh">, cursor: string | null) => {
    if (!cursor) return;
    await requestPage(page, cursor, page !== "conversations");
  }, [requestPage]);

  useEffect(() => {
    return () => {
      active.current?.abort();
      active.current = null;
      pendingRefresh.current = false;
      pendingWaiters.current.splice(0).forEach((resolve) => resolve(undefined));
      focusedQuote.current = null;
    };
  }, [selectedConversationId]);

  return { payload, refreshMessages, loadPage, loading, error };
}
