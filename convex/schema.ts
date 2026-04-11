import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    /** Mailing / street block — admin-editable */
    address: v.optional(v.string()),
    /** Primary company contact email (not a user login) */
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("pending"),
      ),
    ),
    /** Agreement / onboarding date (ms since epoch) */
    joinedAt: v.optional(v.union(v.number(), v.null())),
  }).index("by_name", ["name"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    companyId: v.id("companies"),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
    avatarUrl: v.optional(v.string()),
    lastLogin: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_company", ["companyId"]),

  /** Admin-defined categories for certifications (short code + long description). */
  certificationCategories: defineTable({
    shortCode: v.string(),
    longDescription: v.string(),
    sortOrder: v.number(),
  })
    .index("by_sort", ["sortOrder"])
    .index("by_short_code", ["shortCode"]),

  /** Admin-defined categories for units. */
  unitCategories: defineTable({
    shortCode: v.string(),
    longDescription: v.string(),
    sortOrder: v.number(),
  })
    .index("by_sort", ["sortOrder"])
    .index("by_short_code", ["shortCode"]),

  /** Admin-defined categories for library content. */
  contentCategories: defineTable({
    shortCode: v.string(),
    longDescription: v.string(),
    sortOrder: v.number(),
  })
    .index("by_sort", ["sortOrder"])
    .index("by_short_code", ["shortCode"]),

  certificationLevels: defineTable({
    /** Unique short identifier (normalized uppercase: letters, digits, `.`, `_`, `-`). */
    code: v.optional(v.string()),
    name: v.string(),
    certificationCategoryId: v.optional(v.id("certificationCategories")),
    /**
     * Pre–FK era: free-form chip label. Strip via `migrateLegacyCategories.adminMigrateLegacyCategoryStrings`.
     */
    certificationCategory: v.optional(v.string()),
    certificationCategoryShortDescription: v.optional(v.string()),
    /** Short summary for lists, admin rows, and card previews */
    summary: v.optional(v.string()),
    /** Long-form detail (level page, full catalog context) */
    description: v.string(),
    /** Optional marketing line under the title on hero/catalog imagery */
    tagline: v.optional(v.string()),
    /** Hero / card image (HTTPS URL) */
    thumbnailUrl: v.optional(v.string()),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    /** Set when “deleted” — row retained, hidden from UI. */
    deletedAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_certification_category", ["certificationCategoryId"])
    .index("by_code", ["code"]),

  units: defineTable({
    /** Unique short identifier (same rules as certification `code`). */
    code: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    unitCategoryId: v.optional(v.id("unitCategories")),
    /** Pre–FK era; strip via `migrateLegacyCategories.adminMigrateLegacyCategoryStrings`. */
    unitCategory: v.optional(v.string()),
    unitCategoryShortDescription: v.optional(v.string()),
    /** Legacy (pre–junction table). Remove after migrating or clearing training data. */
    levelId: v.optional(v.id("certificationLevels")),
    order: v.optional(v.number()),
    /** Set when “deleted” — row retained, hidden from UI. */
    deletedAt: v.optional(v.number()),
  })
    .index("by_unit_category", ["unitCategoryId"])
    .index("by_code", ["code"]),

  /**
   * Associates a reusable unit with a certification track. `order` is scoped to that certification.
   * A unit may appear in multiple certifications via separate rows.
   */
  certificationUnits: defineTable({
    levelId: v.id("certificationLevels"),
    unitId: v.id("units"),
    order: v.number(),
  })
    .index("by_level", ["levelId"])
    .index("by_unit", ["unitId"])
    .index("by_level_and_unit", ["levelId", "unitId"]),

  /** `unitId` requires `prerequisiteUnitId` to be completed first (may be in another certification). */
  unitPrerequisites: defineTable({
    unitId: v.id("units"),
    prerequisiteUnitId: v.id("units"),
  })
    .index("by_unit", ["unitId"])
    .index("by_prerequisite_unit", ["prerequisiteUnitId"]),

  /** Reusable lesson / reference / assessment (attached to units via `unitContents`). */
  contentItems: defineTable({
    /** Unique short identifier (same rules as certification `code`). */
    code: v.optional(v.string()),
    type: v.union(
      v.literal("video"),
      v.literal("slideshow"),
      v.literal("link"),
      v.literal("pdf"),
      v.literal("test"),
      v.literal("assignment"),
    ),
    title: v.string(),
    contentCategoryId: v.optional(v.id("contentCategories")),
    /** Pre–FK era; strip via `migrateLegacyCategories.adminMigrateLegacyCategoryStrings`. */
    contentCategory: v.optional(v.string()),
    contentCategoryShortDescription: v.optional(v.string()),
    /** Media URL or empty for test/assignment items. */
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    /** Quiz payload when `type` is test or assignment. */
    assessment: v.optional(
      v.object({
        description: v.string(),
        questions: v.array(
          v.object({
            id: v.string(),
            question: v.string(),
            type: v.union(v.literal("multiple_choice"), v.literal("text")),
            options: v.optional(v.array(v.string())),
            correctAnswer: v.optional(v.string()),
          }),
        ),
        passingScore: v.number(),
      }),
    ),
    /** Legacy (pre–junction table). Remove after migrating or clearing training data. */
    unitId: v.optional(v.id("units")),
    order: v.optional(v.number()),
    /** Set when “deleted” — row retained, hidden from UI. */
    deletedAt: v.optional(v.number()),
  })
    .index("by_content_category", ["contentCategoryId"])
    .index("by_code", ["code"]),

  /** Content order within a specific unit (many-to-many link). */
  unitContents: defineTable({
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
    order: v.number(),
  })
    .index("by_unit", ["unitId"])
    .index("by_content", ["contentId"])
    .index("by_unit_and_content", ["unitId", "contentId"]),

  assignments: defineTable({
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        type: v.union(v.literal("multiple_choice"), v.literal("text")),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
      }),
    ),
    passingScore: v.number(),
  }),

  userProgress: defineTable({
    userId: v.id("users"),
    unitId: v.id("units"),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    lastAccessed: v.number(),
  }).index("by_user_unit", ["userId", "unitId"]),

  testResults: defineTable({
    userId: v.id("users"),
    /** Legacy rows only (pre–content assessments). */
    assignmentId: v.optional(v.id("assignments")),
    /** Content item of type test or assignment. */
    assessmentContentId: v.optional(v.id("contentItems")),
    score: v.number(),
    answers: v.array(v.any()),
    passed: v.boolean(),
    completedAt: v.number(),
  })
    .index("by_user_assignment", ["userId", "assignmentId"])
    .index("by_user_assessment_content", ["userId", "assessmentContentId"])
    .index("by_assessment_content", ["assessmentContentId"]),

  /**
   * Latest state per user × unit × content step (sequential training).
   * Assessments stay "incomplete" until a passing attempt (retries allowed).
   */
  userContentProgress: defineTable({
    userId: v.id("users"),
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    /** Wall-clock ms for the last completed session (or successful attempt). */
    durationMs: v.optional(v.number()),
    outcome: v.optional(
      v.union(
        v.literal("completed"),
        v.literal("passed"),
        v.literal("failed"),
      ),
    ),
    score: v.optional(v.number()),
  })
    .index("by_user_unit", ["userId", "unitId"])
    .index("by_user_unit_content", ["userId", "unitId", "contentId"]),

  /** Append-only audit trail for starts, completions, and assessment attempts. */
  contentProgressEvents: defineTable({
    userId: v.id("users"),
    unitId: v.id("units"),
    contentId: v.optional(v.id("contentItems")),
    assignmentId: v.optional(v.id("assignments")),
    kind: v.union(
      v.literal("start"),
      v.literal("complete"),
      v.literal("assessment_attempt"),
      v.literal("reopen"),
    ),
    at: v.number(),
    durationMs: v.optional(v.number()),
    score: v.optional(v.number()),
    passed: v.optional(v.boolean()),
  }).index("by_user_unit", ["userId", "unitId"]),

  /** Legacy tab assessment: one row per user × assignment when used as a sequential step. */
  userAssignmentProgress: defineTable({
    userId: v.id("users"),
    unitId: v.id("units"),
    assignmentId: v.id("assignments"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    outcome: v.optional(
      v.union(v.literal("passed"), v.literal("failed")),
    ),
    score: v.optional(v.number()),
  })
    .index("by_user_unit_assignment", ["userId", "unitId", "assignmentId"]),
});
