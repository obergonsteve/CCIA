/**
 * Demo / QA: fake a Teams workshop end-to-end (join URL + DB fields) without Microsoft Graph.
 *
 * Convex env:
 * - `WORKSHOP_TEAMS_SIMULATION=1` — enable
 * - `WORKSHOP_SIMULATION_PUBLIC_ORIGIN` — site root the learner’s browser can open, e.g. `https://localhost:3000` or production URL (no trailing slash)
 */
export function isWorkshopTeamsSimulationEnabled(): boolean {
  const raw = (process.env.WORKSHOP_TEAMS_SIMULATION ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function workshopSimulationPublicOrigin(): string {
  return (process.env.WORKSHOP_SIMULATION_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");
}

export function isSimulatedTeamsGraphEventId(id: string | undefined): boolean {
  return Boolean(id?.startsWith("sim:"));
}
