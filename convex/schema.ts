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
    /** Learner dashboard: certification levels pinned from the roadmap (order preserved). */
    plannedCertificationLevelIds: v.optional(
      v.array(v.id("certificationLevels")),
    ),
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
    /**
     * Bronze = mandatory baseline; Silver/Gold = optional tracks (WORKSHOPS.md).
     * Undefined on legacy rows — treat as bronze in app code until backfilled.
     */
    certificationTier: v.optional(
      v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
      ),
    ),
    /** Set when “deleted” — row retained, hidden from UI. */
    deletedAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_certification_category", ["certificationCategoryId"])
    .index("by_code", ["code"])
    .index("by_certification_tier", ["certificationTier"]),

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
    /** `live_workshop` = unit is scheduled as live sessions; default/omit = self-paced. */
    deliveryMode: v.optional(
      v.union(v.literal("self_paced"), v.literal("live_workshop")),
    ),
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
      /** Step that completes when the user registers for the linked live session. */
      v.literal("workshop_session"),
    ),
    title: v.string(),
    /** Optional; first line shown under the title in the admin content library list. */
    shortDescription: v.optional(v.string()),
    contentCategoryId: v.optional(v.id("contentCategories")),
    /** Pre–FK era; strip via `migrateLegacyCategories.adminMigrateLegacyCategoryStrings`. */
    contentCategory: v.optional(v.string()),
    contentCategoryShortDescription: v.optional(v.string()),
    /** Media URL or empty for test/assignment / workshop_session items. */
    url: v.string(),
    /** Set when `type` is `workshop_session`. */
    workshopSessionId: v.optional(v.id("workshopSessions")),
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
    .index("by_code", ["code"])
    .index("by_workshop_session", ["workshopSessionId"]),

  /** Scheduled occurrence of a `live_workshop` unit. */
  workshopSessions: defineTable({
    workshopUnitId: v.id("units"),
    startsAt: v.number(),
    endsAt: v.number(),
    titleOverride: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.union(v.literal("scheduled"), v.literal("cancelled")),
    /**
     * `livekit` (default when unset) = embedded LiveKit room in the PWA.
     * `microsoft_teams` = Graph-backed Teams meeting; join link in `externalJoinUrl`.
     */
    conferenceProvider: v.optional(
      v.union(v.literal("livekit"), v.literal("microsoft_teams")),
    ),
    /** IANA zone used when building Graph `start`/`end` (e.g. Australia/Sydney). */
    timeZone: v.optional(v.string()),
    /** Until LiveKit: optional link opened in a new tab. */
    externalJoinUrl: v.optional(v.string()),
    /** Microsoft Graph calendar event id (organizer mailbox). */
    teamsGraphEventId: v.optional(v.string()),
    /** Graph online meeting id when returned separately from the event. */
    teamsOnlineMeetingId: v.optional(v.string()),
    /** Graph user id used as `/users/{id}/events` organizer for this session. */
    teamsOrganizerId: v.optional(v.string()),
    teamsLastSyncAt: v.optional(v.number()),
    teamsLastError: v.optional(v.string()),
    /** Set when an admin/content host opens the live room; learners need this before LiveKit. */
    liveRoomOpenedAt: v.optional(v.number()),
    /** Host toggles Convex whiteboard panel visibility for this session. */
    whiteboardVisible: v.optional(v.boolean()),
  })
    .index("by_workshop_unit", ["workshopUnitId"])
    .index("by_starts_at", ["startsAt"]),

  workshopRegistrations: defineTable({
    userId: v.id("users"),
    sessionId: v.id("workshopSessions"),
    registeredAt: v.number(),
    /** Teams path: first time user opened join from the PWA (best-effort). */
    teamsFirstJoinedAt: v.optional(v.number()),
    /** Teams path: last “leave” signal from the PWA. */
    teamsLastLeftAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_session_and_user", ["sessionId", "userId"]),

  /**
   * Debug trace for Microsoft Graph / Resend workshop sync (admin + registered learners).
   */
  workshopSessionSyncLogs: defineTable({
    sessionId: v.id("workshopSessions"),
    at: v.number(),
    source: v.union(
      v.literal("graph"),
      v.literal("resend"),
      v.literal("system"),
    ),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
  }).index("by_session", ["sessionId"]),

  /** Text chat during an embedded LiveKit workshop (registered learners only). */
  workshopSessionChatMessages: defineTable({
    workshopSessionId: v.id("workshopSessions"),
    userId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_workshop_session", ["workshopSessionId"]),

  /**
   * Whiteboard primitives for embedded workshop (same persistence idea as GritHub
   * brainstorm strokes — Convex, not LiveKit data).
   */
  workshopSessionWhiteboardStrokes: defineTable({
    workshopSessionId: v.id("workshopSessions"),
    userId: v.id("users"),
    strokeData: v.any(),
    createdAt: v.number(),
  }).index("by_workshop_session", ["workshopSessionId"]),

  /**
   * User × certification placement × scheduled session: who must / did attend
   * a live workshop for a specific unit within a certification track.
   * (`workshopRegistrations` remains the capacity/session join record; this ties
   * that attendance to the `certificationUnits` path context.)
   */
  certificationWorkshopAttendees: defineTable({
    userId: v.id("users"),
    certificationUnitId: v.id("certificationUnits"),
    workshopSessionId: v.id("workshopSessions"),
    enrolledAt: v.number(),
    status: v.union(
      v.literal("enrolled"),
      v.literal("attended"),
      v.literal("no_show"),
      v.literal("withdrawn"),
    ),
    attendedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_workshop_session", ["workshopSessionId"])
    .index("by_certification_unit", ["certificationUnitId"])
    .index("by_user_and_certification_unit", ["userId", "certificationUnitId"]),

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
  })
    .index("by_user_unit", ["userId", "unitId"])
    .index("by_unit", ["unitId"]),

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
    .index("by_user_unit_content", ["userId", "unitId", "contentId"])
    .index("by_unit", ["unitId"])
    .index("by_content", ["contentId"]),

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
  })
    .index("by_user_unit", ["userId", "unitId"])
    .index("by_unit", ["unitId"])
    .index("by_content", ["contentId"]),

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

  /**
   * In-app notifications (not toasts): reminders, nudges, new content, etc.
   * `dedupeKey` is stable per logical item (e.g. `webinar:sessionId`) so crons/events
   * can upsert without spamming; dismissed rows are not re-inserted.
   */
  userNotifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("webinar_reminder"),
      v.literal("unit_progress_nudge"),
      v.literal("content_update"),
      v.literal("new_unit"),
      v.literal("new_webinar"),
      v.literal("general"),
    ),
    title: v.string(),
    body: v.optional(v.string()),
    /** In-app link (e.g. `/workshops`, `/units/{id}`). */
    linkHref: v.optional(v.string()),
    /**
     * One row per (user, dedupeKey). Used by internal creators to avoid duplicates
     * and to remember dismissals.
     */
    dedupeKey: v.string(),
    createdAt: v.number(),
    dismissed: v.boolean(),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_dismissed", ["userId", "dismissed"])
    .index("by_user_dedupe", ["userId", "dedupeKey"]),
});
