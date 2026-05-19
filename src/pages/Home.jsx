import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Hero>
      <Badge>데이터 기반 로또 번호 분석 도구</Badge>

      <Headline>
        아직도 <Strike>돈 주고</Strike>
        <br />
        행운번호 뽑으시나요?
      </Headline>

      <Sub>행운번호가 나오는 원리는 알고 뽑으셔야죠.</Sub>

      <Body>
        로또베이스는 역대 당첨 데이터를 직접 분석해
        <br />
        <Em>8,145,060개</Em>의 경우의 수를 <Em>99%까지</Em> 제거합니다.
      </Body>

      <CtaBtn onClick={() => navigate('/lab')}>시작하기 →</CtaBtn>

      <Chips>
        <Chip>✓ 회원가입 없음</Chip>
        <Chip>✓ 결제 없음</Chip>
        <Chip>✓ 바로 분석</Chip>
      </Chips>

      <Disclaimer>
       
      </Disclaimer>
    </Hero>
  );
}

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Hero = styled.section`
  text-align: center;
  padding: 80px 0 100px;
  animation: ${fadeUp} 0.5s ease;
  @media (max-width: 640px) {
    padding: 48px 0 64px;
  }
`;

const Badge = styled.div`
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => p.theme.accent};
  background: ${(p) => p.theme.accentSoft};
  border: 1px solid ${(p) => p.theme.accent}33;
  margin-bottom: 28px;
`;

const Headline = styled.h1`
  font-size: 52px;
  line-height: 1.18;
  font-weight: 800;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
  @media (max-width: 640px) {
    font-size: 34px;
    letter-spacing: -1px;
  }
`;

const Strike = styled.span`
  position: relative;
  color: ${(p) => p.theme.textMuted};
  &::after {
    content: '';
    position: absolute;
    left: -2px;
    right: -2px;
    top: 52%;
    height: 4px;
    background: ${(p) => p.theme.danger};
    transform: rotate(-3deg);
  }
`;

const Sub = styled.p`
  font-size: 20px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-bottom: 24px;
  @media (max-width: 640px) {
    font-size: 17px;
  }
`;

const Body = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: ${(p) => p.theme.textMuted};
  margin-bottom: 36px;
`;

const Em = styled.span`
  color: ${(p) => p.theme.accent};
  font-weight: 700;
`;

const CtaBtn = styled.button`
  background: ${(p) => p.theme.accent};
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 16px 40px;
  font-size: 17px;
  font-weight: 700;
  box-shadow: 0 8px 24px ${(p) => p.theme.accent}44;
  transition: transform 0.12s ease, background 0.12s ease;
  &:hover {
    background: ${(p) => p.theme.accentHover};
    transform: translateY(-2px);
  }
`;

const Chips = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 32px;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  font-size: 13px;
  color: black;
  background: white;
  border: 1px solid ${(p) => p.theme.border};
  padding: 7px 14px;
  border-radius: 999px;
`;

const Disclaimer = styled.p`
  margin-top: 48px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  opacity: 0.7;
`;
