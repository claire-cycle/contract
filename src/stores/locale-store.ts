import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { en, zh, type Locale, type Translations } from '@/lib/i18n';

const translations: Record<Locale, Translations> = { en, zh };

interface LocaleState {
  locale: Locale;
}

interface LocaleActions {
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

type LocaleStore = LocaleState & LocaleActions;

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set, get) => ({
      locale: 'zh',

      setLocale: (locale) => set({ locale }),

      t: (key, fallback) => {
        const { locale } = get();
        return translations[locale]?.[key] ?? fallback ?? translations.en[key] ?? key;
      },
    }),
    {
      name: 'locale-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);
