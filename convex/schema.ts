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

  certificationLevels: defineTable({
    name: v.string(),
    description: v.string(),
    /** Short line under the title on catalog cards */
    tagline: v.optional(v.string()),
    /** Hero / card image (HTTPS URL) */
    thumbnailUrl: v.optional(v.string()),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
  }).index("by_company", ["companyId"]),

  units: defineTable({
    levelId: v.id("certificationLevels"),
    title: v.string(),
    description: v.string(),
    order: v.number(),
  }),

  /** `unitId` requires `prerequisiteUnitId` to be completed first (may be in another certification). */
  unitPrerequisites: defineTable({
    unitId: v.id("units"),
    prerequisiteUnitId: v.id("units"),
  })
    .index("by_unit", ["unitId"])
    .index("by_prerequisite_unit", ["prerequisiteUnitId"]),

  contentItems: defineTable({
    unitId: v.id("units"),
    type: v.union(
      v.literal("video"),
      v.literal("slideshow"),
      v.literal("link"),
      v.literal("pdf"),
    ),
    title: v.string(),
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    order: v.number(),
  }),

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
    assignmentId: v.id("assignments"),
    score: v.number(),
    answers: v.array(v.any()),
    passed: v.boolean(),
    completedAt: v.number(),
  }).index("by_user_assignment", ["userId", "assignmentId"]),
});
