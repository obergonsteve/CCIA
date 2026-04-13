"use client";

import { useTracks, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";

/** Shared screen tile with participant label — inside LiveKitRoom (from GritHub Brainstorm). */
export function BrainstormScreenShareBlock() {
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const first = screenShareTracks[0];
  if (!first || !("participant" in first)) return null;
  const participant = first.participant as { name?: string; identity?: string };
  const label = participant?.name?.trim() || participant?.identity || "Someone";
  return (
    <div className="lk-screen-share-block shrink-0 flex flex-col rounded-t-lg overflow-hidden border-b border-slate-600/80 bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800">
      <div className="px-2 py-1 text-xs font-medium text-slate-100 bg-slate-900/85">
        {label}&apos;s screen
      </div>
      <div className="relative w-full aspect-video bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 min-h-[120px] max-h-[40vh] flex items-center justify-center">
        <VideoTrack trackRef={first} className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
