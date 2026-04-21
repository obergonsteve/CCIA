import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchGraphAccessToken,
  formatGraphDateTime,
  graphJson,
  readGraphEnv,
} from "./microsoftGraph";

describe("formatGraphDateTime", () => {
  it("formats epoch in Australia/Sydney as wall-clock without Z suffix", () => {
    const ms = Date.parse("2026-05-15T00:00:00.000Z");
    const s = formatGraphDateTime(ms, "Australia/Sydney");
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe("readGraphEnv", () => {
  const backup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "GRAPH_TENANT_ID",
      "GRAPH_CLIENT_ID",
      "GRAPH_CLIENT_SECRET",
      "GRAPH_ORGANIZER_USER_ID",
      "WORKSHOP_GRAPH_TIMEZONE",
    ]) {
      backup[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it("throws when required vars are missing", () => {
    process.env.GRAPH_TENANT_ID = "t";
    process.env.GRAPH_CLIENT_ID = "c";
    expect(() => readGraphEnv()).toThrow(/GRAPH_CLIENT_SECRET/);
  });

  it("returns all fields when set", () => {
    process.env.GRAPH_TENANT_ID = "tenant";
    process.env.GRAPH_CLIENT_ID = "client";
    process.env.GRAPH_CLIENT_SECRET = "secret";
    process.env.GRAPH_ORGANIZER_USER_ID = "org-user";
    process.env.WORKSHOP_GRAPH_TIMEZONE = "Pacific/Auckland";
    expect(readGraphEnv()).toEqual({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      organizerUserId: "org-user",
      defaultTimeZone: "Pacific/Auckland",
    });
  });

  it("defaults timezone when WORKSHOP_GRAPH_TIMEZONE unset", () => {
    process.env.GRAPH_TENANT_ID = "t";
    process.env.GRAPH_CLIENT_ID = "c";
    process.env.GRAPH_CLIENT_SECRET = "s";
    process.env.GRAPH_ORGANIZER_USER_ID = "o";
    expect(readGraphEnv().defaultTimeZone).toBe("Australia/Sydney");
  });
});

describe("fetchGraphAccessToken", () => {
  it("returns token on 200 JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "tok",
          expires_in: 3599,
        }),
      }),
    );
    const r = await fetchGraphAccessToken({
      tenantId: "tid",
      clientId: "cid",
      clientSecret: "sec",
    });
    expect(r.accessToken).toBe("tok");
    expect(r.expiresIn).toBe(3599);
    expect(fetch).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/tid/oauth2/v2.0/token",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("throws with AAD error body when token missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
        json: async () => ({
          error: "invalid_client",
          error_description: "bad secret",
        }),
      }),
    );
    await expect(
      fetchGraphAccessToken({
        tenantId: "t",
        clientId: "c",
        clientSecret: "x",
      }),
    ).rejects.toThrow(/bad secret/);
    vi.unstubAllGlobals();
  });
});

describe("graphJson", () => {
  it("parses JSON body on GET", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ value: [1] }),
      }),
    );
    const r = await graphJson<{ value: number[] }>("at", "GET", "https://graph.test/x");
    expect(r.ok).toBe(true);
    expect(r.data.value).toEqual([1]);
    vi.unstubAllGlobals();
  });

  it("sends JSON on PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "{}",
    });
    vi.stubGlobal("fetch", fetchMock);
    await graphJson("at", "PATCH", "https://graph.test/e/1", { foo: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.test/e/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ foo: 1 }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("on HTTP error with empty body, httpFailureText includes WWW-Authenticate and request-id", async () => {
    const headers = new Map([
      ["www-authenticate", 'Bearer authorization_uri="https://login.example"'],
      ["request-id", "abc-123"],
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: {
          get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
        text: async () => "  \n  ",
      }),
    );
    const r = await graphJson<unknown>("at", "POST", "https://graph.test/x", {});
    expect(r.ok).toBe(false);
    expect(r.httpFailureText).toContain("(empty response body)");
    expect(r.httpFailureText).toContain("WWW-Authenticate:");
    expect(r.httpFailureText).toContain("request-id=abc-123");
    vi.unstubAllGlobals();
  });
});
