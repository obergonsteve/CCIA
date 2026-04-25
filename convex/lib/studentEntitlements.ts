import type { Doc, Id } from "../_generated/dataModel";

/** Company-linked accounts are not restricted by student entitlements. */
export function isCompanyMember(user: Doc<"users">): boolean {
  return user.companyId != null;
}

/**
 * When `studentEntitledCertificationLevelIds` is set (including `[]`), non-company
 * learners may only *start* certifications in that list; they can still browse others.
 * When omitted, behaviour matches older data (any accessible public cert).
 */
export function studentEntitlementsActive(user: Doc<"users">): boolean {
  return user.studentEntitledCertificationLevelIds !== undefined;
}

export function canStudentStartCertification(
  user: Doc<"users">,
  levelId: Id<"certificationLevels">,
): boolean {
  if (isCompanyMember(user)) {
    return true;
  }
  if (user.role === "admin" || user.role === "content_creator") {
    return true;
  }
  const e = user.studentEntitledCertificationLevelIds;
  if (e === undefined) {
    return true;
  }
  return e.includes(levelId);
}
