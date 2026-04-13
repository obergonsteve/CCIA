"use client";

import { BrainstormCallControls } from "@/components/grithub-live-port/brainstorm-call-controls";
import { BrainstormScreenShareBlock } from "@/components/grithub-live-port/brainstorm-screen-share-block";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Room } from "livekit-client";
import { format } from "date-fns";
import { Loader2, Pencil, Video } from "lucide-react";
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

  const joinLive = useCallback(async () => {
    if (!session) return;
    setJoining(true);
    try {
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
      toast.error(e instanceof Error ? e.message : "Could not join the live room.");
    } finally {
      setJoining(false);
    }
  }, [getToken, session]);

  const onSendChat = useCallback(async () => {
    if (!session || !draft.trim()) return;
    try {
      await sendChat({ workshopSessionId: session._id, text: draft });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    }
  }, [draft, sendChat, session]);

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
        className={`rounded-lg border border-slate-300 flex flex-col min-w-0 ${
          liveKitCredentials
            ? "bg-gradient-to-b from-cyan-100/80 via-cyan-100/65 to-cyan-200/55 dark:from-cyan-950/40 dark:via-cyan-950/30 dark:to-slate-900/60"
            : "items-center justify-center gap-4 p-6 text-center bg-gradient-to-b from-cyan-100/90 via-cyan-100/75 to-cyan-200/60 dark:from-cyan-950/35 dark:via-cyan-950/25 dark:to-slate-900/50"
        }`}
      >
        {liveKitCredentials && !sessionEnded ? (
          <div
            className="livekit-workshop-room rounded-lg overflow-hidden flex flex-col bg-[linear-gradient(to_right,#b6cad4_0%,#c2d6df_22%,#d6e6ec_50%,#c2d6df_78%,#b6cad4_100%)] dark:bg-[linear-gradient(to_right,#1e293b_0%,#334155_50%,#1e293b_100%)] flex-1 min-h-[260px] min-w-0"
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
              <BrainstormScreenShareBlock />
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <VideoConference />
              </div>
              <BrainstormCallControls />
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
            <Button
              type="button"
              onClick={() => void joinLive()}
              disabled={joining}
              className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              Join live session
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/50 flex flex-col min-h-[200px] max-h-[320px]">
        <div className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Session chat
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
          {messages === undefined ? (
            <p className="text-xs text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m._id} className="text-sm">
                <span className="font-medium" style={{ color: m.color }}>
                  {m.name}
                </span>
                <span className="text-muted-foreground text-xs ml-2">
                  {format(new Date(m.createdAt), "p")}
                </span>
                <p className="text-foreground whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="shrink-0 border-t border-border p-2 flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              sessionEnded ? "Session ended — chat is read-only" : "Message…"
            }
            disabled={sessionEnded}
            rows={2}
            className="flex-1 min-w-0 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
  );
}
