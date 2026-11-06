import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Bot, Loader2, MessageCircle, Minus, Send, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import Markdown from "./Markdown";
import "./Chatbot.css";

const TOP_THRESHOLD_PX = 40; // how close to the top counts as "scrolled up"
const BOTTOM_THRESHOLD_PX = 80; // how close to the bottom counts as "at latest"
const STATUS_ACTIVE = "CONVERSATION_STATUS_ACTIVE";

// protobuf-JSON encodes int64 as strings and drops zero-valued fields.
const toMessage = (m) => ({
  id: m.message_id,
  role: m.role === "ROLE_USER" ? "user" : "assistant",
  content: m.content || "",
  createdUnix: Number(m.created_unix || 0),
});

const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const pad2 = (n) => String(n).padStart(2, "0");

// -> "1:24pm"
function formatClock(d) {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(d.getMinutes())}${h >= 12 ? "pm" : "am"}`;
}

// -> "23/10/26 1:24pm"  (used inside every message bubble)
function formatMsgTime(unix) {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${pad2(d.getFullYear() % 100)} ${formatClock(d)}`;
}

// -> "Today, 1:24pm" / "Yesterday, 1:24pm" / "23 Oct 2026, 1:24pm"  (conversation divider)
function formatStamp(unix) {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const now = new Date();
  const time = formatClock(d);
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

export default function Chatbot() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  // Conversations ordered oldest -> newest. Each: { id, createdUnix, active, messages[] }
  const [groups, setGroups] = useState([]);
  const [pending, setPending] = useState(null); // optimistic user message
  const [input, setInput] = useState("");
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const initializedRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const nextOffsetRef = useRef(0); // offset of the next-older conversation to fetch
  const stickToBottomRef = useRef(true);
  const prependAnchorRef = useRef(null); // scrollHeight before prepending older msgs

  /* ---------- data loading ---------- */

  const fetchConversationAt = useCallback(async (offset) => {
    const list = await api.chatConversations({ limit: 1, offset });
    const conv = (list.conversations || [])[0];
    if (!conv) return null;
    const res = await api.chatMessages(conv.conversation_id);
    return {
      id: conv.conversation_id,
      createdUnix: Number(conv.created_unix || 0),
      active: conv.status === STATUS_ACTIVE,
      messages: (res.messages || []).map(toMessage),
    };
  }, []);

  const loadLatest = useCallback(async () => {
    setInitialLoading(true);
    setError("");
    try {
      const conv = await fetchConversationAt(0);
      if (conv) {
        stickToBottomRef.current = true;
        setGroups([conv]);
        nextOffsetRef.current = 1;
        setHasMore(true);
      } else {
        setGroups([]);
        setHasMore(false);
      }
      initializedRef.current = true;
    } catch (e) {
      setError(e.message || "Could not load your chat history.");
    } finally {
      setInitialLoading(false);
    }
  }, [fetchConversationAt]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || !initializedRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const conv = await fetchConversationAt(nextOffsetRef.current);
      if (!conv) {
        setHasMore(false);
        return;
      }
      nextOffsetRef.current += 1;
      const el = scrollRef.current;
      prependAnchorRef.current = el
        ? { height: el.scrollHeight, top: el.scrollTop }
        : null;
      setGroups((prev) => [conv, ...prev]);
    } catch (e) {
      setError(e.message || "Could not load earlier messages.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [fetchConversationAt, hasMore]);

  // Load the most recent conversation the first time the window is opened (logged-in only).
  useEffect(() => {
    if (open && isAuthenticated && !initializedRef.current && !initialLoading)
      loadLatest();
  }, [open, isAuthenticated, initialLoading, loadLatest]);

  // Clear everything on logout so the next login starts fresh.
  useEffect(() => {
    if (!isAuthenticated) {
      initializedRef.current = false;
      nextOffsetRef.current = 0;
      setGroups([]);
      setPending(null);
      setInput("");
      setError("");
      setHasMore(true);
    }
  }, [isAuthenticated]);

  /* ---------- scroll management ---------- */

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependAnchorRef.current) {
      // Older messages were added above: keep the user's current view in place.
      const { height, top } = prependAnchorRef.current;
      el.scrollTop = el.scrollHeight - height + top;
      prependAnchorRef.current = null;
      return;
    }
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [groups, pending, sending, open, initialLoading]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
    if (el.scrollTop < TOP_THRESHOLD_PX) loadOlder();
  };

  /* ---------- sending ---------- */

  const applyResponse = useCallback((res) => {
    const convId = res.conversation_id;
    const userMsg = toMessage(res.user_message || {});
    const botMsg = toMessage(res.assistant_message || {});
    setGroups((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === convId) {
        return [
          ...prev.slice(0, -1),
          { ...last, messages: [...last.messages, userMsg, botMsg] },
        ];
      }
      // A new conversation was started (first chat, or the previous one ended / timed out).
      // It sits at offset 0 server-side, so older pages shift by one.
      nextOffsetRef.current += 1;
      const closedPrev = prev.map((g, i) =>
        i === prev.length - 1 ? { ...g, active: false } : g,
      );
      return [
        ...closedPrev,
        {
          id: convId,
          createdUnix: userMsg.createdUnix,
          active: true,
          messages: [userMsg, botMsg],
        },
      ];
    });
  }, []);

  const send = useCallback(
    async (text, key) => {
      const idempotencyKey = key || newKey();
      stickToBottomRef.current = true;
      setSending(true);
      setError("");
      setPending({ key: idempotencyKey, content: text, failed: false });
      try {
        const res = await api.sendChatMessage({
          message: text,
          client_idempotency_key: idempotencyKey,
        });
        applyResponse(res);
        setPending(null);
      } catch (e) {
        setPending({ key: idempotencyKey, content: text, failed: true });
        setError(e.message || "Message could not be sent.");
      } finally {
        setSending(false);
      }
    },
    [applyResponse],
  );

  const submit = () => {
    const text = input.trim();
    if (!text || sending || initialLoading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    send(text);
  };

  const retry = () => {
    if (pending && pending.failed && !sending)
      send(pending.content, pending.key);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInputChange = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 110)}px`;
  };

  /* ---------- window controls ---------- */

  const minimize = () => setOpen(false);

  // X ends the active conversation on the server and closes the window.
  const closeChat = async () => {
    setOpen(false);
    const hasActive = groups.some((g) => g.active);
    if (hasActive) {
      try {
        await api.closeChatConversation();
      } catch {
        /* non-fatal: it will idle out server-side */
      }
    }
    // Reset so the next open reloads fresh from the server.
    initializedRef.current = false;
    nextOffsetRef.current = 0;
    setGroups([]);
    setPending(null);
    setInput("");
    setError("");
    setHasMore(true);
  };

  /* ---------- render ---------- */

  const isEmpty = !initialLoading && groups.length === 0 && !pending;

  return (
    <>
      {open && (
        <section
          className="chatbot-window"
          role="dialog"
          aria-label="Nexus assistant"
        >
          <header className="chatbot-header">
            <div className="chatbot-header__title">
              <span className="chatbot-header__avatar">
                <Bot size={18} />
              </span>
              <div>
                <strong>Nexus Assistant</strong>
                <small>Ask about bookings &amp; availability</small>
              </div>
            </div>
            <div className="chatbot-header__actions">
              <button
                type="button"
                onClick={minimize}
                aria-label="Minimize chat"
                title="Minimize"
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                onClick={closeChat}
                aria-label="End and close chat"
                title="End chat & close"
              >
                <X size={18} />
              </button>
            </div>
          </header>
          {!isAuthenticated ? (
            <div className="chatbot-login">
              <Bot size={30} />
              <p>Please log in to chat with the assistant.</p>
              <div className="chatbot-login__actions">
                <Link
                  to="/login"
                  className="chatbot-login__btn"
                  onClick={minimize}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="chatbot-login__btn chatbot-login__btn--ghost"
                  onClick={minimize}
                >
                  Register
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="chatbot-body" ref={scrollRef} onScroll={onScroll}>
                {initialLoading && (
                  <div className="chatbot-status">
                    <Loader2 size={16} className="chatbot-spin" /> Loading chat…
                  </div>
                )}

                {!initialLoading && hasMore && groups.length > 0 && (
                  <div className="chatbot-older">
                    {loadingOlder ? (
                      <span className="chatbot-status">
                        <Loader2 size={14} className="chatbot-spin" /> Loading
                        earlier messages…
                      </span>
                    ) : (
                      <button type="button" onClick={loadOlder}>
                        Load earlier messages
                      </button>
                    )}
                  </div>
                )}

                {isEmpty && (
                  <div className="chatbot-empty">
                    <Bot size={30} />
                    <p>
                      Hi! I can help you find resources, check slots and manage
                      your bookings.
                    </p>
                  </div>
                )}

                {groups.map((g) => (
                  <div className="chatbot-group" key={g.id}>
                    <div className="chatbot-divider">
                      <span>{formatStamp(g.createdUnix)}</span>
                    </div>
                    {g.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`chatbot-msg chatbot-msg--${m.role}`}
                      >
                        <div className="chatbot-bubble">
                          {m.role === "assistant" && (
                            <div className="chatbot-sender">Agent</div>
                          )}
                          <div className="chatbot-text">
                            {m.role === "assistant" ? (
                              <Markdown text={m.content} />
                            ) : (
                              m.content
                            )}
                          </div>
                          {m.createdUnix > 0 && (
                            <div className="chatbot-time">
                              {formatMsgTime(m.createdUnix)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {!g.active && (
                      <div className="chatbot-divider chatbot-divider--end">
                        <span>Conversation ended</span>
                      </div>
                    )}
                  </div>
                ))}

                {pending && (
                  <div className="chatbot-msg chatbot-msg--user">
                    <div
                      className={`chatbot-bubble${pending.failed ? " chatbot-bubble--failed" : ""}`}
                    >
                      <div className="chatbot-text">{pending.content}</div>
                      {!pending.failed && (
                        <div className="chatbot-time">Sending…</div>
                      )}
                    </div>
                    {pending.failed && (
                      <button
                        type="button"
                        className="chatbot-retry"
                        onClick={retry}
                      >
                        Failed to send · Retry
                      </button>
                    )}
                  </div>
                )}

                {sending && (
                  <div className="chatbot-msg chatbot-msg--assistant">
                    <div
                      className="chatbot-bubble"
                      aria-label="Assistant is typing"
                    >
                      <div className="chatbot-sender">Agent</div>
                      <div className="chatbot-typing">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && !pending?.failed && (
                <div className="chatbot-error" role="alert">
                  {error}
                </div>
              )}

              <footer className="chatbot-input">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={onKeyDown}
                  placeholder="Type a message…"
                  disabled={initialLoading}
                  aria-label="Message"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!input.trim() || sending || initialLoading}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </footer>
            </>
          )}
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="chatbot-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
        >
          <MessageCircle size={26} />
        </button>
      )}
    </>
  );
}
