import { useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { maskToNumbers, numbersToMask, getBallColor } from '../lib/lotto';
import { hasValidPass } from '../lib/pass';
import AdGateModal from '../components/AdGateModal';
import LatestRoundCard from '../components/LatestRoundCard';
import GuideModal from '../components/GuideModal';

const TOTAL = 8145060; // C(45,6)
const RANK_LABELS = [
  ['r1', '1등', '6개 전부 일치'],
  ['r2', '2등', '5개 + 보너스'],
  ['r3', '3등', '5개 일치'],
  ['r4', '4등', '4개 일치'],
  ['r5', '5등', '3개 일치'],
];
const ODD_RATIOS = [0, 1, 2, 3, 4, 5, 6];
const PICK_OPTIONS = [1, 5, 10, 100];
const EMPTY_RANKS = {
  r1: { min: '', max: '' },
  r2: { min: '', max: '' },
  r3: { min: '', max: '' },
  r4: { min: '', max: '' },
  r5: { min: '', max: '' },
};

// 입력 파싱: 둘 다 빈칸 → 무제한 / 최소만 → 단일값 / 둘 다 → 범위
function parseRange(min, max, hardMax) {
  const lo = String(min).trim() === '' ? null : parseInt(min, 10);
  const hi = String(max).trim() === '' ? null : parseInt(max, 10);
  if (lo === null && hi === null) return [0, hardMax];
  if (lo !== null && hi === null) return [lo, lo];
  if (lo === null && hi !== null) return [0, hi];
  return [lo, hi];
}

export default function Lab() {
  const [ranks, setRanks] = useState(EMPTY_RANKS);
  const [excluded, setExcluded] = useState(new Set());
  const [required, setRequired] = useState(new Set());
  const [oddSel, setOddSel] = useState(new Set());
  const [sum, setSum] = useState({ min: '', max: '' });

  const [phase, setPhase] = useState('idle'); // idle | counting | counted
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [pickN, setPickN] = useState(5);
  const [pickPhase, setPickPhase] = useState('idle'); // idle | picking | picked
  const [picks, setPicks] = useState([]);
  const captureRef = useRef(null);
  const [showGate, setShowGate] = useState(false);
  const [guide, setGuide] = useState(null); // 'ranks' | 'balls' | 'odd' | 'sum' | null

  const setRank = (key, field, value) =>
    setRanks((r) => ({ ...r, [key]: { ...r[key], [field]: value } }));

  // 공 상태 변경 — 한 번에 한 상태만 (제외/필수는 상호 배타)
  const setExclude = (n) => {
    setRequired((r) => { const x = new Set(r); x.delete(n); return x; });
    setExcluded((s) => { const x = new Set(s); x.add(n); return x; });
  };
  const setRequire = (n) => {
    setExcluded((s) => { const x = new Set(s); x.delete(n); return x; });
    setRequired((r) => { const x = new Set(r); x.add(n); return x; });
  };
  const clearBall = (n) => {
    setExcluded((s) => { const x = new Set(s); x.delete(n); return x; });
    setRequired((r) => { const x = new Set(r); x.delete(n); return x; });
  };

  // 스와이프 제스처: pointerdown에서 시작점 기록, pointerup에서 dx/dy 판단
  // PC 마우스 / 모바일 터치 모두 PointerEvent로 통합 처리
  const handleBallPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.sx = String(e.clientX);
    e.currentTarget.dataset.sy = String(e.clientY);
  };
  const handleBallPointerUp = (n) => (e) => {
    const sx = parseFloat(e.currentTarget.dataset.sx);
    const sy = parseFloat(e.currentTarget.dataset.sy);
    if (Number.isNaN(sx)) return;
    e.currentTarget.dataset.sx = '';
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const SWIPE = 25;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE && absY < SWIPE) {
      clearBall(n);            // 탭 → 초기화
    } else if (absX > absY) {
      if (dx > 0) setRequire(n); // → 스와이프
      else setExclude(n);        // ← 스와이프
    }
    // 세로 스와이프는 무시 (페이지 스크롤로 간주)
  };

  const toggleOdd = (v) =>
    setOddSel((s) => {
      const next = new Set(s);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  // 섹션별 초기화
  const resetRanks = () => setRanks(EMPTY_RANKS);
  const resetBalls = () => {
    setExcluded(new Set());
    setRequired(new Set());
  };
  const resetOdd = () => setOddSel(new Set());
  const resetSum = () => setSum({ min: '', max: '' });

  function buildParams() {
    const [r1m, r1x] = parseRange(ranks.r1.min, ranks.r1.max, 9999);
    const [r2m, r2x] = parseRange(ranks.r2.min, ranks.r2.max, 9999);
    const [r3m, r3x] = parseRange(ranks.r3.min, ranks.r3.max, 9999);
    const [r4m, r4x] = parseRange(ranks.r4.min, ranks.r4.max, 9999);
    const [r5m, r5x] = parseRange(ranks.r5.min, ranks.r5.max, 9999);
    const [sm, sx] = parseRange(sum.min, sum.max, 9999);

    let oddMin = 0,
      oddMax = 6;
    if (oddSel.size > 0) {
      const arr = [...oddSel];
      oddMin = Math.min(...arr);
      oddMax = Math.max(...arr);
    }

    return {
      r1_min: r1m, r1_max: r1x,
      r2_min: r2m, r2_max: r2x,
      r3_min: r3m, r3_max: r3x,
      r4_min: r4m, r4_max: r4x,
      r5_min: r5m, r5_max: r5x,
      odd_min: oddMin, odd_max: oddMax,
      sum_min: sm, sum_max: sx,
      excluded_mask: numbersToMask([...excluded]),
      required_mask: numbersToMask([...required]),
    };
  }

  // 확률 줄이기 버튼 클릭 → 이용권 있으면 바로 실행, 없으면 광고 게이트
  const handleReduceClick = () => {
    if (hasValidPass()) runReduce();
    else setShowGate(true);
  };

  const runReduce = async () => {
    setPhase('counting');
    setError(null);
    setResult(null);
    setPicks([]);
    setPickPhase('idle');
    try {
      const params = buildParams();
      const { data, error: err } = await supabase.rpc('count_filtered', params);
      if (err) throw err;
      const count = Number(data);
      setResult({
        count,
        removed: TOTAL - count,
        removedPct: ((TOTAL - count) / TOTAL) * 100,
        params,
      });
      setPhase('counted');
    } catch (e) {
      setError(e.message ?? String(e));
      setPhase('idle');
    }
  };

  const handlePick = async () => {
    if (!result) return;
    setPickPhase('picking');
    try {
      const { data, error: err } = await supabase.rpc('pick_filtered', {
        ...result.params,
        pick_count: pickN,
      });
      if (err) throw err;
      setPicks(
        data.map((row) => ({
          numbers: maskToNumbers(row.num_mask),
          rank4: row.rank4_count,
          rank5: row.rank5_count,
          sum: row.sum_total,
        }))
      );
      setPickPhase('picked');
    } catch (e) {
      setError(e.message ?? String(e));
      setPickPhase('idle');
    }
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = `lottobase_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Wrap>
      <PageTitle>연구실</PageTitle>
      <PageDesc>
        조건을 설정하고 <b>확률 줄이기</b>를 누르면, 8,145,060 경우의 수 중 조건에
        맞는 조합만 남깁니다. 모든 항목은 선택사항입니다.
      </PageDesc>

      <LatestRoundCard />

      {/* 1. 등수 범위 */}
      <Card>
        <CardTitle>
          <TitleText>
            역대 등수 출현 횟수 <Optional>(선택)</Optional>
          </TitleText>
          <HeaderActions>
            <GuideBtn onClick={() => setGuide('ranks')}>사용 가이드</GuideBtn>
            <ResetBtn onClick={resetRanks}>초기화</ResetBtn>
          </HeaderActions>
        </CardTitle>
        <CardHint>
          각 조합이 역대 1223회차에서 몇 번 해당 등수였는지로 거릅니다. 빈칸=무제한,
          한 칸만=정확히 그 값, 둘 다=범위.
        </CardHint>
        {RANK_LABELS.map(([key, label, desc]) => (
          <RankRow key={key}>
            <RankLabel>
              {label} <RankDesc>{desc}</RankDesc>
            </RankLabel>
            <RangeInputs>
              <NumInput
                type="number"
                placeholder="최소"
                value={ranks[key].min}
                onChange={(e) => setRank(key, 'min', e.target.value)}
              />
              <Tilde>~</Tilde>
              <NumInput
                type="number"
                placeholder="최대"
                value={ranks[key].max}
                onChange={(e) => setRank(key, 'max', e.target.value)}
              />
            </RangeInputs>
          </RankRow>
        ))}
      </Card>

      {/* 2. 제외 번호 */}
      <Card>
        <CardTitle>
          <TitleText>
            번호 선택 <Optional>(선택)</Optional>
            {(excluded.size > 0 || required.size > 0) && (
              <SelCount>
                {excluded.size > 0 && `${excluded.size}개 제외`}
                {excluded.size > 0 && required.size > 0 && ' · '}
                {required.size > 0 && `${required.size}개 필수`}
              </SelCount>
            )}
          </TitleText>
          <HeaderActions>
            <GuideBtn onClick={() => setGuide('balls')}>사용 가이드</GuideBtn>
            <ResetBtn onClick={resetBalls}>초기화</ResetBtn>
          </HeaderActions>
        </CardTitle>
        <CardHint>
          <b>← 스와이프</b>: 제외 (회색 ✕) ·{' '}
          <b>→ 스와이프</b>: 필수 포함 (초록 ✓) · <b>탭</b>: 초기화
        </CardHint>
        <BallGrid>
          {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
            const isExcluded = excluded.has(n);
            const isRequired = required.has(n);
            const state = isExcluded
              ? 'excluded'
              : isRequired
              ? 'required'
              : 'normal';
            return (
              <NumBall
                key={n}
                $color={isExcluded ? '#555' : getBallColor(n)}
                $state={state}
                onPointerDown={handleBallPointerDown}
                onPointerUp={handleBallPointerUp(n)}
              >
                {isExcluded ? '✕' : isRequired ? '✓' : n}
              </NumBall>
            );
          })}
        </BallGrid>
      </Card>

      {/* 3. 홀짝 비율 */}
      <Card>
        <CardTitle>
          <TitleText>
            홀짝 비율 <Optional>(선택)</Optional>
          </TitleText>
          <HeaderActions>
            <GuideBtn onClick={() => setGuide('odd')}>사용 가이드</GuideBtn>
            <ResetBtn onClick={resetOdd}>초기화</ResetBtn>
          </HeaderActions>
        </CardTitle>
        <CardHint>
          홀수 개수 기준. 선택한 값들의 범위로 거릅니다. (예: 2,3,4 선택 → 홀수
          2~4개)
        </CardHint>
        <ChipRow>
          {ODD_RATIOS.map((v) => (
            <RatioChip key={v} $on={oddSel.has(v)} onClick={() => toggleOdd(v)}>
              홀 {v} : 짝 {6 - v}
            </RatioChip>
          ))}
        </ChipRow>
      </Card>

      {/* 4. 총합 범위 */}
      <Card>
        <CardTitle>
          <TitleText>
            번호 총합 범위 <Optional>(선택)</Optional>
          </TitleText>
          <HeaderActions>
            <GuideBtn onClick={() => setGuide('sum')}>사용 가이드</GuideBtn>
            <ResetBtn onClick={resetSum}>초기화</ResetBtn>
          </HeaderActions>
        </CardTitle>
        <CardHint>6개 번호의 합. 역대 1등 평균은 약 138입니다.</CardHint>
        <RangeInputs>
          <NumInput
            type="number"
            placeholder="최소"
            value={sum.min}
            onChange={(e) => setSum((s) => ({ ...s, min: e.target.value }))}
          />
          <Tilde>~</Tilde>
          <NumInput
            type="number"
            placeholder="최대"
            value={sum.max}
            onChange={(e) => setSum((s) => ({ ...s, max: e.target.value }))}
          />
        </RangeInputs>
      </Card>

      <ReduceBtn onClick={handleReduceClick} disabled={phase === 'counting'}>
        {phase === 'counting' ? '분석 중...' : '확률 줄이기'}
      </ReduceBtn>

      {error && <ErrorBox>에러: {error}</ErrorBox>}

      {phase === 'counting' && (
        <LoadingBox>
          잠시만 기다려주세요...
          <LoadingSub>800만 개의 경우의 수를 분석하고 있습니다</LoadingSub>
        </LoadingBox>
      )}

      {phase === 'counted' && result && (
        <ResultCard>
          <ResultRow>
            <ResultLabel>전체 경우의 수</ResultLabel>
            <ResultVal>{TOTAL.toLocaleString()}</ResultVal>
          </ResultRow>
          <ResultRow>
            <ResultLabel>제거된 경우의 수</ResultLabel>
            <ResultVal $muted>
              {result.removed.toLocaleString()} ({result.removedPct.toFixed(2)}%)
            </ResultVal>
          </ResultRow>
          <Divider />
          <ResultRow>
            <ResultLabel $big>남은 경우의 수</ResultLabel>
            <ResultVal $big $accent>
              {result.count.toLocaleString()}
            </ResultVal>
          </ResultRow>
          <ProgressTrack>
            <ProgressFill style={{ width: `${result.removedPct}%` }} />
          </ProgressTrack>

          {result.count > 0 ? (
            <PickZone>
              <PickTitle>이 조건으로 번호 뽑기</PickTitle>
              <PickToggle>
                {PICK_OPTIONS.map((n) => (
                  <PickOpt key={n} $on={pickN === n} onClick={() => setPickN(n)}>
                    {n}세트
                  </PickOpt>
                ))}
              </PickToggle>
              <PickBtn onClick={handlePick} disabled={pickPhase === 'picking'}>
                {pickPhase === 'picking'
                  ? '추첨 중...'
                  : `번호 추첨하기 (${pickN}세트)`}
              </PickBtn>

              {pickPhase === 'picked' && (
                <>
                  <CaptureArea ref={captureRef}>
                    <CaptureHeader>🎯 LottoBase 추천 번호</CaptureHeader>
                    {picks.map((p, i) => (
                      <CaptureRow key={i}>
                        <CaptureIdx>{i + 1}</CaptureIdx>
                        <CaptureBalls>
                          {p.numbers.map((n) => (
                            <Ball key={n} $color={getBallColor(n)}>
                              {n}
                            </Ball>
                          ))}
                        </CaptureBalls>
                      </CaptureRow>
                    ))}
                    <CaptureFooter>lottobase.kr · 통계 기반 번호 생성</CaptureFooter>
                  </CaptureArea>
                  <DownloadBtn onClick={handleDownload}>
                    📷 이미지로 저장
                  </DownloadBtn>
                </>
              )}
            </PickZone>
          ) : (
            <NoResult>
              조건에 맞는 조합이 0개입니다. 조건을 조금 완화해보세요.
            </NoResult>
          )}
        </ResultCard>
      )}

      {showGate && (
        <AdGateModal
          onClose={() => setShowGate(false)}
          onPass={() => {
            setShowGate(false);
            runReduce();
          }}
        />
      )}

      {guide && <GuideModal type={guide} onClose={() => setGuide(null)} />}
    </Wrap>
  );
}

/* ───────── styled ───────── */
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
  b {
    color: ${(p) => p.theme.text};
  }
`;
const Card = styled.div`
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 22px;
  margin-bottom: 16px;
`;
const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
const TitleText = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;
const Optional = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => p.theme.textMuted};
`;
const SelCount = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.accent};
`;
const ResetBtn = styled.button`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  background: ${(p) => p.theme.bgInput};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 7px;
  padding: 5px 10px;
  &:hover {
    color: ${(p) => p.theme.text};
    background: ${(p) => p.theme.bgHover};
  }
`;
const HeaderActions = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
`;
const GuideBtn = styled.button`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.accent};
  background: ${(p) => p.theme.accentSoft};
  border: 1px solid ${(p) => p.theme.accent}55;
  border-radius: 7px;
  padding: 5px 10px;
  &:hover {
    background: ${(p) => p.theme.accent}22;
  }
`;
const CardHint = styled.p`
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
  margin: 6px 0 16px;
  line-height: 1.6;
`;
const RankRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.border};
  }
`;
const RankLabel = styled.div`
  font-weight: 600;
  font-size: 14px;
`;
const RankDesc = styled.span`
  font-weight: 400;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  margin-left: 6px;
`;
const RangeInputs = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const NumInput = styled.input`
  width: 80px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 14px;
  text-align: center;
  &:focus {
    outline: none;
    border-color: ${(p) => p.theme.accent};
  }
`;
const Tilde = styled.span`
  color: ${(p) => p.theme.textMuted};
`;
const BallGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  @media (max-width: 640px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;
const NumBall = styled.button`
  aspect-ratio: 1;
  border-radius: 50%;
  border: none;
  background: ${(p) =>
    p.$state === 'required' ? p.theme.success : p.$color};
  color: #fff;
  font-weight: 700;
  font-size: 20px;
  touch-action: pan-y; /* 세로 스크롤 허용, 가로 스와이프는 우리가 처리 */
  user-select: none;
  opacity: ${(p) => (p.$state === 'excluded' ? 0.45 : 1)};
  transition: transform 0.12s ease, background 0.12s ease, opacity 0.12s ease;
  &:hover {
    transform: scale(1.1);
  }
`;
const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
const RatioChip = styled.button`
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid ${(p) => (p.$on ? p.theme.accent : p.theme.border)};
  background: ${(p) => (p.$on ? p.theme.accentSoft : p.theme.bgInput)};
  color: ${(p) => (p.$on ? p.theme.accent : p.theme.textMuted)};
`;
const ReduceBtn = styled.button`
  width: 100%;
  margin-top: 8px;
  padding: 16px;
  border-radius: 12px;
  border: none;
  background: ${(p) => p.theme.accent};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 24px ${(p) => p.theme.accent}33;
  &:disabled {
    opacity: 0.5;
  }
  &:hover:not(:disabled) {
    background: ${(p) => p.theme.accentHover};
  }
`;
const ErrorBox = styled.div`
  margin-top: 16px;
  padding: 14px;
  border-radius: 10px;
  background: ${(p) => p.theme.danger}1a;
  color: ${(p) => p.theme.danger};
  font-size: 14px;
  word-break: break-all;
`;
const LoadingBox = styled.div`
  margin-top: 20px;
  padding: 32px;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: ${(p) => p.theme.accent};
`;
const LoadingSub = styled.div`
  margin-top: 6px;
  font-size: 13px;
  font-weight: 400;
  color: ${(p) => p.theme.textMuted};
`;
const ResultCard = styled.div`
  margin-top: 20px;
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 24px;
  animation: ${fade} 0.3s ease;
`;
const ResultRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 0;
`;
const ResultLabel = styled.span`
  font-size: ${(p) => (p.$big ? '16px' : '14px')};
  font-weight: ${(p) => (p.$big ? 700 : 500)};
  color: ${(p) => p.theme.textMuted};
`;
const ResultVal = styled.span`
  font-size: ${(p) => (p.$big ? '26px' : '15px')};
  font-weight: 700;
  color: ${(p) =>
    p.$accent ? p.theme.accent : p.$muted ? p.theme.textMuted : p.theme.text};
`;
const Divider = styled.div`
  height: 1px;
  background: ${(p) => p.theme.border};
  margin: 10px 0;
`;
const ProgressTrack = styled.div`
  margin-top: 14px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => p.theme.bgInput};
  overflow: hidden;
`;
const ProgressFill = styled.div`
  height: 100%;
  background: ${(p) => p.theme.accent};
  transition: width 0.6s ease;
`;
const PickZone = styled.div`
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid ${(p) => p.theme.border};
`;
const PickTitle = styled.h4`
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
`;
const PickToggle = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
`;
const PickOpt = styled.button`
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid ${(p) => (p.$on ? p.theme.accent : p.theme.border)};
  background: ${(p) => (p.$on ? p.theme.accentSoft : p.theme.bgInput)};
  color: ${(p) => (p.$on ? p.theme.accent : p.theme.textMuted)};
`;
const PickBtn = styled.button`
  width: 100%;
  padding: 13px;
  border-radius: 10px;
  border: 1px solid ${(p) => p.theme.accent};
  background: transparent;
  color: ${(p) => p.theme.accent};
  font-size: 15px;
  font-weight: 700;
  &:disabled {
    opacity: 0.5;
  }
  &:hover:not(:disabled) {
    background: ${(p) => p.theme.accentSoft};
  }
`;
const Ball = styled.span`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;
/* 캡처(다운로드)용 — 테마와 무관하게 고정 흰 카드 */
const CaptureArea = styled.div`
  margin-top: 16px;
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
`;
const CaptureHeader = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: #6200ee;
  text-align: center;
  margin-bottom: 14px;
`;
const CaptureRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  &:not(:last-of-type) {
    border-bottom: 1px solid #eee;
  }
`;
const CaptureIdx = styled.span`
  width: 22px;
  font-size: 13px;
  font-weight: 700;
  color: #999;
`;
const CaptureBalls = styled.div`
  display: flex;
  gap: 6px;
`;
const CaptureFooter = styled.div`
  margin-top: 14px;
  text-align: center;
  font-size: 11px;
  color: #aaa;
`;
const DownloadBtn = styled.button`
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 14px;
  font-weight: 600;
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
`;
const NoResult = styled.p`
  margin-top: 20px;
  padding: 16px;
  text-align: center;
  border-radius: 10px;
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.textMuted};
  font-size: 14px;
`;
