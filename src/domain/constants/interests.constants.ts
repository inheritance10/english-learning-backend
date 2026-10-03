/** Keep keys aligned with frontend `src/constants/interests.ts`. */
export const INTEREST_LABEL: Record<string, { tr: string; en: string }> = {
  travel: { tr: 'Seyahat', en: 'Travel' },
  business: { tr: 'İş Dünyası', en: 'Business' },
  technology: { tr: 'Teknoloji', en: 'Technology' },
  popCulture: { tr: 'Film ve Dizi', en: 'Film & TV' },
  science: { tr: 'Bilim', en: 'Science' },
  everyday: { tr: 'Günlük Hayat', en: 'Everyday Life' },
  sports: { tr: 'Spor', en: 'Sports' },
  food: { tr: 'Yemek', en: 'Food & Cooking' },
  music: { tr: 'Müzik', en: 'Music' },
  health: { tr: 'Sağlık ve Fitness', en: 'Health & Fitness' },
  nature: { tr: 'Doğa ve Hayvanlar', en: 'Nature & Animals' },
  history: { tr: 'Tarih', en: 'History' },
  gaming: { tr: 'Oyun', en: 'Gaming' },
  art: { tr: 'Sanat ve Tasarım', en: 'Art & Design' },
  fashion: { tr: 'Moda', en: 'Fashion' },
  money: { tr: 'Para ve Girişimcilik', en: 'Money & Startups' },
};

export function interestLabel(interest: string, language: 'en' | 'tr'): string {
  return INTEREST_LABEL[interest]?.[language] ?? interest;
}
