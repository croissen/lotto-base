import styled, { keyframes } from 'styled-components';
import { grantPass } from '../lib/pass';

// TODO: 회차님 쿠팡 파트너스 추적 링크로 교체하세요.
const COUPANG_LINK = 'https://link.coupang.com/a/dLez7SinRc';
const PASS_HOURS = 1;

export default function AdGateModal({ onClose, onPass }) {
  const handleVisit = () => {
    window.open(COUPANG_LINK, '_blank', 'noopener');
    grantPass(PASS_HOURS);
    onPass();
  };

  return (
    <Backdrop onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <CloseBtn onClick={onClose}>✕</CloseBtn>

        <Title>당신도 로또 전문가!</Title>
        <Sub>
          쿠팡을 한 번 방문하면 <b>{PASS_HOURS}시간 동안</b> 분석 기능을
          무제한으로 사용할 수 있어요.
        </Sub>

        <OfferCard>
          <OfferIcon>🛒</OfferIcon>
          <OfferText>
            <OfferName>쿠팡 방문하기</OfferName>
            <OfferDesc>파트너스 활동으로 수수료를 받아요</OfferDesc>
          </OfferText>
        </OfferCard>

        <VisitBtn onClick={handleVisit}>1시간 이용권 받기 →</VisitBtn>

        <FinePrint>
          
        </FinePrint>
      </Modal>
    </Backdrop>
  );
}

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
  max-width: 380px;
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 20px;
  padding: 32px 24px 24px;
  box-shadow: ${(p) => p.theme.shadow};
  text-align: center;
  animation: ${popUp} 0.22s ease;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${(p) => p.theme.textMuted};
  font-size: 15px;
  &:hover {
    background: ${(p) => p.theme.bgHover};
    color: ${(p) => p.theme.text};
  }
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
`;

const Sub = styled.p`
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: ${(p) => p.theme.textMuted};
  b {
    color: ${(p) => p.theme.accent};
  }
`;

const OfferCard = styled.div`
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  background: ${(p) => p.theme.bgInput};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 14px;
  padding: 16px;
`;

const OfferIcon = styled.div`
  font-size: 32px;
  flex-shrink: 0;
`;

const OfferText = styled.div``;

const OfferName = styled.div`
  font-size: 15px;
  font-weight: 700;
`;

const OfferDesc = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
`;

const VisitBtn = styled.button`
  width: 100%;
  margin-top: 16px;
  padding: 15px;
  border-radius: 12px;
  border: none;
  background: ${(p) => p.theme.accent};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 8px 24px ${(p) => p.theme.accent}33;
  &:hover {
    background: ${(p) => p.theme.accentHover};
  }
`;

const FinePrint = styled.p`
  margin-top: 14px;
  font-size: 11px;
  color: ${(p) => p.theme.textMuted};
  line-height: 1.5;
`;
