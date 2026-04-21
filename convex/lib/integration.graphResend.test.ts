/**
 * Live calls to Microsoft Graph and (optionally) Resend.
 *
 * **Not run in CI by default.** Requires real credentials in the environment:
 *
 * ```bash
 * export RUN_GRAPH_RESEND_INTEGRATION=1
 * export GRAPH_TENANT_ID=...
 * export GRAPH_CLIENT_ID=...
 * export GRAPH_CLIENT_SECRET=...
 * export GRAPH_ORGANIZER_USER_ID=...   # object id
 * # optional override:
 * # export WORKSHOP_GRAPH_TIMEZONE=Australia/Sydney
 *
 * # Optional Resend (sends one real test email):
 * # export RESEND_API_KEY=re_...
 * # export RESEND_WORKSHOP_FROM="Workshops <onboarding@resend.dev>"
 * # export INTEGRATION_RESEND_TO=you@verified-domain.com
 *
 * npx vitest run convex/lib/integration.graphResend.test.ts
 * ```
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  fetchGraphAccessToken,
  formatGraphDateTime,
  graphJson,
  readGraphEnv,
} from "./microsoftGraph";

const integrationEnabled =
  process.env.RUN_GRAPH_RESEND_INTEGRATION === "1" &&
  Boolean(process.env.GRAPH_TENANT_ID?.trim()) &&
  Boolean(process.env.GRAPH_CLIENT_ID?.trim()) &&
  Boolean(process.env.GRAPH_CLIENT_SECRET?.trim()) &&
  Boolean(process.env.GRAPH_ORGANIZER_USER_ID?.trim());

describe.skipIf(!integrationEnabled)(
  "integration: Microsoft Graph (live) + optional Resend",
  () => {
    let createdEventId: string | null = null;

    afterAll(async () => {
      if (!createdEventId || !integrationEnabled) {
        return;
      }
      const env = readGraphEnv();
      const { accessToken } = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      const delUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.organizerUserId)}/events/${encodeURIComponent(createdEventId)}`;
      const del = await graphJson<unknown>(accessToken, "DELETE", delUrl);
      expect(del.ok).toBe(true);
    });

    it("obtains an application access token", async () => {
      const env = readGraphEnv();
      const t = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      expect(t.accessToken.length).toBeGreaterThan(20);
    });

    it("creates and reads a short Teams online meeting, then marks id for cleanup", async () => {
      const env = readGraphEnv();
      const { accessToken } = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      const tz = env.defaultTimeZone;
      const startMs = Date.now() + 60 * 60 * 1000;
      const endMs = startMs + 30 * 60 * 1000;
      const subject = `[integration test] ccia-landlease ${new Date().toISOString()}`;
      const postUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.organizerUserId)}/events`;
      const body = {
        subject,
        body: {
          contentType: "HTML",
          content: "<p>Safe to delete — created by vitest integration.</p>",
        },
        start: { dateTime: formatGraphDateTime(startMs, tz), timeZone: tz },
        end: { dateTime: formatGraphDateTime(endMs, tz), timeZone: tz },
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      };
      const created = await graphJson<{ id?: string; onlineMeeting?: { joinUrl?: string } }>(
        accessToken,
        "POST",
        postUrl,
        body,
      );
      expect(created.ok).toBe(true);
      const id = String(created.data.id ?? "");
      expect(id.length).toBeGreaterThan(0);
      const join = String(
        created.data.onlineMeeting?.joinUrl ?? "",
      );
      expect(join).toMatch(/^https:\/\//);
      createdEventId = id;
    });

    it("optionally sends one Resend test email", async () => {
      const key = process.env.RESEND_API_KEY?.trim();
      const from = process.env.RESEND_WORKSHOP_FROM?.trim();
      const to = process.env.INTEGRATION_RESEND_TO?.trim();
      if (!key || !from || !to) {
        console.info(
          "[integration] Skipping Resend: set RESEND_API_KEY, RESEND_WORKSHOP_FROM, INTEGRATION_RESEND_TO to send a real message.",
        );
        return;
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "[integration] ccia-landlease Resend ping",
          html: "<p>Integration test email.</p>",
        }),
      });
      const text = await res.text();
      expect(res.ok, text).toBe(true);
    });
  },
);
