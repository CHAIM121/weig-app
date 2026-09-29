export type Coordinates = { latitude: number; longitude: number };
export type RouteSummary = { distanceKm: number; minutes: number };

export function straightLineKm(origin: Coordinates, destination: Coordinates) {
  const rad = Math.PI / 180;
  const latitude = (destination.latitude - origin.latitude) * rad;
  const longitude = (destination.longitude - origin.longitude) * rad;
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(origin.latitude * rad) * Math.cos(destination.latitude * rad)
    * Math.sin(longitude / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function travelLabel(origin: Coordinates | null, destination: Coordinates | undefined, route: RouteSummary | undefined, he: boolean) {
  if (!origin || !destination) return null;
  if (route) {
    const distance = route.distanceKm < 1 ? `${Math.round(route.distanceKm * 1000)} ${he ? "מ׳" : "m"}` : `${route.distanceKm.toLocaleString(he ? "he-IL" : "en-US", { maximumFractionDigits: 1 })} ${he ? "ק״מ" : "km"}`;
    const duration = route.minutes < 60 ? `${route.minutes} ${he ? "דק׳" : "min"}` : `${Math.floor(route.minutes / 60)} ${he ? "שע׳" : "h"} ${route.minutes % 60 ? `${route.minutes % 60} ${he ? "דק׳" : "min"}` : ""}`.trim();
    return `${distance} · ${duration} ${he ? "בנסיעה" : "drive"}`;
  }
  const km = straightLineKm(origin, destination);
  return `${km < 1 ? Math.round(km * 1000) + (he ? " מ׳" : " m") : km.toLocaleString(he ? "he-IL" : "en-US", { maximumFractionDigits: 1 }) + (he ? " ק״מ" : " km")} ${he ? "בקו אווירי" : "straight line"}`;
}
