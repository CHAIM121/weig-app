export type PhoneContact = { id: string; name: string; number: string; favorite: boolean };
export const CONTACTS_KEY = 'weig-phone-contacts-v1';
export const countries = [
  { code: '972', he: 'ישראל', en: 'Israel', flag: '🇮🇱' },
  { code: '1', he: 'ארה״ב וקנדה', en: 'US & Canada', flag: '🇺🇸' },
  { code: '44', he: 'בריטניה', en: 'United Kingdom', flag: '🇬🇧' },
  { code: '33', he: 'צרפת', en: 'France', flag: '🇫🇷' },
  { code: '36', he: 'הונגריה', en: 'Hungary', flag: '🇭🇺' },
  { code: '380', he: 'אוקראינה', en: 'Ukraine', flag: '🇺🇦' },
  { code: '48', he: 'פולין', en: 'Poland', flag: '🇵🇱' },
  { code: '49', he: 'גרמניה', en: 'Germany', flag: '🇩🇪' },
  { code: '40', he: 'רומניה', en: 'Romania', flag: '🇷🇴' },
  { code: '32', he: 'בלגיה', en: 'Belgium', flag: '🇧🇪' },
] as const;
export function cleanDialNumber(value: string) {
  return value.replace(/[^0-9+*#]/g, '').replace(/(?!^)\+/g, '').slice(0, 24);
}
export function internationalNumber(value: string, country: string) {
  const number = cleanDialNumber(value);
  if (!number || /[*#]/.test(number)) return null;
  const full = number.startsWith('+') ? number : number.startsWith('00') ? `+${number.slice(2)}` : `+${country}${number.replace(/^0/, '')}`;
  return /^\+[1-9]\d{6,14}$/.test(full) ? full : null;
}
export function readContacts(): PhoneContact[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is PhoneContact => !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string' && c.name.length <= 80 && typeof c.number === 'string' && /^\+[1-9]\d{6,14}$/.test(c.number) && typeof c.favorite === 'boolean');
  } catch { return []; }
}
