import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useThemeToggle } from '../theme/ThemeContext';

export default function Header() {
  const { mode, toggle } = useThemeToggle();
  const { pathname } = useLocation();

  return (
    <Bar>
      <Inner>
        <Logo to="/">
          Lotto<b>Base</b>
        </Logo>
        <Nav>
          <NavLink to="/lab" $active={pathname === '/lab'}>
            연구실
          </NavLink>
          <NavLink to="/history" $active={pathname === '/history'}>
            당첨 히스토리
          </NavLink>
          <ToggleBtn onClick={toggle} title="테마 전환">
            {mode === 'dark' ? '☀️' : '🌙'}
          </ToggleBtn>
        </Nav>
      </Inner>
    </Bar>
  );
}

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  background: ${(p) => p.theme.bg}cc;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid ${(p) => p.theme.border};
`;

const Inner = styled.div`
  max-width: 920px;
  margin: 0 auto;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @media (max-width: 480px) {
    padding: 0 12px;
  }
`;

const Logo = styled(Link)`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: ${(p) => p.theme.text};
  text-decoration: none;
  b {
    color: ${(p) => p.theme.accent};
  }
  @media (max-width: 480px) {
    font-size: 17px;
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  @media (max-width: 480px) {
    gap: 2px;
  }
`;

const NavLink = styled(Link)`
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  color: ${(p) => (p.$active ? p.theme.accent : p.theme.textMuted)};
  background: ${(p) => (p.$active ? p.theme.accentSoft : 'transparent')};
  &:hover {
    color: ${(p) => p.theme.text};
  }
  @media (max-width: 480px) {
    padding: 6px 8px;
    font-size: 12px;
  }
`;

const ToggleBtn = styled.button`
  margin-left: 4px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.bgInput};
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: ${(p) => p.theme.bgHover};
  }
  @media (max-width: 480px) {
    width: 30px;
    height: 30px;
    font-size: 14px;
    margin-left: 2px;
  }
`;
