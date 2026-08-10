import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { BUCKETS, bucketByHour, type BucketKey, type ThemeTokens } from './tokens';

// ТЕМА НЕ МЕНЯЕТСЯ «ПОД РУКАМИ»: пересчёт только при открытии
// и при возврате из фона (AppState -> active).
export function useLivingTheme(): ThemeTokens {
  const [bucket, setBucket] = useState<BucketKey>(() => bucketByHour(new Date().getHours()));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setBucket(bucketByHour(new Date().getHours()));
    });
    return () => sub.remove();
  }, []);

  return BUCKETS[bucket];
}