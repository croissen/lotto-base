import { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { supabase } from '../lib/supabase';
import {
  getBallColor,
  invalidateHistoryCache,
} from '../lib/lotto';
import { useLatestRound } from '../lib/useLatestRound';
import { getVisitStats } from '../lib/visits';

/* 일별 PV 막대 그래프 */
function BarChart({ data }) {
  // 오래된 순으로 정렬 (좌→우 = 과거→오늘)
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...sorted.map((d) => d.count), 1);

  if (sorted.length === 0) {
    return <ChartEmpty>데이터가 아직 없습니다.</ChartEmpty>;
  }

  return (
    <ChartWrap>
      {sorted.map((d) => {
        const heightPct = (d.count / max) * 100;
        const mmdd = d.date.slice(5); // MM-DD
        return (
          <BarColumn key={d.date}>
            <BarVal>{d.count}</BarVal>
            <BarRail>
              <BarFill style={{ height: `${heightPct}%` }} />
            </BarRail>
            <BarLabel>{mmdd}</BarLabel>
          </BarColumn>
        );
      })}
    </ChartWrap>
  );
}

/* 방문자 통계 화면 — 그래프 + 일별 상세 + 새로고침 */
function VisitStatsScreen({ onBack }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getVisitStats(days)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? String(err));
        setLoading(false);
      });
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = stats.find((s) => s.date === todayStr);
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const uniqueTotal = stats.reduce((sum, s) => sum + s.unique_count, 0);
  const dayCount = stats.length;
  const avgPerDay = dayCount > 0 ? Math.round(total / dayCount) : 0;

  return (
    <ScreenWrap>
      <ScreenHeader>
        <BackBtn onClick={onBack}>← 메뉴</BackBtn>
        <ScreenTitle>방문자 통계</ScreenTitle>
        <RefreshBtn onClick={load} disabled={loading}>
          {loading ? '...' : '↻'}
        </RefreshBtn>
      </ScreenHeader>

      <RangeToggle>
        {[7, 14, 30].map((n) => (
          <RangeBtn key={n} $active={days === n} onClick={() => setDays(n)}>
            {n}일
          </RangeBtn>
        ))}
      </RangeToggle>

      {error && <ErrorMsg>통계 로드 실패: {error}</ErrorMsg>}

      <SummaryGrid>
        <SummaryCell>
          <SummaryLabel>오늘 PV</SummaryLabel>
          <SummaryValue>{(today?.count ?? 0).toLocaleString()}</SummaryValue>
          <SummarySub>유니크 {today?.unique_count ?? 0}명</SummarySub>
        </SummaryCell>
        <SummaryCell>
          <SummaryLabel>총 {dayCount}일 PV</SummaryLabel>
          <SummaryValue>{total.toLocaleString()}</SummaryValue>
          <SummarySub>유니크 {uniqueTotal.toLocaleString()}</SummarySub>
        </SummaryCell>
        <SummaryCell>
          <SummaryLabel>일평균 PV</SummaryLabel>
          <SummaryValue>{avgPerDay.toLocaleString()}</SummaryValue>
          <SummarySub>{dayCount}일 기준</SummarySub>
        </SummaryCell>
      </SummaryGrid>

      <ChartCard>
        <ChartTitle>일별 PV 추이 (최근 {days}일)</ChartTitle>
        {loading ? (
          <ChartEmpty>로딩 중...</ChartEmpty>
        ) : (
          <BarChart data={stats} />
        )}
      </ChartCard>

      <DailyList>
        <DailyTitle>일별 상세</DailyTitle>
        {stats.length === 0 ? (
          <DailyEmpty>아직 기록이 없습니다.</DailyEmpty>
        ) : (
          stats.map((s) => (
            <DailyRow key={s.date}>
              <DailyDate>{s.date}</DailyDate>
              <DailyVal>PV {s.count.toLocaleString()}</DailyVal>
              <DailyVal>유니크 {s.unique_count.toLocaleString()}</DailyVal>
            </DailyRow>
          ))
        )}
      </DailyList>
    </ScreenWrap>
  );
}

