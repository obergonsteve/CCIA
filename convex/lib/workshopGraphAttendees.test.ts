import { describe, expect, it } from "vitest";
import { normalizeAttendeesForPatch } from "./workshopGraphAttendees";

describe("normalizeAttendeesForPatch", () => {
  it("returns empty for non-array", () => {
    expect(normalizeAttendeesForPatch(null)).toEqual([]);
    expect(normalizeAttendeesForPatch(undefined)).toEqual([]);
    expect(normalizeAttendeesForPatch({})).toEqual([]);
  });

  it("dedupes by lowercased email and preserves first casing", () => {
    const raw = [
      {
        emailAddress: { address: "A@x.com", name: "A" },
        type: "required",
      },
      {
        emailAddress: { address: "a@x.com", name: "Dup" },
      },
    ];
    const out = normalizeAttendeesForPatch(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.emailAddress.address).toBe("A@x.com");
    expect(out[0]!.emailAddress.name).toBe("A");
    expect(out[0]!.type).toBe("required");
  });

  it("skips rows without address", () => {
    expect(
      normalizeAttendeesForPatch([
        { emailAddress: {} },
        { emailAddress: { address: "  " } },
        { emailAddress: { address: "ok@test.dev" } },
      ]),
    ).toEqual([
      {
        emailAddress: { address: "ok@test.dev" },
        type: "required",
      },
    ]);
  });

  it("merges new attendee with existing list shape", () => {
    const existing = normalizeAttendeesForPatch([
      { emailAddress: { address: "one@test.dev", name: "One" } },
    ]);
    const lower = "two@test.dev";
    if (!existing.some((a) => a.emailAddress.address.toLowerCase() === lower)) {
      existing.push({
        emailAddress: { address: "two@test.dev", name: "Two" },
        type: "required",
      });
    }
    expect(existing).toHaveLength(2);
  });
});
