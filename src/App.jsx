import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Lab from './pages/Lab';
import History from './pages/History';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/history" element={<History />} />
        {/* 숨김 관리자 경로 (URL 모르면 못 찾음 + 3중 비밀번호) */}
        <Route path="/rhksflwkdlqslekaks" element={<Admin />} />
      </Route>
    </Routes>
  );
}
