import { useEffect, useRef } from 'react';
import styled from 'styled-components';

const AD_UNIT_ID = 'DAN-HwGGOc8XiVMKgJJX';
const AD_WIDTH = 300;
const AD_HEIGHT = 250;

export default function AdBanner() {
  const containerRef = useRef(null);

  useEffect(() => {
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
  }, []);

  return (
    <Wrap>
      <Inner>
        <Slot ref={containerRef} />
      </Inner>
    </Wrap>
  );
}

const Wrap = styled.div`
  margin: 32px 0 0;
`;

const Inner = styled.div`
  max-width: 920px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: center;
  @media (max-width: 480px) {
    padding: 0 12px;
  }
`;

const Slot = styled.div`
  width: ${AD_WIDTH}px;
  height: ${AD_HEIGHT}px;
  max-width: 100%;
`;
