"use client";

import { BrainstormCallControls } from "@/components/grithub-live-port/brainstorm-call-controls";
import { WorkshopWhiteboard } from "@/components/grithub-live-port/workshop-whiteboard";
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
import { ChevronDown, ChevronUp, Loader2, Smile, Video } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type LiveKitCreds = { token: string; serverUrl: string };

const liveKitRoomFrameStyle: CSSProperties = { height: "100%" };

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
  const setWhiteboardVisible = useMutation(
    api.workshops.setWorkshopWhiteboardVisible,
  );
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
  const [chatSectionExpanded, setChatSectionExpanded] = useState(false);
  const chatSectionId = "workshop-session-chat-panel";
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
  /** Show unless host explicitly hid it (`false`). Matches GritHub: board is part of the live session by default. */
  const whiteboardLive = session?.whiteboardVisible !== false;

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
          <p className="text-muted-foreground">
            This session has ended. You can still read chat; the live room is
            closed.
          </p>
        ) : null}
        {isLiveHost &&
        liveRoomStarted &&
        !sessionEnded &&
        liveKitCredentials ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              title={
                whiteboardLive
                  ? "Stop showing the whiteboard to everyone in the room"
                  : "Show the whiteboard to everyone in the room"
              }
              variant={whiteboardLive ? "default" : "outline"}
              className={
                whiteboardLive
                  ? "h-8 bg-cyan-600 text-white hover:bg-cyan-700"
                  : "h-8"
              }
              onClick={async () => {
                if (!session) return;
                try {
                  await setWhiteboardVisible({
                    workshopSessionId: session._id,
                    visible: !whiteboardLive,
                  });
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Could not update whiteboard.",
                  );
                }
              }}
            >
              {whiteboardLive ? "Hide whiteboard" : "Share whiteboard"}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col rounded-lg border border-sky-200/85 bg-muted/25 ring-1 ring-sky-200/45 dark:border-sky-800/50 dark:bg-muted/35 dark:ring-sky-800/35",
          liveKitCredentials ? "p-2" : "p-4",
          !liveKitCredentials && !joining && "items-center justify-center gap-4 text-center",
        )}
      >
        {liveKitCredentials && !sessionEnded ? (
          <div
            className="livekit-workshop-room flex min-h-[220px] min-w-0 flex-1 flex-col overflow-hidden rounded-md"
            data-lk-theme="default"
          >
            {/*
              Convex whiteboard syncs to everyone in this session who has joined the
              live room (same gate as LiveKit). Not shown until connected so we only
              expose ink to registered attendees who are actually in the call.
            */}
            {liveRoomStarted && whiteboardLive ? (
              <div className="mb-2 min-h-0 w-full shrink-0 px-0.5 pt-0.5">
                <WorkshopWhiteboard
                  workshopSessionId={sessionDoc._id}
                  canClearForEveryone={Boolean(
                    isLiveHost &&
                      liveRoomStarted &&
                      !sessionEnded &&
                      liveKitCredentials,
                  )}
                />
              </div>
            ) : null}
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

      <div className="min-w-0">
      {!chatSectionExpanded ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-sky-300/75 bg-sky-200/80 px-3 py-2.5 text-left shadow-sm ring-1 ring-sky-300/40 transition-colors hover:bg-sky-300/55 dark:border-sky-700/50 dark:bg-sky-950/60 dark:ring-sky-800/45 dark:hover:bg-sky-900/55"
          aria-expanded={false}
          onClick={() => setChatSectionExpanded(true)}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-sky-950/85 dark:text-sky-100/90">
            Session chat
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-sky-800/70 dark:text-sky-200/80"
            aria-hidden
          />
        </button>
      ) : (
      <div
        id={chatSectionId}
        className={cn(
          "grid min-h-[364px] grid-rows-[auto_minmax(20.8rem,1fr)_auto] overflow-hidden rounded-lg border border-border bg-muted/25 ring-1 ring-border/30 dark:bg-muted/35",
          !chatEmojiStripOpen && "max-h-[min(676px,72vh)]",
          chatEmojiStripOpen &&
            !chatEmojiStripExpanded &&
            "max-h-[min(728px,78vh)] sm:max-h-[min(780px,82vh)]",
          chatEmojiStripOpen &&
            chatEmojiStripExpanded &&
            "max-h-[min(832px,85vh)] sm:max-h-[min(884px,88vh)]",
        )}
      >
        <div className="flex min-h-0 items-center justify-between gap-2 border-b border-sky-300/75 bg-sky-200/80 px-2 py-1.5 sm:px-3 dark:border-sky-700/50 dark:bg-sky-950/60">
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-sky-950/85 dark:text-sky-100/90">
            Session chat
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sky-900/80 transition-colors hover:bg-sky-300/50 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-sky-100/90 dark:hover:bg-sky-900/80 dark:hover:text-sky-50"
            aria-expanded={true}
            aria-controls={chatSectionId}
            aria-label="Collapse session chat"
            onClick={() => setChatSectionExpanded(false)}
          >
            <ChevronUp className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 space-y-1 overflow-y-auto bg-sky-200/45 px-3 py-1.5 dark:bg-sky-900/35">
          {messages === undefined ? (
            <p className="text-xs text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m._id}
                className="rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs shadow-sm dark:bg-muted/50"
              >
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-medium" style={{ color: m.color }}>
                    {m.name}
                  </span>
                  <span
                    className="select-none text-muted-foreground/70"
                    aria-hidden
                  >
                    ·
                  </span>
                  <time
                    className="text-[11px] text-muted-foreground tabular-nums"
                    dateTime={new Date(m.createdAt).toISOString()}
                  >
                    {format(new Date(m.createdAt), "p")}
                  </time>
                </div>
                <p className="mt-1 text-foreground whitespace-pre-wrap break-words [font-family:ui-sans-serif,system-ui,sans-serif,'Apple_Color_Emoji','Segoe_UI_Emoji','Segoe_UI_Symbol','Noto_Color_Emoji']">
                  {m.text}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-2 border-t border-sky-300/80 bg-sky-200/85 p-2 dark:border-sky-700/45 dark:bg-sky-950/60">
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
      )}
      </div>
    </div>
  );
}
