import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Header from './Header';
import Footer from './Footer';
import SideAds from './SideAds';
import FloatingButtons from './FloatingButtons';
import { recordVisit } from '../lib/visits';

export default function Layout() {
  const { pathname } = useLocation();

  // 페이지 첫 로드 시 1회 방문 기록. 라우트 변경은 카운트 안 함.
  // 관리자 경로(rhksflwkdlqslekaks)는 제외 — 운영자 본인 방문이라 통계 왜곡 방지.
  useEffect(() => {
    if (!pathname.startsWith('/rhksflwkdlqslekaks')) {
      recordVisit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell>
      <Header />
      <Main>
        <Outlet />
      </Main>
      <Footer />
      <SideAds />
      <FloatingButtons />
    </Shell>
  );
}

const Shell = styled.div`
  min-height: 100vh;
  background: ${(p) => p.theme.bg};
  color: ${(p) => p.theme.text};
`;

const Main = styled.main`
  max-width: 920px;
  margin: 0 auto;
  padding: 0 20px;
`;
