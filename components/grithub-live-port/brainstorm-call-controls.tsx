"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import {
  useDisconnectButton,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTrackToggle,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Loader2,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  StopCircle,
  Video,
  VideoOff,
} from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

function noopSubscribe() {
  return () => {};
}

function screenShareUnsupportedSnapshot(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!window.isSecureContext) {
    return "Screen share requires a secure page. Use HTTPS or http://localhost.";
  }
  const origin = window.location.origin ?? "";
  const isLocalhost =
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://localhost") ||
    origin.startsWith("https://127.0.0.1");
  if (!origin.startsWith("https://") && !isLocalhost) {
    return "Screen share requires HTTPS or http://localhost. Use a secure URL.";
  }
  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== "function"
  ) {
    return "Screen share is not supported in this browser. Use Chrome, Firefox, or Edge (desktop).";
  }
  const isLikelyMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    (navigator.maxTouchPoints > 2 && window.innerWidth < 900);
  if (isLikelyMobile) {
    return "Screen share is not available on mobile devices.";
  }
  return null;
}

const CALL_CONTROL_TOOLTIP_CLASS =
  "bg-slate-800 text-white text-xs rounded px-2.5 py-1.5 shadow-lg z-[100]";

/** Mic / camera / screen share / leave — used inside LiveKitRoom (ported from GritHub Brainstorm). */
export function BrainstormCallControls({
  onScreenShareActiveEnsureVideoVisible,
  onScreenShareEnd,
}: {
  onScreenShareActiveEnsureVideoVisible?: () => void;
  onScreenShareEnd?: () => void;
} = {}) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const camera = useTrackToggle({ source: Track.Source.Camera });
  const leave = useDisconnectButton({ stopTracks: true });
  const { stopTracks: _omitDisconnectStopTracks, ...leaveDomButtonProps } =
    leave.buttonProps as ButtonHTMLAttributes<HTMLButtonElement> & {
      stopTracks?: boolean;
    };
  void _omitDisconnectStopTracks;
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const screenShareTracksAll = useTracks([Track.Source.ScreenShare]);
  const firstScreenShareTrack = screenShareTracksAll[0];
  const hadRoomScreenShareRef = React.useRef(false);
  const roomScreenShareEndDebounceRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  React.useEffect(() => {
    if (!onScreenShareEnd) return;
    const hasScreenShare =
      firstScreenShareTrack != null && "participant" in firstScreenShareTrack;
    if (hasScreenShare) {
      hadRoomScreenShareRef.current = true;
      if (roomScreenShareEndDebounceRef.current) {
        clearTimeout(roomScreenShareEndDebounceRef.current);
        roomScreenShareEndDebounceRef.current = null;
      }
    } else if (hadRoomScreenShareRef.current) {
      if (roomScreenShareEndDebounceRef.current) {
        clearTimeout(roomScreenShareEndDebounceRef.current);
      }
      roomScreenShareEndDebounceRef.current = setTimeout(() => {
        hadRoomScreenShareRef.current = false;
        onScreenShareEnd();
        roomScreenShareEndDebounceRef.current = null;
      }, 400);
    }
  }, [firstScreenShareTrack, onScreenShareEnd]);

  const [screenSharePending, setScreenSharePending] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const envScreenShareUnsupported = useSyncExternalStore(
    noopSubscribe,
    screenShareUnsupportedSnapshot,
    () => null,
  );
  const [runtimeScreenShareUnsupported, setRuntimeScreenShareUnsupported] =
    useState<string | null>(null);
  const screenShareUnsupported =
    runtimeScreenShareUnsupported ?? envScreenShareUnsupported;

  const handleLeave = useCallback(async () => {
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
      }
    } catch {
      // ignore
    }
    leave.buttonProps.onClick?.();
  }, [leave.buttonProps, isScreenShareEnabled, localParticipant]);

  const someoneElseSharing = useMemo(() => {
    for (const p of remoteParticipants) {
      if (p.getTrackPublication(Track.Source.ScreenShare)) return true;
    }
    return false;
  }, [remoteParticipants]);

  const screenShareDisabled =
    someoneElseSharing || screenSharePending || !!screenShareUnsupported;

  const handleScreenShareClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setScreenShareError(null);
      setRuntimeScreenShareUnsupported(null);
      if (isScreenShareEnabled) {
        void localParticipant.setScreenShareEnabled(false);
        return;
      }
      if (someoneElseSharing) return;
      setScreenSharePending(true);
      // Default capture options: broadest browser support for the system picker.
      // (`selfBrowserSurface` + forced tab audio has caused silent failures in some Chrome builds.)
      localParticipant
        .setScreenShareEnabled(true, { audio: true })
        .then(() => setScreenShareError(null))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          const name = err instanceof Error ? err.name : "";
          const cause =
            err && typeof err === "object" && "cause" in err
              ? (err as { cause?: unknown }).cause
              : undefined;
          const errChain = [err, cause].filter(Boolean);
          const isUserCancelled = errChain.some(
            (e) =>
              e instanceof Error &&
              (e.name === "NotAllowedError" || e.name === "AbortError"),
          );
          if (isUserCancelled) {
            setScreenShareError(null);
            return;
          }
          const isNotSupported =
            name === "NotSupportedError" || msg === "Not supported";
          const userMsg = isNotSupported
            ? "Screen share isn't supported in this browser or context. Use HTTPS and a supported browser (Chrome, Firefox, Edge)."
            : `Screen share failed: ${msg}`;
          if (isNotSupported) {
            setRuntimeScreenShareUnsupported(userMsg);
          } else {
            setScreenShareError(userMsg);
          }
        })
        .finally(() => setScreenSharePending(false));
    },
    [localParticipant, isScreenShareEnabled, someoneElseSharing],
  );

  useEffect(() => {
    if (isScreenShareEnabled) onScreenShareActiveEnsureVideoVisible?.();
  }, [isScreenShareEnabled, onScreenShareActiveEnsureVideoVisible]);

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="shrink-0 flex flex-col border-t border-slate-500 bg-slate-500 rounded-b-lg">
        <div className="flex items-center justify-center gap-2 py-1 px-3 flex-wrap">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                {...mic.buttonProps}
                disabled={mic.pending}
                className="py-1.5 px-3 rounded-lg border border-cyan-400 bg-white text-cyan-800 font-medium text-xs hover:bg-cyan-50 inline-flex items-center justify-center disabled:opacity-50"
              >
                {mic.pending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mic.enabled ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className={CALL_CONTROL_TOOLTIP_CLASS}
                sideOffset={6}
                side="top"
              >
                {mic.enabled ? "Mute microphone" : "Unmute microphone"}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                {...camera.buttonProps}
                disabled={camera.pending}
                className="py-1.5 px-3 rounded-lg border border-cyan-400 bg-white text-cyan-800 font-medium text-xs hover:bg-cyan-50 inline-flex items-center justify-center disabled:opacity-50"
              >
                {camera.pending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : camera.enabled ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <VideoOff className="w-4 h-4" />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className={CALL_CONTROL_TOOLTIP_CLASS}
                sideOffset={6}
                side="top"
              >
                {camera.enabled ? "Turn off camera" : "Turn on camera"}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={handleScreenShareClick}
                disabled={screenShareDisabled}
                className={
                  isScreenShareEnabled
                    ? "py-1.5 px-3 rounded-lg border border-red-300 bg-red-50 text-red-800 font-medium text-xs hover:bg-red-100 inline-flex items-center justify-center disabled:opacity-50"
                    : "py-1.5 px-3 rounded-lg border border-cyan-400 bg-white text-cyan-800 font-medium text-xs hover:bg-cyan-50 inline-flex items-center justify-center disabled:opacity-50"
                }
              >
                {screenSharePending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isScreenShareEnabled ? (
                  <StopCircle className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className={CALL_CONTROL_TOOLTIP_CLASS}
                sideOffset={6}
                side="top"
              >
                {screenShareUnsupported
                  ? screenShareUnsupported
                  : someoneElseSharing
                    ? "Someone is already sharing their screen."
                    : isScreenShareEnabled
                      ? "Stop sharing"
                      : "Share screen"}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                {...leaveDomButtonProps}
                onClick={() => void handleLeave()}
                className="py-1.5 px-3 rounded-lg border border-red-300 bg-red-50 text-red-800 font-medium text-xs hover:bg-red-100 inline-flex items-center justify-center disabled:opacity-50"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className={CALL_CONTROL_TOOLTIP_CLASS}
                sideOffset={6}
                side="top"
              >
                Leave call
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
        {screenShareError ? (
          <p
            className="px-3 py-1 text-xs text-red-200 bg-red-900/80 rounded-b-lg"
            role="alert"
          >
            {screenShareError}
          </p>
        ) : null}
      </div>
    </Tooltip.Provider>
  );
}
