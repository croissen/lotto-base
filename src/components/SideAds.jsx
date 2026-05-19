import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();
  // 히스토리 페이지는 테이블이 최대 1280px까지 확장됨 (History.jsx의 TableWrap 참고)
  // 일반 페이지(콘텐츠 920px) 대비 광고를 더 바깥쪽으로 배치해야 가려지지 않음
  const isHistory = pathname === '/history';

  return (
    <>
      <LeftWrap $isHistory={isHistory}>
        <SideAdSlot adUnitId={LEFT_AD_ID} />
      </LeftWrap>
      <RightWrap $isHistory={isHistory}>
        <SideAdSlot adUnitId={RIGHT_AD_ID} />
      </RightWrap>
    </>
  );
}

const LeftWrap = styled.div`
  position: fixed;
  top: 80px;
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
  z-index: 30;
  /* 일반: 콘텐츠 920px 영역 바깥 (50% - 460px - 20px - 160px) */
  left: calc(50% - 460px - 20px - ${AD_WIDTH}px);
  @media (max-width: 1279px) {
    display: none;
  }
  ${(p) =>
    p.$isHistory &&
    `
    /* 히스토리: 테이블 1280px 영역 바깥 (50% - 640px - 20px - 160px) */
    left: calc(50% - 640px - 20px - ${AD_WIDTH}px);
    @media (max-width: 1639px) {
      display: none;
    }
  `}
`;

const RightWrap = styled.div`
  position: fixed;
  top: 80px;
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
  z-index: 30;
  right: calc(50% - 460px - 20px - ${AD_WIDTH}px);
  @media (max-width: 1279px) {
    display: none;
  }
  ${(p) =>
    p.$isHistory &&
    `
    right: calc(50% - 640px - 20px - ${AD_WIDTH}px);
    @media (max-width: 1639px) {
      display: none;
    }
  `}
`;

const Slot = styled.div`
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
`;
