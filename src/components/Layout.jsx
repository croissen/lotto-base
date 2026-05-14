import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Header from './Header';
import FloatingButtons from './FloatingButtons';

export default function Layout() {
  return (
    <Shell>
      <Header />
      <Main>
        <Outlet />
      </Main>
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
