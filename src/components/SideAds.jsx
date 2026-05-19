import { useEffect, useRef } from 'react';
import styled from 'styled-components';

const LEFT_AD_ID = 'DAN-UHt2zZPtBbBQtADK';
const RIGHT_AD_ID = 'DAN-h249ZEkAq8EKbqK8';
const AD_WIDTH = 160;
const AD_HEIGHT = 600;

function SideAdSlot({ adUnitId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', adUnitId);
    ins.setAttribute('data-ad-width', String(AD_WIDTH));
    ins.setAttribute('data-ad-height', String(AD_HEIGHT));

    const script = document.createElement('script');
    script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [adUnitId]);

  return <Slot ref={containerRef} />;
}

export default function SideAds() {
  return (
    <>
      <LeftWrap>
        <SideAdSlot adUnitId={LEFT_AD_ID} />
      </LeftWrap>
      <RightWrap>
        <SideAdSlot adUnitId={RIGHT_AD_ID} />
      </RightWrap>
    </>
  );
}

// 콘텐츠 920px + 양옆 광고 160px + 여백 20px씩 = 약 1300px 필요
// 1280px 미만에서는 숨김 (모바일/태블릿)
const SideBase = `
  position: fixed;
  top: 80px;
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
  z-index: 30;
  @media (max-width: 1279px) {
    display: none;
  }
`;

const LeftWrap = styled.div`
  ${SideBase}
  left: calc(50% - 460px - 20px - ${AD_WIDTH}px);
`;

const RightWrap = styled.div`
  ${SideBase}
  right: calc(50% - 460px - 20px - ${AD_WIDTH}px);
`;

const Slot = styled.div`
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
`;
