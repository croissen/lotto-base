import { useState, useEffect } from 'react';
import { fetchLottoHistory } from './lotto';

/**
 * Supabase lotto_history에서 최근(최대) 회차 번호를 반환.
 * - 로드 전: null
 * - 로드 후: 정수 (예: 1223)
 * 컴포넌트에서 fallback: `useLatestRound() ?? 1223`
 */
export function useLatestRound() {
  const [round, setRound] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchLottoHistory()
      .then((data) => {
        if (mounted && data?.length) {
          setRound(Math.max(...data.map((r) => r.회차)));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return round;
}
