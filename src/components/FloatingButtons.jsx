import { useState, useEffect } from 'react';
import styled from 'styled-components';

export default function FloatingButtons() {
  const [showMenu, setShowMenu] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 클립보드 접근 불가 */
    }
    setShowMenu(false);
  };

  const nativeShare = async () => {
    setShowMenu(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LottoBase — 데이터 기반 로또 번호 분석',
          text: '역대 통계로 경우의 수를 줄여보세요',
          url: window.location.href,
        });
      } catch {
        /* 사용자가 공유 취소 */
      }
    } else {
      // 데스크탑 등 Web Share 미지원 → 링크 복사로 대체
      copyLink();
    }
  };

  return (
    <Stack>
      {copied && <Toast>링크가 복사되었습니다</Toast>}

      {showMenu && (
        <Menu>
          <MenuItem onClick={copyLink}>🔗 링크 복사</MenuItem>
          <MenuItem onClick={nativeShare}>📤 공유하기</MenuItem>
        </Menu>
      )}

      <Fab onClick={() => setShowMenu((v) => !v)} title="공유하기">
        📤
      </Fab>

      {showTop && (
        <Fab onClick={scrollToTop} title="맨 위로">
          ↑
        </Fab>
      )}
    </Stack>
  );
}

const Stack = styled.div`
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
`;

const Fab = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgElevated};
  color: ${(p) => p.theme.text};
  font-size: 18px;
  box-shadow: ${(p) => p.theme.shadow};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease;
  &:hover {
    background: ${(p) => p.theme.bgHover};
    transform: translateY(-2px);
  }
`;

const Menu = styled.div`
  background: ${(p) => p.theme.bgElevated};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 12px;
  padding: 6px;
  box-shadow: ${(p) => p.theme.shadow};
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
`;

const MenuItem = styled.button`
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${(p) => p.theme.text};
  font-size: 14px;
  font-weight: 500;
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
`;

const Toast = styled.div`
  background: ${(p) => p.theme.text};
  color: ${(p) => p.theme.bg};
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: ${(p) => p.theme.shadow};
`;
