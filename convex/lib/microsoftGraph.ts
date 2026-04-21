/** Microsoft Graph client-credentials + small helpers for workshop Teams sync. */

function trimEnv(v: string | undefined): string {
  return (v ?? "").trim();
}

export type GraphTokenResult = {
  accessToken: string;
  expiresIn: number;
};

export async function fetchGraphAccessToken(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<GraphTokenResult> {
  const { tenantId, clientId, clientSecret } = params;
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const msg =
      json.error_description ??
      json.error ??
      res.statusText ??
      "token_request_failed";
    throw new Error(`Graph token: ${msg}`);
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

/** Wall-clock `dateTime` string for Graph `start` / `end` in a given IANA time zone. */
export function formatGraphDateTime(ms: number, timeZone: string): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPart["type"]) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

export function readGraphEnv(): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  organizerUserId: string;
  defaultTimeZone: string;
} {
  const tenantId = trimEnv(process.env.GRAPH_TENANT_ID);
  const clientId = trimEnv(process.env.GRAPH_CLIENT_ID);
  const clientSecret = trimEnv(process.env.GRAPH_CLIENT_SECRET);
  const organizerUserId = trimEnv(process.env.GRAPH_ORGANIZER_USER_ID);
  const defaultTimeZone = trimEnv(process.env.WORKSHOP_GRAPH_TIMEZONE) || "Australia/Sydney";
  if (!tenantId || !clientId || !clientSecret || !organizerUserId) {
    throw new Error(
      "Missing Graph env: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_ORGANIZER_USER_ID",
    );
  }
  return { tenantId, clientId, clientSecret, organizerUserId, defaultTimeZone };
}

/** When Graph returns a non-2xx with an empty body, still surface useful headers. */
function graphHttpFailureDetail(res: Response, bodyText: string): string {
  const trimmed = bodyText.trim();
  if (trimmed) {
    return trimmed;
  }
  const bits: string[] = ["(empty response body)"];
  const www = res.headers.get("www-authenticate");
  if (www) {
    bits.push(`WWW-Authenticate: ${www}`);
  }
  for (const name of ["request-id", "client-request-id"] as const) {
    const v = res.headers.get(name);
    if (v) {
      bits.push(`${name}=${v}`);
    }
  }
  return bits.join(" ");
}

export async function graphJson<T>(
  accessToken: string,
  method: string,
  url: string,
  body?: unknown,
): Promise<{
  ok: boolean;
  status: number;
  data: T;
  text: string;
  /** Use this in thrown errors: JSON body, or headers when body is empty. */
  httpFailureText: string;
}> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: T = undefined as T;
  try {
    data = text ? (JSON.parse(text) as T) : (undefined as T);
  } catch {
    data = undefined as T;
  }
  const httpFailureText = res.ok ? "" : graphHttpFailureDetail(res, text);
  return { ok: res.ok, status: res.status, data, text, httpFailureText };
}
