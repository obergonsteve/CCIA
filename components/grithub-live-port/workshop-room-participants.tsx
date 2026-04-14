"use client";

import {
  isTrackReference,
  ParticipantContextIfNeeded,
  ParticipantName,
  ParticipantPlaceholder,
  TrackLoop,
  VideoTrack,
  useTrackRefContext,
  useTracks,
} from "@livekit/components-react";
import { Users } from "lucide-react";
import { Track } from "livekit-client";

/** Single camera thumbnail; must be the only direct child of `TrackLoop`. */
function WorkshopParticipantThumbnail() {
  const trackRef = useTrackRefContext();
  return (
    <ParticipantContextIfNeeded participant={trackRef.participant}>
      <div className="flex w-[5.25rem] shrink-0 flex-col items-stretch gap-1">
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-slate-950 ring-1 ring-white/20">
          {isTrackReference(trackRef) ? (
            <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-900/90 p-1">
              <ParticipantPlaceholder className="h-8 w-8 text-slate-600" />
            </div>
          )}
        </div>
        <div className="flex justify-center px-px">
          <div className="-mb-1 max-w-full origin-top scale-[0.88]">
            <ParticipantName className="block max-w-full truncate text-center text-[10px] font-medium leading-tight text-slate-100">
              {trackRef.participant.isLocal ? (
                <span className="text-slate-400"> · you</span>
              ) : null}
            </ParticipantName>
          </div>
        </div>
      </div>
    </ParticipantContextIfNeeded>
  );
}

/**
 * Camera thumbnails for everyone in the LiveKit room (must render inside
 * `LiveKitRoom`).
 */
export function WorkshopRoomParticipants() {
  const cameraTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  return (
    <div
      className="shrink-0 border-b border-slate-500/40 bg-slate-800/50 px-2 py-2 dark:bg-slate-950/55"
      aria-label="Participants in this call"
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200/90">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        In the room
        <span className="font-mono font-normal normal-case text-slate-300/80">
          ({cameraTracks.length})
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5">
        <TrackLoop tracks={cameraTracks}>
          <WorkshopParticipantThumbnail />
        </TrackLoop>
      </div>
    </div>
  );
}