/* 3단계 비밀번호 → 메뉴 (통계 / 회차 추가) */
export default function Admin() {
  // 인증 진행 단계: 1, 2, 3, 'authed'
  const [stage, setStage] = useState(1);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pw3, setPw3] = useState('');
  const [authError, setAuthError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // 인증 통과 후 화면 모드
  const [view, setView] = useState('menu'); // 'menu' | 'stats' | 'addround'

  // 메뉴 화면의 "일일 조회수: N" 표시용
  const [todayCount, setTodayCount] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);

  const loadTodayCount = useCallback(async () => {
    setTodayLoading(true);
    try {
      const data = await getVisitStats(1);
      const todayStr = new Date().toISOString().slice(0, 10);
      const today = data.find((s) => s.date === todayStr);
      setTodayCount(today?.count ?? 0);
    } catch {
      setTodayCount(null);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // 인증 통과 시 / 메뉴로 돌아올 때마다 오늘 조회수 갱신
  useEffect(() => {
    if (stage === 'authed' && view === 'menu') {
      loadTodayCount();
    }
  }, [stage, view, loadTodayCount]);

  // 회차 추가 폼 상태
  const latestRound = useLatestRound();
  const [roundNo, setRoundNo] = useState('');
  const [nums, setNums] = useState(['', '', '', '', '', '']);
  const [bonus, setBonus] = useState('');
  // 선택 입력: 당첨금 정보 (몰라도 OK, 추후 NULL 허용)
  const [firstAmount, setFirstAmount] = useState('');
  const [firstWinners, setFirstWinners] = useState('');
  const [secondAmount, setSecondAmount] = useState('');
  const [secondWinners, setSecondWinners] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null); // {ok, text}

  // 최신회차 + 1을 기본값으로
  useEffect(() => {
    if (latestRound && !roundNo) setRoundNo(String(latestRound + 1));
  }, [latestRound]);

  // 비밀번호 검증 — 항상 trim해서 공백 자동 제거
  const verifyPassword = async (s, pw) => {
    const cleanPw = String(pw).trim();
    const { data, error } = await supabase.rpc('verify_admin_password', {
      p_stage: s,
      p_password: cleanPw,
    });
    if (error) throw error;
    return data === true;
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setVerifying(true);
    const raw = stage === 1 ? pw1 : stage === 2 ? pw2 : pw3;
    try {
      const ok = await verifyPassword(stage, raw);
      if (ok) {
        // 트림된 값으로 state 정규화 (이후 add_lotto_round에 동일 값 사용)
        const clean = String(raw).trim();
        if (stage === 1) setPw1(clean);
        else if (stage === 2) setPw2(clean);
        else setPw3(clean);

        if (stage < 3) setStage(stage + 1);
        else setStage('authed');
      } else {
        setAuthError(`${stage}차 비밀번호가 일치하지 않습니다`);
      }
    } catch (err) {
      setAuthError(err.message ?? String(err));
    } finally {
      setVerifying(false);
    }
  };

  // 6개 본번호 input 핸들러
  const setNum = (i, v) => {
    const next = [...nums];
    next[i] = v.replace(/[^0-9]/g, '').slice(0, 2);
    setNums(next);
  };

  // "12 15 19 22 24 36 3" 형태를 한 번에 분배
  // (공백/쉼표/탭/줄바꿈 등 아무 구분자나 허용, 6개 이상이면 마지막은 보너스)
  const fillFromText = (text) => {
    const parts = String(text)
      .split(/[^0-9]+/)
      .filter((s) => s !== '')
      .map((s) => s.slice(0, 2)); // 두 자리로 제한
    if (parts.length < 2) return false; // 숫자 하나뿐이면 일반 입력으로 처리

    const six = parts.slice(0, 6);
    const next = ['', '', '', '', '', ''];
    six.forEach((p, i) => {
      next[i] = p;
    });
    setNums(next);

    // 7개 이상이면 7번째를 보너스로
    if (parts.length >= 7) {
      setBonus(parts[6]);
    }
    setSubmitMsg(null);
    return true;
  };

  // input에서 붙여넣기 감지 → 여러 숫자면 자동 분배
  const handleNumsPaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    const nCount = (text.match(/\d+/g) ?? []).length;
    if (nCount >= 2) {
      e.preventDefault();
      fillFromText(text);
    }
  };

  // 회차 추가 제출
  const handleAddRound = async (e) => {
    e.preventDefault();
    setSubmitMsg(null);

    // 클라이언트 측 1차 검증
    const r = parseInt(roundNo, 10);
    const ns = nums.map((n) => parseInt(n, 10));
    const b = parseInt(bonus, 10);

    if (!Number.isFinite(r) || r < 1) {
      setSubmitMsg({ ok: false, text: '회차 번호를 확인해주세요' });
      return;
    }
    if (ns.some((n) => !Number.isFinite(n) || n < 1 || n > 45)) {
      setSubmitMsg({ ok: false, text: '본번호 6개를 1~45 사이로 입력해주세요' });
      return;
    }
    if (new Set(ns).size !== 6) {
      setSubmitMsg({ ok: false, text: '본번호 6개가 서로 달라야 합니다' });
      return;
    }
    if (!Number.isFinite(b) || b < 1 || b > 45) {
      setSubmitMsg({ ok: false, text: '보너스 번호를 1~45 사이로 입력해주세요' });
      return;
    }
    if (ns.includes(b)) {
      setSubmitMsg({ ok: false, text: '보너스 번호가 본번호와 같습니다' });
      return;
    }

    // 선택 입력: 빈 문자열 → null로
    const parseOpt = (s) => {
      const v = String(s).replace(/[^0-9]/g, '').trim();
      return v === '' ? null : parseInt(v, 10);
    };
    const fa = parseOpt(firstAmount);
    const fw = parseOpt(firstWinners);
    const sa = parseOpt(secondAmount);
    const sw = parseOpt(secondWinners);

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('add_lotto_round', {
        p_pw1: pw1, p_pw2: pw2, p_pw3: pw3,
        p_round_no: r,
        p_n1: ns[0], p_n2: ns[1], p_n3: ns[2],
        p_n4: ns[3], p_n5: ns[4], p_n6: ns[5],
        p_bonus: b,
        p_first_amount: fa,
        p_first_winners: fw,
        p_second_amount: sa,
        p_second_winners: sw,
      });
      if (error) throw error;

      // 캐시 무효화 → 사이트 곳곳에서 새 회차 즉시 반영
      invalidateHistoryCache();

      setSubmitMsg({
        ok: true,
        text: `${r}회차 추가 완료. 800만 조합 중 ${(data?.rows_updated ?? 0).toLocaleString()}개 행 갱신됨.`,
      });

      // 폼 초기화 (다음 회차로)
      setRoundNo(String(r + 1));
      setNums(['', '', '', '', '', '']);
      setBonus('');
      setFirstAmount('');
      setFirstWinners('');
      setSecondAmount('');
      setSecondWinners('');
    } catch (err) {
      setSubmitMsg({ ok: false, text: err.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  // ───── 렌더 ─────
  if (stage !== 'authed') {
    return (
      <Wrap>
        <Hidden>
          <h1>인증</h1>
          <Sub>관리자 페이지 — {stage}차 / 3차</Sub>
        </Hidden>

        <Form onSubmit={handleStageSubmit}>
          <Label>{stage}차 비밀번호</Label>
          <PwInput
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={stage === 1 ? pw1 : stage === 2 ? pw2 : pw3}
            onChange={(e) => {
              const v = e.target.value;
              if (stage === 1) setPw1(v);
              else if (stage === 2) setPw2(v);
              else setPw3(v);
            }}
            disabled={verifying}
          />
          <Btn type="submit" disabled={verifying}>
            {verifying ? '확인 중...' : '확인'}
          </Btn>
          {authError && <ErrorMsg>{authError}</ErrorMsg>}
        </Form>
      </Wrap>
    );
  }

  // 메뉴 화면
  if (view === 'menu') {
    return (
      <Wrap>
        <Hidden>
          <h1>관리자 메뉴</h1>
        </Hidden>
        <MenuList>
          <MenuBtn onClick={() => setView('stats')}>
            <MenuBtnIcon>📊</MenuBtnIcon>
            <MenuBtnText>
              <MenuBtnLabel>일일 조회수</MenuBtnLabel>
              <MenuBtnValue>
                {todayLoading
                  ? '...'
                  : todayCount === null
                  ? '로드 실패'
                  : todayCount.toLocaleString()}
              </MenuBtnValue>
            </MenuBtnText>
            <MenuBtnArrow>›</MenuBtnArrow>
          </MenuBtn>

          <MenuBtn onClick={() => setView('addround')}>
            <MenuBtnIcon>✏️</MenuBtnIcon>
            <MenuBtnText>
              <MenuBtnLabel>회차 데이터 추가하기</MenuBtnLabel>
              <MenuBtnValue>최신 회차: {latestRound ?? '...'}회</MenuBtnValue>
            </MenuBtnText>
            <MenuBtnArrow>›</MenuBtnArrow>
          </MenuBtn>
        </MenuList>
      </Wrap>
    );
  }

  // 통계 화면
  if (view === 'stats') {
    return (
      <Wrap>
        <VisitStatsScreen onBack={() => setView('menu')} />
      </Wrap>
    );
  }

  // 회차 추가 화면 (기존)
  return (
    <Wrap>
      <ScreenHeader>
        <BackBtn onClick={() => setView('menu')}>← 메뉴</BackBtn>
        <ScreenTitle>회차 추가</ScreenTitle>
        <ScreenSpacer />
      </ScreenHeader>
      <Hidden>
        <Sub>최신 회차: {latestRound ?? '...'}회</Sub>
      </Hidden>

      <FormWide onSubmit={handleAddRound}>
        <Row>
          <Label>회차 번호</Label>
          <NumIn
            type="number"
            value={roundNo}
            onChange={(e) => setRoundNo(e.target.value)}
            disabled={submitting}
          />
        </Row>

        <Divider />
        <Label>
          한 번에 붙여넣기{' '}
          <Optional>(예: 12 15 19 22 24 36 3 → 본번호 6개 + 보너스)</Optional>
        </Label>
        <NumIn
          type="text"
          inputMode="numeric"
          placeholder="12 15 19 22 24 36 3"
          onPaste={handleNumsPaste}
          onChange={(e) => {
            // 붙여넣기가 아닌 직접 입력/자동완성도 처리
            if ((e.target.value.match(/\d+/g) ?? []).length >= 2) {
              if (fillFromText(e.target.value)) e.target.value = '';
            }
          }}
          disabled={submitting}
        />
        <Divider />

        <Label>본번호 6개 (1~45, 서로 다른 수)</Label>
        <NumGrid>
          {nums.map((n, i) => (
            <NumCell key={i}>
              <NumIn
                type="number"
                inputMode="numeric"
                min={1}
                max={45}
                placeholder={`${i + 1}`}
                value={n}
                onChange={(e) => setNum(i, e.target.value)}
                onPaste={handleNumsPaste}
                disabled={submitting}
              />
              {n && Number(n) >= 1 && Number(n) <= 45 && (
                <Preview $color={getBallColor(Number(n))}>{n}</Preview>
              )}
            </NumCell>
          ))}
        </NumGrid>

        <Row>
          <Label>보너스 번호</Label>
          <NumCell>
            <NumIn
              type="number"
              inputMode="numeric"
              min={1}
              max={45}
              placeholder="보너스"
              value={bonus}
              onChange={(e) => setBonus(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              onPaste={handleNumsPaste}
              disabled={submitting}
            />
            {bonus && Number(bonus) >= 1 && Number(bonus) <= 45 && (
              <Preview $color={getBallColor(Number(bonus))} $bonus>{bonus}</Preview>
            )}
          </NumCell>
        </Row>

        <Divider />
        <Label>당첨금 정보 <Optional>(선택 — 동행복권 발표 후 입력)</Optional></Label>
        <PrizeGrid>
          <PrizeCell>
            <PrizeSub>1등 당첨금 (1명당, 원)</PrizeSub>
            <NumIn
              type="text"
              inputMode="numeric"
              placeholder="예: 1857554133"
              value={firstAmount}
              onChange={(e) => setFirstAmount(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={submitting}
            />
          </PrizeCell>
          <PrizeCell>
            <PrizeSub>1등 당첨자 수 (명)</PrizeSub>
            <NumIn
              type="text"
              inputMode="numeric"
              placeholder="예: 16"
              value={firstWinners}
              onChange={(e) => setFirstWinners(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={submitting}
            />
          </PrizeCell>
          <PrizeCell>
            <PrizeSub>2등 당첨금 (1명당, 원)</PrizeSub>
            <NumIn
              type="text"
              inputMode="numeric"
              placeholder="예: 48092017"
              value={secondAmount}
              onChange={(e) => setSecondAmount(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={submitting}
            />
          </PrizeCell>
          <PrizeCell>
            <PrizeSub>2등 당첨자 수 (명)</PrizeSub>
            <NumIn
              type="text"
              inputMode="numeric"
              placeholder="예: 103"
              value={secondWinners}
              onChange={(e) => setSecondWinners(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={submitting}
            />
          </PrizeCell>
        </PrizeGrid>

        <SubmitBtn type="submit" disabled={submitting}>
          {submitting
            ? '갱신 중... (800만 행 업데이트, 30~90초 소요)'
            : '회차 추가 + 확률 갱신'}
        </SubmitBtn>

        {submitMsg && (
          <ResultBox $ok={submitMsg.ok}>{submitMsg.text}</ResultBox>
        )}

        <Note>
          제출하면 서버에서 800만 조합의 rank 카운트가 자동으로 갱신됩니다.
          시간이 좀 걸리니 페이지를 닫지 말고 기다려주세요.
        </Note>
      </FormWide>
    </Wrap>
  );
}

const fade = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;

const Wrap = styled.div`
  max-width: 460px;
  margin: 0 auto;
  padding: 80px 20px;
  animation: ${fade} 0.3s ease;
`;
const Hidden = styled.div`
  text-align: center;
  margin-bottom: 28px;
  h1 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
`;
const Sub = styled.p`
  color: ${(p) => p.theme.textMuted};
  font-size: 13px;
  margin-top: 4px;
`;
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const FormWide = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  & > label {
    width: 90px;
    flex-shrink: 0;
  }
`;
const PwInput = styled.input`
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 18px;
  text-align: center;
  letter-spacing: 0.4em;
  &:focus {
    outline: none;
    border-color: ${(p) => p.theme.accent};
  }
`;
const NumIn = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 15px;
  text-align: center;
  &:focus {
    outline: none;
    border-color: ${(p) => p.theme.accent};
  }
`;
const NumGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  @media (max-width: 480px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;
const NumCell = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const Preview = styled.span`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  ${(p) => p.$bonus && `border: 2px solid ${p.theme.text};`}
`;
const Btn = styled.button`
  padding: 13px;
  border-radius: 10px;
  border: none;
  background: ${(p) => p.theme.accent};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  &:disabled {
    opacity: 0.5;
  }
  &:hover:not(:disabled) {
    background: ${(p) => p.theme.accentHover};
  }
`;
const SubmitBtn = styled(Btn)`
  margin-top: 12px;
  padding: 15px;
`;
const ErrorMsg = styled.p`
  margin-top: 4px;
  color: ${(p) => p.theme.danger};
  font-size: 13px;
  text-align: center;
`;
const ResultBox = styled.div`
  margin-top: 8px;
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  background: ${(p) => (p.$ok ? p.theme.success + '22' : p.theme.danger + '22')};
  color: ${(p) => (p.$ok ? p.theme.success : p.theme.danger)};
`;
const Note = styled.p`
  margin-top: 8px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  line-height: 1.6;
`;
const Divider = styled.div`
  height: 1px;
  background: ${(p) => p.theme.border};
  margin: 8px 0;
`;
const Optional = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${(p) => p.theme.textMuted};
  margin-left: 4px;
`;
const PrizeGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;
const PrizeCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const PrizeSub = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
`;

/* 메뉴 화면 styled */
const MenuList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
`;
const MenuBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgElevated};
  color: ${(p) => p.theme.text};
  cursor: pointer;
  text-align: left;
  transition: background 0.18s ease, transform 0.05s ease;
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
  &:active {
    transform: scale(0.99);
  }
`;
const MenuBtnIcon = styled.div`
  font-size: 28px;
  flex-shrink: 0;
`;
const MenuBtnText = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const MenuBtnLabel = styled.div`
  font-size: 15px;
  font-weight: 700;
`;
const MenuBtnValue = styled.div`
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
`;
const MenuBtnArrow = styled.div`
  font-size: 24px;
  color: ${(p) => p.theme.textMuted};
  flex-shrink: 0;
`;

/* 화면 헤더 (뒤로가기/제목/새로고침) */
const ScreenWrap = styled.div``;
const ScreenHeader = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;
const ScreenTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  margin: 0;
`;
const ScreenSpacer = styled.div`
  width: 60px;
`;
const BackBtn = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
`;
const RefreshBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  font-size: 18px;
  cursor: pointer;
  &:hover:not(:disabled) {
    background: ${(p) => p.theme.bgHover};
  }
  &:disabled {
    opacity: 0.5;
  }
`;

/* 기간 토글 */
const RangeToggle = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
`;
const RangeBtn = styled.button`
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid
    ${(p) => (p.$active ? p.theme.accent : p.theme.border)};
  background: ${(p) =>
    p.$active ? p.theme.accentSoft : p.theme.bgInput};
  color: ${(p) => (p.$active ? p.theme.accent : p.theme.textMuted)};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    color: ${(p) => p.theme.text};
  }
`;

/* 그래프 카드 */
const ChartCard = styled.div`
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 18px 16px;
  margin-bottom: 18px;
`;
const ChartTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 16px;
`;
const ChartWrap = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 180px;
  padding: 0 4px;
`;
const ChartEmpty = styled.div`
  padding: 40px 12px;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
`;
const BarColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  min-width: 0;
`;
const BarVal = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${(p) => p.theme.text};
  margin-bottom: 4px;
`;
const BarRail = styled.div`
  width: 100%;
  flex: 1;
  display: flex;
  align-items: flex-end;
  background: ${(p) => p.theme.bgInput};
  border-radius: 4px;
  overflow: hidden;
`;
const BarFill = styled.div`
  width: 100%;
  background: ${(p) => p.theme.accent};
  border-radius: 4px;
  min-height: 2px;
  transition: height 0.3s ease;
`;
const BarLabel = styled.div`
  font-size: 10px;
  color: ${(p) => p.theme.textMuted};
  margin-top: 6px;
  white-space: nowrap;
`;

/* 통계 박스 (요약) */
const StatsBox = styled.div`
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 24px;
`;
const StatsTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 16px;
`;
const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 18px;
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;
const SummaryCell = styled.div`
  background: ${(p) => p.theme.bgInput};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 10px;
  padding: 12px;
`;
const SummaryLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 6px;
`;
const SummaryValue = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: ${(p) => p.theme.accent};
  letter-spacing: -0.5px;
`;
const SummarySub = styled.div`
  margin-top: 2px;
  font-size: 11px;
  color: ${(p) => p.theme.textMuted};
`;
const DailyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
`;
const DailyTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 6px;
`;
const DailyEmpty = styled.div`
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textMuted};
`;
const DailyRow = styled.div`
  display: grid;
  grid-template-columns: 110px 1fr 1fr;
  align-items: center;
  padding: 8px 4px;
  font-size: 13px;
  border-bottom: 1px solid ${(p) => p.theme.border};
  &:last-child {
    border-bottom: none;
  }
`;
const DailyDate = styled.div`
  font-weight: 600;
  color: ${(p) => p.theme.text};
`;
const DailyVal = styled.div`
  color: ${(p) => p.theme.textMuted};
  font-size: 12px;
`;
