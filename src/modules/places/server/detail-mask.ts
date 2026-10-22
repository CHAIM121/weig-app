import "server-only";
import { DETAIL_FIELDS } from "./google";
import type { OwnPlace } from "./local";
export function detailMask(own: OwnPlace | null, reviews: boolean) {
  const omitted = new Set<string>();
  if (own?.name_he) omitted.add("displayName");
  if (own?.address_he) omitted.add("formattedAddress");
  if (own?.phone) omitted.add("internationalPhoneNumber");
  if (own?.website) omitted.add("websiteUri");
  if (own?.opening_hours) omitted.add("regularOpeningHours");
  if (own?.photos.length) omitted.add("photos");
  if (own?.own_lat != null && own.own_lng != null) omitted.add("location");
  return DETAIL_FIELDS.split(",").filter(field => !omitted.has(field)).concat(reviews ? ["reviews"] : []).join(",");
}
