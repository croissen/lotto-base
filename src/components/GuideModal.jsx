import { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { getBallColor } from '../lib/lotto';

export default function GuideModal({ type, onClose }) {
  // 모달 열려있는 동안 배경(body) 스크롤 잠금
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <Backdrop onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ScrollArea>
          <CloseBtn onClick={onClose}>✕</CloseBtn>
          {type === 'ranks' && <RanksGuide />}
          {type === 'balls' && <BallsGuide />}
          {type === 'odd' && <OddGuide />}
          {type === 'sum' && <SumGuide />}
        </ScrollArea>
        <Footer>
          <FinishBtn onClick={onClose}>확인했어요</FinishBtn>
        </Footer>
      </Modal>
    </Backdrop>
  );
}

/* ───── 1. 역대 등수 출현 횟수 ───── */
function RanksGuide() {
  return (
    <Body>
      <Title>역대 등수 출현 횟수란?</Title>
      <P>
        800만 개의 모든 6개 숫자 조합을 <Em>역대 1,223회차</Em>의 당첨번호와
        하나하나 비교해서, 그 조합이 1~5등에 몇 번 해당했는지 미리 계산해둔 값입니다.
      </P>

      <ExampleBox>
        <ExLabel>예시 — 1223회차 당첨조합</ExLabel>
        <BallRow>
          {[16, 18, 20, 32, 33, 39].map((n) => (
            <Ball key={n} $color={getBallColor(n)}>
              {n}
            </Ball>
          ))}
        </BallRow>
        <StatList>
          <li>1등 출현 <b>1번</b> (자기 자신 매칭)</li>
          <li>2등 출현 <b>0번</b></li>
          <li>3등 출현 <b>0번</b></li>
          <li>4등 출현 <b>3번</b> — 역대 3개 회차에서 4개 일치</li>
          <li>5등 출현 <b>21번</b> — 역대 21개 회차에서 3개 일치</li>
        </StatList>
      </ExampleBox>

      <Section>
        <SectionTitle>📊 1,223회차 통계의 핵심</SectionTitle>
        <Bullets>
          <li>
            <b>1등</b>: 같은 6개 조합이 두 번 나온 적{' '}
            <Em>한 번도 없음</Em>
          </li>
          <li>
            <b>2등</b>: 5개+보너스 패턴도 중복된 적{' '}
            <Em>한 번도 없음</Em>
          </li>
          <li>
            <b>3등</b>: 중복된 경우가 거의 없음 (대부분 0~1번)
          </li>
          <li>
            <b>4등</b>: 대부분 <Em>0~3번</Em> 사이 (평균 1.7)
          </li>
          <li>
            <b>5등</b>: 대부분 <Em>20~30번</Em> 사이 (평균 27)
          </li>
        </Bullets>
      </Section>

      <Section>
        <SectionTitle>🎯 추천 필터값</SectionTitle>
        <ExampleBox>
          <Bullets>
            <li>1등: <b>0 ~ 0</b> (역대 1등 조합 1,223개 제거)</li>
            <li>2등: <b>0 ~ 0</b> (역대 2등 패턴 약 7천 개 제거)</li>
            <li>3등: <b>0 ~ 0</b> (역대 3등 패턴 약 27만 개 제거)</li>
            <li>4등: <b>0 ~ 3</b></li>
            <li>5등: <b>20 ~ 30</b></li>
          </Bullets>
        </ExampleBox>
        <P>
          이렇게만 걸어도 <Em>800만 → 약 400만</Em>으로 절반 가까이 압축돼요.
          여기에 번호 선택, 홀짝, 합계 필터를 같이 쓰면 수만 수준까지 빠르게
          좁아집니다.
        </P>
      </Section>

      <Section>
        <SectionTitle>⌨ 입력 방법</SectionTitle>
        <Bullets>
          <li><b>빈칸</b> = 무제한 (이 등수는 신경 안 씀)</li>
          <li><b>한 칸만 입력</b> = 정확히 그 값</li>
          <li><b>둘 다 입력</b> = 그 범위 안</li>
        </Bullets>
      </Section>
    </Body>
  );
}

