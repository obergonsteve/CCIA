import { ConvexError } from "convex/values";

const REMEDIATION = [
  "Typical fixes (production):",
  "• URL must match the dashboard exactly: deployment slugs use hyphens (handsome-lemur-918), never underscores (handsome_lemur-918).",
  "• Vercel → Environment Variables: set NEXT_PUBLIC_CONVEX_URL to your Convex **production** URL (https://<deployment>.convex.cloud).",
  "• Redeploy the site after adding or changing NEXT_PUBLIC_* (Next.js inlines them at build time).",
  "• From the app repo: `npx convex deploy -y` so this deployment has the latest functions (including auth:login).",
  "• Seed admins on prod if needed: `npx convex run seed:seedCommunityOperatorsAndAdmins --prod`",
  "• Convex Dashboard → this deployment → Logs / Errors for the real stack trace when the message below is generic.",
].join("\n");

/**
 * Multi-line text for API JSON `error` (shown in the sign-in problem dialog).
 */
export function formatConvexHttpFailure(
  thrown: unknown,
  ctx: { operation: string; convexUrl: string },
): string {
  const lines: string[] = [
    `Convex call failed: ${ctx.operation}`,
    `NEXT_PUBLIC_CONVEX_URL: ${ctx.convexUrl || "(unset)"}`,
    "",
  ];

  if (thrown instanceof ConvexError) {
    lines.push(`ConvexError: ${thrown.message}`);
    try {
      lines.push(
        "data:",
        JSON.stringify(thrown.data, null, 2),
      );
    } catch {
      lines.push("data: (not serializable)");
    }
    if (thrown.stack) {
      lines.push("", thrown.stack);
    }
  } else if (thrown instanceof Error) {
    lines.push(`${thrown.name}: ${thrown.message}`);
    if (thrown.message === "Server Error") {
      lines.push(
        "",
        "(Convex often surfaces failures as the generic \"Server Error\" in the HTTP client. The deployment logs usually contain the underlying exception.)",
      );
    }
    if (thrown.stack) {
      lines.push("", thrown.stack);
    }
  } else {
    lines.push(String(thrown));
  }

  lines.push("", "—", "", REMEDIATION);
  return lines.join("\n");
}
