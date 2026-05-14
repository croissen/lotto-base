import { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as SCThemeProvider } from 'styled-components';
import { darkTheme, lightTheme } from './themes';

const ThemeToggleContext = createContext(null);

export function useThemeToggle() {
  return useContext(ThemeToggleContext);
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(
    () => localStorage.getItem('lottobase-theme') || 'dark' // 기본 다크
  );

  useEffect(() => {
    localStorage.setItem('lottobase-theme', mode);
    document.body.style.background = mode === 'dark' ? '#0c0c0e' : '#fafafa';
    document.body.style.color = mode === 'dark' ? '#ededf0' : '#16161a';
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  const theme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeToggleContext.Provider value={{ mode, toggle }}>
      <SCThemeProvider theme={theme}>{children}</SCThemeProvider>
    </ThemeToggleContext.Provider>
  );
}
