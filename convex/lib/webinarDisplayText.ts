/**
 * Rewrites legacy “workshop” product wording in stored titles/descriptions for
 * `live_workshop` units. Does not persist; use on learner-facing API responses.
 */
export function webinarizeForLiveWorkshopUnit(
  text: string | undefined,
  deliveryMode: "self_paced" | "live_workshop" | undefined | null,
): string {
  if (text == null || text === "") {
    return text ?? "";
  }
  if (deliveryMode !== "live_workshop") {
    return text;
  }
  return text
    .replace(/\(live workshop\)/gi, "(live webinar)")
    .replace(/\(workshop\)/gi, "(webinar)")
    .replace(/\blive workshops\b/gi, "live webinars")
    .replace(/\blive workshop\b/gi, "live webinar")
    .replace(/\bworkshop sessions\b/gi, "webinar sessions")
    .replace(/\bworkshop session\b/gi, "webinar session")
    .replace(/\bWorkshops\b/g, "Webinars")
    .replace(/\bworkshops\b/g, "webinars")
    .replace(/\bWorkshop\b/g, "Webinar")
    .replace(/\bworkshop\b/g, "webinar");
}
