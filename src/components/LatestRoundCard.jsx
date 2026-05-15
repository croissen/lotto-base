import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { getBallColor } from '../lib/lotto';

// 회차 → 날짜 변환 기준점: 1223회차 = 2026-05-09 (토요일)
// 이후 회차는 +7일씩
const BASE_ROUND = 1223;
const BASE_DATE = new Date(2026, 4, 9); // 월은 0-인덱스 (4 = 5월)
const WEEK_MS = 7 * 24 * 3600 * 1000;

function dateForRound(round) {
  return new Date(BASE_DATE.getTime() + (round - BASE_ROUND) * WEEK_MS);
}

function formatYYMMDD(d) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export default function LatestRoundCard() {
  const [history, setHistory] = useState([]);
  const [round, setRound] = useState(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}lotto.json`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data);
        const max = Math.max(...data.map((r) => r.회차));
        setRound(max);
      })
      .catch(() => {});
  }, []);

  const bounds = useMemo(() => {
    if (history.length === 0) return null;
    const rs = history.map((r) => r.회차);
    return { min: Math.min(...rs), max: Math.max(...rs) };
  }, [history]);

  // 선택된 회차의 당첨조합이 역대 1~5등에 몇 번 해당했는지 계산
  const data = useMemo(() => {
    if (!round || history.length === 0) return null;
    const row = history.find((r) => r.회차 === round);
    if (!row) return null;
    const nums = [row.번호1, row.번호2, row.번호3, row.번호4, row.번호5, row.번호6];
    let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0;
    for (const o of history) {
      const win = [o.번호1, o.번호2, o.번호3, o.번호4, o.번호5, o.번호6];
      const matched = nums.filter((n) => win.includes(n)).length;
      const bonusMatch = nums.includes(o.보너스);
      if (matched === 6) r1++;
      else if (matched === 5 && bonusMatch) r2++;
      else if (matched === 5) r3++;
      else if (matched === 4) r4++;
      else if (matched === 3) r5++;
    }
    return { nums, bonus: row.보너스, r1, r2, r3, r4, r5 };
  }, [round, history]);

  if (!bounds || !data || round === null) {
    return (
      <Card>
        <Loading>역대 데이터 로드 중...</Loading>
      </Card>
    );
  }

  const isLatest = round === bounds.max;
  const isOldest = round === bounds.min;
  const dateStr = formatYYMMDD(dateForRound(round));

  return (
    <Card $pinned={pinned}>
      <Head>
        <NavBtn
          onClick={() => setRound((r) => r - 1)}
          disabled={isOldest}
          aria-label="이전 회차"
        >
          ‹
        </NavBtn>
        <HeadCenter>
          <RoundLabel>{round}회차 당첨번호</RoundLabel>
          <DateLabel>{dateStr}</DateLabel>
          {!isLatest && (
            <LatestLink onClick={() => setRound(bounds.max)}>
              ↻ 최신회차로
            </LatestLink>
          )}
        </HeadCenter>
        <RightGroup>
          <PinBtn
            onClick={() => setPinned((v) => !v)}
            $on={pinned}
            title={pinned ? '고정 해제' : '상단에 고정'}
          >
            고정📌
          </PinBtn>
          <NavBtn
            onClick={() => setRound((r) => r + 1)}
            disabled={isLatest}
            aria-label="다음 회차"
          >
            ›
          </NavBtn>
        </RightGroup>
      </Head>

      <BallRow>
        {data.nums.map((n) => (
          <Ball key={n} $color={getBallColor(n)}>
            {n}
          </Ball>
        ))}
        <SumChip>합 {data.nums.reduce((a, b) => a + b, 0)}</SumChip>
        <Plus>+</Plus>
        <Ball $color={getBallColor(data.bonus)} $bonus>
          {data.bonus}
        </Ball>
      </BallRow>

      <RankRow>
        <RankChip>
          1등 <RankVal>{data.r1}{isLatest && ' (이번회차)'}</RankVal>
        </RankChip>
        <RankChip>
          2등 <RankVal>{data.r2}</RankVal>
        </RankChip>
        <RankChip>
          3등 <RankVal>{data.r3}</RankVal>
        </RankChip>
        <RankChip>
          4등 <RankVal>{data.r4}</RankVal>
        </RankChip>
        <RankChip>
          5등 <RankVal>{data.r5}</RankVal>
        </RankChip>
      </RankRow>
    </Card>
  );
}

const Card = styled.div`
  position: ${(p) => (p.$pinned ? 'sticky' : 'relative')};
  top: ${(p) => (p.$pinned ? '60px' : 'auto')};
  z-index: ${(p) => (p.$pinned ? 40 : 'auto')};
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: ${(p) => (p.$pinned ? p.theme.shadow : 'none')};
  transition: box-shadow 0.18s ease;
`;
const PinBtn = styled.button`
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$on ? p.theme.accent : p.theme.border)};
  background: ${(p) => (p.$on ? p.theme.accentSoft : p.theme.bgInput)};
  color: ${(p) => (p.$on ? p.theme.accent : p.theme.textMuted)};
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  white-space: nowrap;
  filter: ${(p) => (p.$on ? 'none' : 'grayscale(0.6)')};
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
`;
const SumChip = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: ${(p) => p.theme.textMuted};
  background: ${(p) => p.theme.bgInput};
  border-radius: 6px;
  padding: 4px 8px;
  margin: 0 4px;
  white-space: nowrap;
`;
const Loading = styled.div`
  text-align: center;
  color: ${(p) => p.theme.textMuted};
  font-size: 14px;
  padding: 20px;
`;
const Head = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  & > :first-child {
    justify-self: start;
  }
  & > :last-child {
    justify-self: end;
  }
`;
const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const HeadCenter = styled.div`
  text-align: center;
`;
const RoundLabel = styled.div`
  font-size: 15px;
  font-weight: 700;
`;
const DateLabel = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  margin-top: 2px;
`;
const LatestLink = styled.button`
  margin-top: 6px;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.accent};
  padding: 2px 6px;
  border-radius: 6px;
  &:hover {
    background: ${(p) => p.theme.accentSoft};
  }
`;
const NavBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
  &:hover:not(:disabled) {
    background: ${(p) => p.theme.bgHover};
  }
`;
const BallRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin: 18px 0 16px;
  flex-wrap: wrap;
`;
const Ball = styled.span`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  ${(p) => p.$bonus && `border: 2px solid ${p.theme.text};`}
`;
const Plus = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  margin: 0 4px;
`;
const RankRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
`;
const RankChip = styled.div`
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
  background: ${(p) => p.theme.bgInput};
  border-radius: 8px;
  padding: 7px 12px;
`;
const RankVal = styled.b`
  color: ${(p) => p.theme.text};
  margin-left: 4px;
`;
