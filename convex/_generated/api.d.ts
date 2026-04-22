/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminDeleted from "../adminDeleted.js";
import type * as adminStats from "../adminStats.js";
import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as authMutations from "../authMutations.js";
import type * as certificationCategories from "../certificationCategories.js";
import type * as certifications from "../certifications.js";
import type * as companies from "../companies.js";
import type * as content from "../content.js";
import type * as contentCategories from "../contentCategories.js";
import type * as contentProgress from "../contentProgress.js";
import type * as curriculumSeedData from "../curriculumSeedData.js";
import type * as entityCodesAdmin from "../entityCodesAdmin.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_certTier from "../lib/certTier.js";
import type * as lib_entityCodes from "../lib/entityCodes.js";
import type * as lib_httpCookies from "../lib/httpCookies.js";
import type * as lib_landLeaseCertTiers from "../lib/landLeaseCertTiers.js";
import type * as lib_liveKitSanitize from "../lib/liveKitSanitize.js";
import type * as lib_microsoftGraph from "../lib/microsoftGraph.js";
import type * as lib_prerequisites from "../lib/prerequisites.js";
import type * as lib_softDelete from "../lib/softDelete.js";
import type * as lib_webinarDisplayText from "../lib/webinarDisplayText.js";
import type * as lib_workshopGraphAttendees from "../lib/workshopGraphAttendees.js";
import type * as lib_workshopGraphKillSwitch from "../lib/workshopGraphKillSwitch.js";
import type * as lib_workshopSyncLog from "../lib/workshopSyncLog.js";
import type * as lib_workshopTeamsSimulation from "../lib/workshopTeamsSimulation.js";
import type * as lib_workshopUnitLevels from "../lib/workshopUnitLevels.js";
import type * as migrateLegacyCategories from "../migrateLegacyCategories.js";
import type * as prerequisites from "../prerequisites.js";
import type * as progress from "../progress.js";
import type * as seed from "../seed.js";
import type * as seedAnalytics from "../seedAnalytics.js";
import type * as seedAnalyticsDiag from "../seedAnalyticsDiag.js";
import type * as unitCategories from "../unitCategories.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as workshopLiveKit from "../workshopLiveKit.js";
import type * as workshopLiveKitAction from "../workshopLiveKitAction.js";
import type * as workshopMicrosoftTeams from "../workshopMicrosoftTeams.js";
import type * as workshopSessionChat from "../workshopSessionChat.js";
import type * as workshopWhiteboard from "../workshopWhiteboard.js";
import type * as workshops from "../workshops.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminDeleted: typeof adminDeleted;
  adminStats: typeof adminStats;
  assignments: typeof assignments;
  auth: typeof auth;
  authMutations: typeof authMutations;
  certificationCategories: typeof certificationCategories;
  certifications: typeof certifications;
  companies: typeof companies;
  content: typeof content;
  contentCategories: typeof contentCategories;
  contentProgress: typeof contentProgress;
  curriculumSeedData: typeof curriculumSeedData;
  entityCodesAdmin: typeof entityCodesAdmin;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/certTier": typeof lib_certTier;
  "lib/entityCodes": typeof lib_entityCodes;
  "lib/httpCookies": typeof lib_httpCookies;
  "lib/landLeaseCertTiers": typeof lib_landLeaseCertTiers;
  "lib/liveKitSanitize": typeof lib_liveKitSanitize;
  "lib/microsoftGraph": typeof lib_microsoftGraph;
  "lib/prerequisites": typeof lib_prerequisites;
  "lib/softDelete": typeof lib_softDelete;
  "lib/webinarDisplayText": typeof lib_webinarDisplayText;
  "lib/workshopGraphAttendees": typeof lib_workshopGraphAttendees;
  "lib/workshopGraphKillSwitch": typeof lib_workshopGraphKillSwitch;
  "lib/workshopSyncLog": typeof lib_workshopSyncLog;
  "lib/workshopTeamsSimulation": typeof lib_workshopTeamsSimulation;
  "lib/workshopUnitLevels": typeof lib_workshopUnitLevels;
  migrateLegacyCategories: typeof migrateLegacyCategories;
  prerequisites: typeof prerequisites;
  progress: typeof progress;
  seed: typeof seed;
  seedAnalytics: typeof seedAnalytics;
  seedAnalyticsDiag: typeof seedAnalyticsDiag;
  unitCategories: typeof unitCategories;
  units: typeof units;
  users: typeof users;
  workshopLiveKit: typeof workshopLiveKit;
  workshopLiveKitAction: typeof workshopLiveKitAction;
  workshopMicrosoftTeams: typeof workshopMicrosoftTeams;
  workshopSessionChat: typeof workshopSessionChat;
  workshopWhiteboard: typeof workshopWhiteboard;
  workshops: typeof workshops;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
