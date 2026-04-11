/**
 * Convex cloud deployment hostnames use hyphens only (e.g. `handsome-lemur-918`).
 * A common misconfiguration is pasting with underscores (`handsome_lemur-918`),
 * which breaks the HTTP client with empty error messages.
 */
export function convexCloudUrlMisconfigurationMessage(
  raw: string | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  let host: string;
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return "NEXT_PUBLIC_CONVEX_URL is not a valid URL.";
  }

  if (!host.endsWith(".convex.cloud")) {
    return null;
  }

  if (host.includes("_")) {
    const suggested = host.replaceAll("_", "-");
    return (
      `Invalid Convex cloud hostname: "${host}". Deployment names use hyphens (-), not underscores (_). ` +
      `Did you mean https://${suggested}? Copy the deployment URL exactly from Convex Dashboard → Settings → URL & deploy key.`
    );
  }

  return null;
}
