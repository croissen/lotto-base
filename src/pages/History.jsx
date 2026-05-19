import { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { getBallColor, fetchLottoHistory, formatPrize, countOdd } from '../lib/lotto';
import MobileInlineAd from '../components/MobileInlineAd';

// 각 회차 당첨조합이 역대 전체에서 2~5등에 몇 번 해당했는지 계산.
// (1등은 자기 자신 = 항상 1이라 생략)
function computeRoundStats(history) {
  return history
    .map((cur) => {
      const nums = [cur.번호1, cur.번호2, cur.번호3, cur.번호4, cur.번호5, cur.번호6];
      let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0;
      for (const round of history) {
        const win = [round.번호1, round.번호2, round.번호3, round.번호4, round.번호5, round.번호6];
        const matched = nums.filter((n) => win.includes(n)).length;
        const bonusMatch = nums.includes(round.보너스);
        if (matched === 6) r1++;
        else if (matched === 5 && bonusMatch) r2++;
        else if (matched === 5) r3++;
        else if (matched === 4) r4++;
        else if (matched === 3) r5++;
      }
      const odd = countOdd(nums);
      return {
        round: cur.회차,
        numbers: nums,
        bonus: cur.보너스,
        sum: nums.reduce((a, b) => a + b, 0),
        odd,
        even: 6 - odd,
        r1, r2, r3, r4, r5,
        firstAmount: cur['1등당첨금'],
        firstWinners: cur['1등당첨자'],
        secondAmount: cur['2등당첨금'],
        secondWinners: cur['2등당첨자'],
      };
    })
    .sort((a, b) => b.round - a.round);
}

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    r1: '', r2: '', r3: '', r4: '', r5: '',
  });

  useEffect(() => {
    fetchLottoHistory()
      .then((data) => {
        setHistory(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => (history.length ? computeRoundStats(history) : []),
    [history]
  );

  const filtered = stats.filter(
    (s) =>
      (filters.r1 === '' || s.r1 === Number(filters.r1)) &&
      (filters.r2 === '' || s.r2 === Number(filters.r2)) &&
      (filters.r3 === '' || s.r3 === Number(filters.r3)) &&
      (filters.r4 === '' || s.r4 === Number(filters.r4)) &&
      (filters.r5 === '' || s.r5 === Number(filters.r5))
  );

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () =>
    setFilters({ r1: '', r2: '', r3: '', r4: '', r5: '' });

  return (
    <Wrap>
      <PageTitle>당첨 히스토리</PageTitle>
      <PageDesc>
        역대 회차별 당첨 번호와, 그 조합이 전체 회차에서 2~5등에 해당한 횟수입니다. 1등은 역대 1번씩 자기 자신의 회차에서 나온 숫자입니다.
      </PageDesc>

      {loading ? (
        <LoadingBox>역대 데이터를 분석하고 있습니다...</LoadingBox>
      ) : (
        <>
          <FilterBar>
            {[
              ['r1', '1등'],
              ['r2', '2등'],
              ['r3', '3등'],
              ['r4', '4등'],
              ['r5', '5등'],
            ].map(([k, label]) => (
              <FilterItem key={k}>
                <FilterLabel>{label} 횟수</FilterLabel>
                <FilterInput
                  type="number"
                  placeholder="전체"
                  value={filters[k]}
                  onChange={(e) => setF(k, e.target.value)}
                />
              </FilterItem>
            ))}
            <FilterItem>
              <FilterLabel>&nbsp;</FilterLabel>
              <HistResetBtn onClick={resetFilters}>초기화</HistResetBtn>
            </FilterItem>
          </FilterBar>

          <MobileInlineAd />

          <CountText>
            {filtered.length.toLocaleString()}개 회차 표시 중
          </CountText>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>회차</Th>
                  <Th>당첨 번호</Th>
                  <Th>보너스</Th>
                  <Th>합</Th>
                  <Th>홀:짝</Th>
                  <Th>1등</Th>
                  <Th>2등</Th>
                  <Th>3등</Th>
                  <Th>4등</Th>
                  <Th>5등</Th>
                  <Th>1등 당첨자</Th>
                  <Th>1등 당첨금</Th>
                  <Th>2등 당첨자</Th>
                  <Th>2등 당첨금</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.round}>
                    <Td>{s.round}회</Td>
                    <Td>
                      <Balls>
                        {s.numbers.map((n) => (
                          <Ball key={n} $color={getBallColor(n)}>
                            {n}
                          </Ball>
                        ))}
                      </Balls>
                    </Td>
                    <Td>
                      <Ball $color={getBallColor(s.bonus)} $bonus>
                        {s.bonus}
                      </Ball>
                    </Td>
                    <Td>{s.sum}</Td>
                    <Td>{s.odd}:{s.even}</Td>
                    <Td>{s.r1}</Td>
                    <Td>{s.r2}</Td>
                    <Td>{s.r3}</Td>
                    <Td>{s.r4}</Td>
                    <Td>{s.r5}</Td>
                    <Td>
                      {s.firstWinners != null
                        ? `${s.firstWinners.toLocaleString()}명`
                        : '—'}
                    </Td>
                    <Td>{formatPrize(s.firstAmount, { compact: true })}</Td>
                    <Td>
                      {s.secondWinners != null
                        ? `${s.secondWinners.toLocaleString()}명`
                        : '—'}
                    </Td>
                    <Td>{formatPrize(s.secondAmount, { compact: true })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}
    </Wrap>
  );
}

const fade = keyframes`from{opacity:0}to{opacity:1}`;

const Wrap = styled.div`
  padding: 40px 0 80px;
  animation: ${fade} 0.3s ease;
`;
const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.8px;
`;
const PageDesc = styled.p`
  color: ${(p) => p.theme.textMuted};
  margin: 8px 0 28px;
  font-size: 15px;
  line-height: 1.6;
`;
const LoadingBox = styled.div`
  padding: 60px;
  text-align: center;
  color: ${(p) => p.theme.accent};
  font-weight: 600;
`;
const FilterBar = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 12px;
  padding: 16px;
`;
const FilterItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const FilterLabel = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  font-weight: 600;
`;
const FilterInput = styled.input`
  width: 90px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: ${(p) => p.theme.accent};
  }
`;
const HistResetBtn = styled.button`
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.textMuted};
  font-size: 14px;
  font-weight: 600;
  &:hover {
    color: ${(p) => p.theme.text};
    background: ${(p) => p.theme.bgHover};
  }
`;
const CountText = styled.p`
  margin: 14px 2px;
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
`;
const TableWrap = styled.div`
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 12px;
  /* 모바일 / 좁은 화면: 가로 스크롤 허용 */
  @media (max-width: 920px) {
    overflow-x: auto;
  }
  /* PC: Layout의 920px 컨테이너 폭을 넘어 더 넓게 확장 → 스크롤 없이 모든 컬럼 표시 */
  @media (min-width: 921px) {
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    width: min(1280px, calc(100vw - 40px));
  }
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  @media (min-width: 921px) {
    font-size: 13px;
  }
`;
const Th = styled.th`
  background: ${(p) => p.theme.bgElevated};
  color: ${(p) => p.theme.textMuted};
  font-weight: 600;
  font-size: 13px;
  padding: 12px 10px;
  text-align: center;
  white-space: nowrap;
  border-bottom: 1px solid ${(p) => p.theme.border};
  @media (min-width: 921px) {
    padding: 12px 8px;
    font-size: 12px;
  }
`;
const Td = styled.td`
  padding: 10px;
  text-align: center;
  white-space: nowrap;
  border-bottom: 1px solid ${(p) => p.theme.border};
  color: ${(p) => p.theme.text};
  @media (min-width: 921px) {
    padding: 8px 6px;
  }
`;
const Balls = styled.div`
  display: flex;
  gap: 4px;
  justify-content: center;
`;
const Ball = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  ${(p) => p.$bonus && `border: 2px solid ${p.theme.text};`}
`;