/* ───── 2. 번호 선택 (제외 / 필수) ───── */
function BallsGuide() {
  return (
    <Body>
      <Title>번호 선택 가이드</Title>
      <P>번호공을 스와이프하거나 탭해서 상태를 바꿉니다.</P>

      <ExampleBox>
        <DemoRow>
          <Ball $color={getBallColor(7)}>7</Ball>
          <Arrow>← 왼쪽 스와이프</Arrow>
          <Ball $color="#555" $faded>✕</Ball>
        </DemoRow>
        <DemoCaption>
          <b>제외</b> — 이 번호가 포함된 조합은 모두 빠집니다
        </DemoCaption>

        <DemoRow>
          <Ball $color={getBallColor(7)}>7</Ball>
          <Arrow>→ 오른쪽 스와이프</Arrow>
          <Ball $color="#22c55e">✓</Ball>
        </DemoRow>
        <DemoCaption>
          <b>필수</b> — 이 번호가 포함된 조합만 남깁니다
        </DemoCaption>

        <DemoRow>
          <Ball $color={getBallColor(7)}>7</Ball>
          <Arrow>탭 / 클릭</Arrow>
          <Ball $color={getBallColor(7)}>7</Ball>
        </DemoRow>
        <DemoCaption>
          <b>초기화</b> — 원래 상태로
        </DemoCaption>
      </ExampleBox>

      <Section>
        <SectionTitle>📊 필수 번호의 위력</SectionTitle>
        <Bullets>
          <li>필수 <b>1개</b>: 800만 → 약 <b>110만</b> (87% 축소)</li>
          <li>필수 <b>2개</b>: → 약 <b>12만</b> (98.5% 축소)</li>
          <li>필수 <b>3개</b>: → 약 <b>1.1만</b> (99.86% 축소)</li>
        </Bullets>
      </Section>

      <Section>
        <SectionTitle>🎯 활용법</SectionTitle>
        <P>
          좋아하는 숫자나 생일 숫자를 <Em>필수</Em>로 넣고, 싫어하는 번호나
          최근 너무 자주 나온 번호를 <Em>제외</Em>만 해도 경우의 수가
          확확 줄어듭니다.
        </P>
      </Section>
    </Body>
  );
}

/* ───── 3. 홀짝 비율 ───── */
function OddGuide() {
  const ratios = [
    { o: 0, e: 6, pct: 0.92, example: [2, 4, 6, 8, 10, 12], rare: true },
    { o: 1, e: 5, pct: 7.44, example: [1, 4, 6, 8, 10, 12] },
    { o: 2, e: 4, pct: 22.72, example: [1, 3, 6, 8, 10, 12], common: true },
    { o: 3, e: 3, pct: 33.49, example: [1, 3, 5, 8, 10, 12], common: true },
    { o: 4, e: 2, pct: 25.11, example: [1, 3, 5, 7, 10, 12], common: true },
    { o: 5, e: 1, pct: 9.09, example: [1, 3, 5, 7, 9, 12] },
    { o: 6, e: 0, pct: 1.24, example: [1, 3, 5, 7, 9, 11], rare: true },
  ];
  return (
    <Body>
      <Title>홀짝 비율 가이드</Title>
      <P>
        6개 숫자 중 홀수가 몇 개인지로 가릅니다. 역대 1등 조합 80% 이상이
        <Em> 홀 2~4개</Em> 사이에 있어요.
      </P>

      <RatioBox>
        {ratios.map(({ o, e, pct, example, common, rare }) => (
          <RatioRow key={`${o}-${e}`} $common={common} $rare={rare}>
            <RatioLabel>홀 {o} : 짝 {e}</RatioLabel>
            <BallRow>
              {example.map((n) => (
                <Ball key={n} $color={getBallColor(n)} $small>
                  {n}
                </Ball>
              ))}
            </BallRow>
            <RatioPct>{pct}%</RatioPct>
          </RatioRow>
        ))}
      </RatioBox>

      <Section>
        <SectionTitle>📊 한눈에 보기</SectionTitle>
        <Bullets>
          <li><b>2:4, 3:3, 4:2</b> 합쳐서 → 약 <b>81%</b> (대부분 1등 조합이 여기)</li>
          <li>극단(0:6, 6:0)은 <b>2.2%</b>밖에 안 됨</li>
        </Bullets>
      </Section>

      <Section>
        <SectionTitle>🎯 활용법</SectionTitle>
        <P>
          홀수가 한쪽으로 치우친 조합(전부 홀수, 전부 짝수)은 1등 조합에 거의
          없어요. 홀 2~4개만 남겨도 풀이 <Em>약 19% 줄어듭니다</Em>. 다른
          필터와 곱해서 효과를 키울 수 있어요.
        </P>
      </Section>
    </Body>
  );
}

