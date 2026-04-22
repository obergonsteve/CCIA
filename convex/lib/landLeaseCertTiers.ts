import { LAND_LEASE_CURRICULUM } from "../curriculumSeedData";
import type { MutationCtx } from "../_generated/server";

/** The five global certification names from `LAND_LEASE_CURRICULUM` (same on every deployment). */
export const LAND_LEASE_GLOBAL_LEVEL_NAMES = new Set(
  LAND_LEASE_CURRICULUM.map((c) => c.name),
);

export function isGlobalLandLeaseSeedLevelName(name: string): boolean {
  return LAND_LEASE_GLOBAL_LEVEL_NAMES.has(name);
}

/**
 * Single source of truth: bronze / silver / gold for each seeded course name
 * (must match `runInsertLandLeaseCurriculum` and admin UX).
 */
export function certificationTierForLandLeaseCourseName(
  name: string,
): "bronze" | "silver" | "gold" {
  if (name === "Land Lease 101") {
    return "bronze";
  }
  if (name === "Commercials, Fees & Asset Care") {
    return "gold";
  }
  return "silver";
}

/**
 * Patches `certificationLevels` for global Land Lease rows so `certificationTier` matches
 * the seed curriculum. Safe to run after any deploy (dev, prod, preview); idempotent.
 */
export async function syncLandLeaseCertificationTiersFromCurriculum(
  ctx: MutationCtx,
): Promise<{ patched: number }> {
  let patched = 0;
  const levels = await ctx.db.query("certificationLevels").collect();
  for (const course of LAND_LEASE_CURRICULUM) {
    const want = certificationTierForLandLeaseCourseName(course.name);
    for (const row of levels) {
      if (row.deletedAt != null) {
        continue;
      }
      if (row.companyId != null) {
        continue;
      }
      if (row.name !== course.name) {
        continue;
      }
      if (row.certificationTier === want) {
        continue;
      }
      await ctx.db.patch(row._id, { certificationTier: want });
      patched += 1;
    }
  }
  return { patched };
}
