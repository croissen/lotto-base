import { useEffect, useRef } from 'react';
import styled from 'styled-components';

export default function AdBanner({ adUnitId, width, height }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', adUnitId);
    ins.setAttribute('data-ad-width', String(width));
    ins.setAttribute('data-ad-height', String(height));

    const script = document.createElement('script');
    script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [adUnitId, width, height]);

  return (
    <Wrap>
      <Inner>
        <Slot ref={containerRef} $w={width} $h={height} />
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
  width: ${(p) => p.$w}px;
  height: ${(p) => p.$h}px;
  max-width: 100%;
`;
