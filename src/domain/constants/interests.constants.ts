/** Keep keys aligned with frontend `src/constants/interests.ts`. */
export const INTEREST_LABEL: Record<string, { tr: string; en: string }> = {
  travel: { tr: 'Seyahat', en: 'Travel' },
  business: { tr: 'İş Dünyası', en: 'Business' },
  technology: { tr: 'Teknoloji', en: 'Technology' },
  popCulture: { tr: 'Pop Kültür', en: 'Pop Culture' },
  science: { tr: 'Bilim', en: 'Science' },
  everyday: { tr: 'Günlük Hayat', en: 'Everyday Life' },
};

export function interestLabel(interest: string, language: 'en' | 'tr'): string {
  return INTEREST_LABEL[interest]?.[language] ?? interest;
}