/* ───── 4. 번호 총합 범위 ───── */
function SumGuide() {
  return (
    <Body>
      <Title>번호 총합 범위 가이드</Title>
      <P>
        6개 숫자를 그냥 더한 값이에요. 역대 1등 조합 평균은 <Em>약 138</Em>이고
        대부분 100~170 사이에 몰려 있습니다.
      </P>

      <ExampleBox>
        <DemoRow>
          <BallRow>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Ball key={n} $color={getBallColor(n)} $small>{n}</Ball>
            ))}
          </BallRow>
          <SumNote>합계 <b>21</b> · 최솟값 — 거의 없음</SumNote>
        </DemoRow>
        <DemoRow>
          <BallRow>
            {[10, 18, 22, 28, 32, 38].map((n) => (
              <Ball key={n} $color={getBallColor(n)} $small>{n}</Ball>
            ))}
          </BallRow>
          <SumNote>합계 <b>148</b> · 평균 근처 — 가장 흔함</SumNote>
        </DemoRow>
        <DemoRow>
          <BallRow>
            {[40, 41, 42, 43, 44, 45].map((n) => (
              <Ball key={n} $color={getBallColor(n)} $small>{n}</Ball>
            ))}
          </BallRow>
          <SumNote>합계 <b>255</b> · 최댓값 — 거의 없음</SumNote>
        </DemoRow>
      </ExampleBox>

      <Section>
        <SectionTitle>📊 역대 1등 조합 합계 분포</SectionTitle>
        <Bullets>
          <li>합계 <b>100~170</b>: 약 <b>66%</b></li>
          <li>합계 <b>80~190</b>: 약 <b>92%</b></li>
          <li>합계 <b>60~210</b>: 약 <b>99%</b></li>
        </Bullets>
      </Section>

      <Section>
        <SectionTitle>🎯 활용법</SectionTitle>
        <P>
          극단적인 합계(50 이하 / 200 이상)는 1등 조합에 거의 없어요. 100~170
          정도로 좁히면 풀이 <Em>약 1/3로 줄어듭니다</Em>. 홀짝 필터와 같이
          쓰면 효과가 곱셈으로 누적돼요.
        </P>
      </Section>
    </Body>
  );
}

/* ───── styled ───── */
const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const popUp = keyframes`
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: ${fadeIn} 0.2s ease;
`;
const Modal = styled.div`
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 16px;
  box-shadow: ${(p) => p.theme.shadow};
  animation: ${popUp} 0.22s ease;
`;
const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;
const Footer = styled.div`
  padding: 12px 22px 16px;
  border-top: 1px solid ${(p) => p.theme.border};
  flex-shrink: 0;
`;
const FinishBtn = styled.button`
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: ${(p) => p.theme.accent};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover {
    background: ${(p) => p.theme.accentHover};
  }
`;
const CloseBtn = styled.button`
  position: sticky;
  top: 12px;
  margin-left: calc(100% - 44px);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.textMuted};
  font-size: 14px;
  z-index: 2;
  &:hover {
    background: ${(p) => p.theme.bgHover};
    color: ${(p) => p.theme.text};
  }
`;
const Body = styled.div`
  padding: 0 22px 24px;
  margin-top: -12px;
`;
const Title = styled.h3`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 10px;
`;
const P = styled.p`
  font-size: 14px;
  line-height: 1.7;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 14px;
`;
const Em = styled.span`
  color: ${(p) => p.theme.text};
  font-weight: 700;
`;
const ExampleBox = styled.div`
  background: ${(p) => p.theme.bgInput};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 18px;
`;
const ExLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 10px;
`;
const BallRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
`;
const Ball = styled.span`
  width: ${(p) => (p.$small ? 26 : 32)}px;
  height: ${(p) => (p.$small ? 26 : 32)}px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  font-weight: 700;
  font-size: ${(p) => (p.$small ? 11 : 13)}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$faded ? 0.55 : 1)};
  flex-shrink: 0;
`;
const StatList = styled.ul`
  margin-top: 12px;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.85;
  color: ${(p) => p.theme.textMuted};
  b {
    color: ${(p) => p.theme.text};
  }
`;
const Section = styled.div`
  margin-bottom: 18px;
`;
const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
`;
const Bullets = styled.ul`
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: ${(p) => p.theme.textMuted};
  b {
    color: ${(p) => p.theme.text};
  }
`;
const DemoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
`;
const Arrow = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  flex: 1;
  text-align: center;
`;
const DemoCaption = styled.p`
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  margin: 4px 0 12px 0;
  b {
    color: ${(p) => p.theme.text};
  }
`;
const RatioBox = styled.div`
  background: ${(p) => p.theme.bgInput};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 18px;
`;
const RatioRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px;
  border-radius: 8px;
  background: ${(p) =>
    p.$common ? p.theme.accentSoft : 'transparent'};
  opacity: ${(p) => (p.$rare ? 0.55 : 1)};
`;
const RatioLabel = styled.span`
  font-size: 12px;
  font-weight: 700;
  width: 70px;
  flex-shrink: 0;
  color: ${(p) => p.theme.text};
`;
const RatioPct = styled.span`
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  color: ${(p) => p.theme.text};
`;
const SumNote = styled.div`
  flex: 1;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  margin-left: 8px;
  b {
    color: ${(p) => p.theme.text};
    font-size: 14px;
  }
`;
