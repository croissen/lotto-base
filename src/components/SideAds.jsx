import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useMediaQuery } from '../lib/useMediaQuery';

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

// 카카오 애드핏 정책: 페이지당 광고 단위 최대 4개.
// 사이드 광고를 CSS만으로 숨기면 ins 태그가 DOM에 남아 카운트되므로
// useMediaQuery로 조건부 렌더링하여 작은 화면에선 DOM 자체에서 제외.
export default function SideAds() {
  const { pathname } = useLocation();
  const isHistory = pathname === '/history';

  // 일반 페이지: 920px 콘텐츠 + 양옆 광고 → viewport 1280px 필요
  // 히스토리: 1280px 테이블 + 양옆 광고 → viewport 1640px 필요
  const wideEnoughNormal = useMediaQuery('(min-width: 1280px)');
  const wideEnoughHistory = useMediaQuery('(min-width: 1640px)');
  const shouldShow = isHistory ? wideEnoughHistory : wideEnoughNormal;

  if (!shouldShow) return null;

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
  left: calc(50% - 460px - 20px - ${AD_WIDTH}px);
  ${(p) =>
    p.$isHistory &&
    `left: calc(50% - 640px - 20px - ${AD_WIDTH}px);`}
`;

const RightWrap = styled.div`
  position: fixed;
  top: 80px;
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
  z-index: 30;
  right: calc(50% - 460px - 20px - ${AD_WIDTH}px);
  ${(p) =>
    p.$isHistory &&
    `right: calc(50% - 640px - 20px - ${AD_WIDTH}px);`}
`;

const Slot = styled.div`
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
`;
