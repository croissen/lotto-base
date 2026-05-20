import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Header from './Header';
import Footer from './Footer';
import SideAds from './SideAds';
import FloatingButtons from './FloatingButtons';
import { recordVisit } from '../lib/visits';
import { useLatestRound } from '../lib/useLatestRound';

export default function Layout() {
  const { pathname } = useLocation();
  const latestRound = useLatestRound();

  // 페이지 첫 로드 시 1회 방문 기록. 라우트 변경은 카운트 안 함.
  // 관리자 경로(rhksflwkdlqslekaks)는 제외 — 운영자 본인 방문이라 통계 왜곡 방지.
  useEffect(() => {
    if (!pathname.startsWith('/rhksflwkdlqslekaks')) {
      recordVisit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 최신 회차가 로드되면 문서 제목/설명을 실제 회차로 갱신.
  // 정적 index.html은 "역대 전 회차"로 안 낡게 두고, 런타임에 숫자 주입.
  useEffect(() => {
    if (!latestRound) return;
    const r = latestRound.toLocaleString();

    document.title = `로또베이스 LottoBase — ${r}회차까지 분석한 로또 번호 생성기`;

    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        'content',
        `역대 ${r}회차 통계를 분석해 8,145,060개 경우의 수를 99%까지 좁히는 무료 로또 번호 생성기. 등수 출현 횟수, 홀짝 비율, 합계 범위, 제외/필수 번호로 정밀 필터링.`
      );
    }
  }, [latestRound]);

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
