import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "webinar reminder in-app post-its",
  { minutes: 2 },
  internal.webinarReminders.runDue,
  {},
);

export default crons;
