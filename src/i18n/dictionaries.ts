export const dictionaries = {
  he: {
    common:{appName:"WEIG",loading:"טוען…",retry:"נסו שוב",menu:"תפריט",close:"סגירה"},
    nav:{places:"מקומות",expenses:"הוצאות",calls:"שיחות",ai:"AI",trips:"טיולים",profile:"פרופיל",settings:"הגדרות",signOut:"יציאה"},
    states:{emptyTitle:"עדיין אין כאן נתונים",emptyBody:"נתונים יופיעו כאן לאחר חיבור והוספה ממקור אמיתי.",errorTitle:"לא הצלחנו לטעון",errorBody:"אירעה שגיאה. אפשר לנסות שוב מאוחר יותר.",offlineTitle:"אין חיבור לאינטרנט",offlineBody:"בדקו את החיבור ונסו שוב.",providerTitle:"הספק עדיין לא מחובר",providerBody:"המסך מוכן, אך נדרשת הגדרה של ספק חדש לפני שניתן להשתמש בו."},
    modules:{places:"מקומות",expenses:"הוצאות",calls:"שיחות",ai:"עוזר AI"},
    auth:{title:"כניסה",google:"המשך עם Google",email:"שליחת קוד חד־פעמי",emailLabel:"כתובת אימייל",notConfigured:"האימות עדיין לא הוגדר. יש להוסיף פרטי Supabase חדשים."}
  },
  en: {
    common:{appName:"WEIG",loading:"Loading…",retry:"Try again",menu:"Menu",close:"Close"},
    nav:{places:"Places",expenses:"Expenses",calls:"Calls",ai:"AI",trips:"Trips",profile:"Profile",settings:"Settings",signOut:"Sign out"},
    states:{emptyTitle:"No data yet",emptyBody:"Real data will appear here after a source is connected and items are added.",errorTitle:"We couldn’t load this",errorBody:"Something went wrong. Please try again later.",offlineTitle:"You’re offline",offlineBody:"Check your connection and try again.",providerTitle:"Provider isn’t connected",providerBody:"This screen is ready, but a new provider must be configured before it can be used."},
    modules:{places:"Places",expenses:"Expenses",calls:"Calls",ai:"AI assistant"},
    auth:{title:"Sign in",google:"Continue with Google",email:"Send one-time code",emailLabel:"Email address",notConfigured:"Authentication is not configured yet. Add the new Supabase project details first."}
  }
} as const;
export type Locale = keyof typeof dictionaries;
export type Dictionary = (typeof dictionaries)[Locale];
export const locales = Object.keys(dictionaries) as Locale[];
export function isLocale(value:string): value is Locale { return locales.includes(value as Locale); }
export function getDictionary(locale:Locale): Dictionary { return dictionaries[locale]; }
