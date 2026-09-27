export const placeGroups = [
  { id: "food", he: "אוכל וקניות", en: "Food & shopping" },
  { id: "jewish", he: "יהדות", en: "Jewish life" },
  { id: "explore", he: "טיולים", en: "Explore" },
  { id: "practical", he: "לינה ודרך", en: "Stay & travel" },
] as const;

export const placeCategories = [
  { id: "restaurants", group: "food", he: "מסעדות כשרות", en: "Kosher restaurants", searchHe: "מסעדות כשרות", searchEn: "kosher restaurants", icon: "utensils" },
  { id: "bakeries", group: "food", he: "בתי קפה ומאפיות", en: "Cafés & bakeries", searchHe: "בתי קפה ומאפיות", searchEn: "cafes and bakeries", icon: "coffee" },
  { id: "groceries", group: "food", he: "סופרים ואוכל מוכן", en: "Groceries & takeout", searchHe: "סופרמרקטים ואוכל מוכן", searchEn: "grocery stores and prepared food", icon: "shopping" },
  { id: "synagogues", group: "jewish", he: "בתי כנסת", en: "Synagogues", searchHe: "בתי כנסת", searchEn: "synagogues", icon: "building" },
  { id: "tombs", group: "jewish", he: "קברי צדיקים", en: "Sages' graves", searchHe: "קברי צדיקים", searchEn: "Jewish sages graves", icon: "landmark" },
  { id: "mikvaot", group: "jewish", he: "מקוואות", en: "Mikvaot", searchHe: "מקוואות", searchEn: "mikvah", icon: "water" },
  { id: "chabad", group: "jewish", he: "בתי חב״ד", en: "Chabad centers", searchHe: "בית חב״ד", searchEn: "Chabad house", icon: "users" },
  { id: "nature", group: "explore", he: "מסלולי טבע", en: "Nature trails", searchHe: "מסלולי טיול וטבע", searchEn: "nature trails", icon: "trees" },
  { id: "family", group: "explore", he: "אטרקציות למשפחות", en: "Family attractions", searchHe: "אטרקציות לילדים ומשפחות", searchEn: "family attractions", icon: "sparkles" },
  { id: "parks", group: "explore", he: "פארקים ותצפיות", en: "Parks & viewpoints", searchHe: "פארקים ותצפיות", searchEn: "parks and viewpoints", icon: "mountain" },
  { id: "beaches", group: "explore", he: "חופים ומעיינות", en: "Beaches & springs", searchHe: "חופים ומעיינות", searchEn: "beaches and springs", icon: "waves" },
  { id: "stays", group: "practical", he: "מלונות וצימרים", en: "Hotels & stays", searchHe: "מלונות וצימרים", searchEn: "hotels and guesthouses", icon: "bed" },
  { id: "transport", group: "practical", he: "תחבורה וחניה", en: "Transport & parking", searchHe: "תחבורה ציבורית וחניונים", searchEn: "public transport and parking", icon: "car" },
  { id: "essentials", group: "practical", he: "שירותים שימושיים", en: "Everyday essentials", searchHe: "בתי מרקחת כספומטים ותחנות דלק", searchEn: "pharmacies ATMs and gas stations", icon: "briefcase" },
] as const;

export type CategoryId = (typeof placeCategories)[number]["id"];
export function findCategory(id: string) { return placeCategories.find(category => category.id === id); }
