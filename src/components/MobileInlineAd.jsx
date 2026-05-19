import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from '../lib/useMediaQuery';

const AD_UNIT_ID = 'DAN-svCCbMb3TKvcHDJd';
const AD_WIDTH = 320;
const AD_HEIGHT = 100;

export default function MobileInlineAd() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', AD_UNIT_ID);
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
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <Wrap>
      <Slot ref={containerRef} />
    </Wrap>
  );
}

const Wrap = styled.div`
  display: flex;
  justify-content: center;
  margin: 16px 0;
`;

const Slot = styled.div`
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
`;
