"use client";

import { BrainstormCallControls } from "@/components/grithub-live-port/brainstorm-call-controls";
import { WorkshopVideoConference } from "@/components/grithub-live-port/workshop-video-conference";
import { WorkshopRoomParticipants } from "@/components/grithub-live-port/workshop-room-participants";
import { EmojiStrip } from "@/components/grithub-live-port/emoji-strip";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  LiveKitRoom,
  StartMediaButton,
} from "@livekit/components-react";
import "@livekit/components-styles";
import "./workshop-livekit-overrides.css";
import { Room } from "livekit-client";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2, Pencil, Smile, Video } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** Flip on when the shared whiteboard path from Brainstorm is wired. */
const WORKSHOP_WHITEBOARD_ENABLED = false;

type LiveKitCreds = { token: string; serverUrl: string };

const liveKitRoomFrameStyle: CSSProperties = { height: "100%" };

function WorkshopWhiteboardPlaceholder() {
  if (WORKSHOP_WHITEBOARD_ENABLED) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>
        Shared whiteboard and drawing tools are included in the reference build
        but stay <span className="font-medium text-foreground">off</span> until
        you enable them in code.
      </p>
    </div>
  );
}

export function WorkshopLivePanel({
  workshopUnitId,
}: {
  workshopUnitId: Id<"units">;
}) {
  const sessionRow = useQuery(
    api.workshops.myRegisteredSessionForLiveWorkshopUnit,
    { workshopUnitId },
  );

  /**
   * Convex can briefly yield `undefined` while reconnecting. Returning the
   * loading branch unmounts LiveKitRoom → room.disconnect() → onDisconnected
   * clears credentials ("joins then immediately leaves"). Keep last known
   * session while in-flight or while a call is active.
   */
  const lastSessionRef = useRef<Doc<"workshopSessions"> | null>(null);
  if (sessionRow?.session) {
    lastSessionRef.current = sessionRow.session;
  }
  if (sessionRow === null) {
    lastSessionRef.current = null;
  }
  const session =
    sessionRow?.session ?? lastSessionRef.current ?? undefined;

  const messages = useQuery(
    api.workshopSessionChat.listWorkshopSessionChatMessages,
    session?._id != null ? { workshopSessionId: session._id } : "skip",
  );
  const sendChat = useMutation(api.workshopSessionChat.sendWorkshopSessionChatMessage);
  const getToken = useAction(api.workshopLiveKitAction.getWorkshopLiveKitToken);
  const endLiveRoomForEveryone = useAction(
    api.workshopLiveKitAction.endWorkshopLiveKitRoomForEveryone,
  );
  const openLiveRoom = useMutation(api.workshops.openWorkshopLiveRoom);
  const me = useQuery(api.users.me, {});

  /**
   * One `Room` per panel instance, passed into `LiveKitRoom` as `room`. Without
   * this, `@livekit/components-react` creates a new `Room` inside an effect;
   * React Strict / effect re-runs can replace the instance, whose cleanup calls
   * `disconnect()` and looks like an immediate drop from the call.
   */
  const [persistedLkRoom] = useState(() => new Room());

  useEffect(() => {
    return () => {
      void persistedLkRoom.disconnect();
    };
  }, [persistedLkRoom]);

  const [liveKitCredentials, setLiveKitCredentials] =
    useState<LiveKitCreds | null>(null);
  const [joining, setJoining] = useState(false);
  const [draft, setDraft] = useState("");
  const [chatEmojiStripOpen, setChatEmojiStripOpen] = useState(false);
  const [chatEmojiStripExpanded, setChatEmojiStripExpanded] = useState(false);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  const sessionEnded = useMemo(() => {
    if (!session) return true;
    return session.endsAt < Date.now();
  }, [session]);

  const handleRoomDisconnected = useCallback(() => {
    setLiveKitCredentials(null);
  }, []);

  const handleLiveKitError = useCallback((error: Error) => {
    toast.error(error.message);
    setLiveKitCredentials(null);
  }, []);

  const isLiveHost =
    me?.role === "admin" || me?.role === "content_creator";
  const liveRoomStarted = Boolean(session?.liveRoomOpenedAt);

  const onHostEndCallForEveryone = useCallback(async () => {
    if (!session) {
      return { error: "No active session." };
    }
    const result = await endLiveRoomForEveryone({
      workshopSessionId: session._id,
    });
    if ("error" in result) {
      toast.error(result.error);
      return { error: result.error };
    }
    return;
  }, [endLiveRoomForEveryone, session]);

  const startLiveRoomAndJoin = useCallback(async () => {
    if (!session) return;
    setJoining(true);
    try {
      if (isLiveHost && session.liveRoomOpenedAt == null) {
        await openLiveRoom({ workshopSessionId: session._id });
      }
      const result = await getToken({ workshopSessionId: session._id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setLiveKitCredentials({
        token: result.token,
        serverUrl: result.serverUrl,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not start or join the live room.",
      );
    } finally {
      setJoining(false);
    }
  }, [getToken, isLiveHost, openLiveRoom, session]);

  const onSendChat = useCallback(async () => {
    if (!session || !draft.trim()) return;
    try {
      await sendChat({ workshopSessionId: session._id, text: draft });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    }
  }, [draft, sendChat, session]);

  const insertChatEmoji = useCallback(
    (emoji: string) => {
      const ta = chatTextareaRef.current;
      const v = draft;
      if (ta && document.activeElement === ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const next = v.slice(0, start) + emoji + v.slice(end);
        setDraft(next);
        requestAnimationFrame(() => {
          const el = chatTextareaRef.current;
          if (!el) return;
          const pos = start + emoji.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        });
      } else {
        setDraft(v + emoji);
        requestAnimationFrame(() => chatTextareaRef.current?.focus());
      }
    },
    [draft],
  );

  if (sessionRow === undefined && liveKitCredentials === null) {
    return (
      <div className="animate-pulse rounded-lg bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
        Loading workshop session…
      </div>
    );
  }

  if (sessionRow === null && liveKitCredentials === null) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Register for a scheduled session for this unit to open the live room
          and chat.
        </p>
        <Link
          href="/workshops"
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Browse workshops
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load this workshop session. Try refreshing the page.
      </p>
    );
  }

  const sessionDoc = session;
  const title =
    sessionDoc.titleOverride?.trim() ||
    format(new Date(sessionDoc.startsAt), "PPp");

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">Your session</p>
        <p className="text-muted-foreground">{title}</p>
        {sessionEnded ? (
          <p className="text-amber-800 dark:text-amber-200/90">
            This session has ended. You can still read chat; the live room is
            closed.
          </p>
        ) : null}
      </div>

      <WorkshopWhiteboardPlaceholder />

      <div
        className={cn(
          "flex min-w-0 flex-col rounded-lg border border-amber-400/70 bg-amber-50/55 ring-1 ring-amber-400/20 dark:border-amber-500/45 dark:bg-muted/45 dark:ring-amber-500/15",
          liveKitCredentials ? "p-2" : "items-center justify-center gap-4 p-6 text-center",
        )}
      >
        {liveKitCredentials && !sessionEnded ? (
          <div
            className="livekit-workshop-room flex min-h-[260px] min-w-0 flex-1 flex-col overflow-hidden rounded-md"
            data-lk-theme="default"
          >
            <LiveKitRoom
              room={persistedLkRoom}
              serverUrl={liveKitCredentials.serverUrl}
              token={liveKitCredentials.token}
              connect
              audio
              video
              onDisconnected={handleRoomDisconnected}
              onError={handleLiveKitError}
              className="flex flex-col flex-1 min-h-0 min-w-0"
              style={liveKitRoomFrameStyle}
            >
              <WorkshopRoomParticipants />
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <WorkshopVideoConference />
              </div>
              <StartMediaButton className="shrink-0 mx-auto my-1" />
              <BrainstormCallControls
                onHostEndCallForEveryone={
                  isLiveHost && liveRoomStarted && !sessionEnded
                    ? onHostEndCallForEveryone
                    : undefined
                }
              />
            </LiveKitRoom>
          </div>
        ) : sessionEnded ? (
          <p className="text-sm text-muted-foreground px-2 py-4">
            Live video is not available after the session end time.
          </p>
        ) : joining ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 px-4">
            <Loader2
              className="h-10 w-10 animate-spin text-cyan-600 dark:text-cyan-400"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground text-center">
              Connecting to the room…
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 px-2">
            {me === undefined ? (
              <Button type="button" disabled variant="secondary" size="sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void startLiveRoomAndJoin()}
                disabled={joining || (!isLiveHost && !liveRoomStarted)}
                className={
                  !isLiveHost && !liveRoomStarted
                    ? undefined
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }
                variant={!isLiveHost && !liveRoomStarted ? "secondary" : "default"}
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : !isLiveHost && !liveRoomStarted ? null : (
                  <Video className="h-4 w-4" aria-hidden />
                )}
                {!isLiveHost && !liveRoomStarted
                  ? "Waiting for host to start"
                  : isLiveHost && !liveRoomStarted
                    ? "Start live session"
                    : "Join live session"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid min-h-[200px] grid-rows-[auto_minmax(7rem,1fr)_auto] overflow-hidden rounded-lg border border-amber-400/70 bg-amber-50/55 ring-1 ring-amber-400/20 dark:border-amber-500/45 dark:bg-muted/45 dark:ring-amber-500/15",
          !chatEmojiStripOpen && "max-h-[min(320px,50vh)]",
          chatEmojiStripOpen &&
            !chatEmojiStripExpanded &&
            "max-h-[min(440px,62vh)] sm:max-h-[min(480px,68vh)]",
          chatEmojiStripOpen &&
            chatEmojiStripExpanded &&
            "max-h-[min(520px,72vh)] sm:max-h-[min(560px,78vh)]",
        )}
      >
        <div className="border-b border-amber-200/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-amber-800/45">
          Session chat
        </div>
        <div className="min-h-0 space-y-1 overflow-y-auto px-3 py-1.5">
          {messages === undefined ? (
            <p className="text-xs text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m._id}
                className="rounded-md bg-muted/35 px-2 py-1 text-xs leading-tight ring-1 ring-border/40 dark:bg-muted/25 dark:ring-border/30"
              >
                <span className="font-medium" style={{ color: m.color }}>
                  {m.name}
                </span>
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
                  {format(new Date(m.createdAt), "p")}
                </span>
                <p className="mt-px text-foreground whitespace-pre-wrap break-words [font-family:ui-sans-serif,system-ui,sans-serif,'Apple_Color_Emoji','Segoe_UI_Emoji','Segoe_UI_Symbol','Noto_Color_Emoji']">
                  {m.text}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-2 border-t border-amber-200/80 p-2 dark:border-amber-800/45">
          {!sessionEnded ? (
            <div className="flex min-h-0 flex-col gap-1">
              {chatEmojiStripOpen ? (
                <button
                  type="button"
                  onClick={() => setChatEmojiStripOpen(false)}
                  className="flex w-fit shrink-0 items-center gap-1.5 rounded py-1 pl-0 pr-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Hide emoji picker"
                >
                  Hide <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setChatEmojiStripOpen(true)}
                  className="flex w-fit shrink-0 items-center gap-1 rounded py-1 pl-0 pr-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Show emoji picker"
                >
                  <Smile className="h-4 w-4 shrink-0" aria-hidden />
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
              {chatEmojiStripOpen ? (
                <div
                  className={cn(
                    "min-h-0 max-h-[min(11rem,32vh)] overflow-y-auto overscroll-y-contain rounded-md border border-border bg-background/95 p-1.5 shadow-sm sm:max-h-[min(13rem,36vh)]",
                    chatEmojiStripExpanded &&
                      "max-h-[min(15rem,40vh)] sm:max-h-[min(17rem,44vh)]",
                  )}
                >
                  <EmojiStrip
                    onInsert={insertChatEmoji}
                    expanded={chatEmojiStripExpanded}
                    onToggleExpand={() => setChatEmojiStripExpanded((e) => !e)}
                    expandButtonClass="text-primary hover:text-primary/90 hover:underline"
                    buttonFocusRingClass="focus:ring-ring"
                    tabVariant="primary"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex shrink-0 gap-2">
          <textarea
            ref={chatTextareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              sessionEnded ? "Session ended — chat is read-only" : "Message…"
            }
            disabled={sessionEnded}
            rows={2}
            className="flex-1 min-w-0 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [font-family:ui-sans-serif,system-ui,sans-serif,'Apple_Color_Emoji','Segoe_UI_Emoji','Segoe_UI_Symbol','Noto_Color_Emoji']"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSendChat();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="self-end shrink-0"
            disabled={sessionEnded || !draft.trim()}
            onClick={() => void onSendChat()}
          >
            Send
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
