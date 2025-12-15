import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IntroSplash from './pages/IntroSplash';
import SelectOption from './pages/SelectOption';
import Main from './pages/Main';
import Medicine from './pages/Medicine';
import MedicineAdd from './pages/MedicineAdd';
import History from './pages/History';
import Reward from './pages/Reward';
import MyPage from './pages/MyPage';
import Result01 from './pages/Result01';
import Result2 from './pages/Result2';
import Settings from './pages/Settings';
import Contact from './pages/Contact';
import MainLayout from './layout/MainLayout';
import './App.scss';

function App() {
  return (
    <Router>
      <Routes>
        {/* 온보딩 페이지 (네비게이션 바 없음) */}
        <Route path="/" element={<IntroSplash />} />
        <Route path="/select" element={<SelectOption />} />
        <Route path="/selectoption" element={<SelectOption />} />

        {/* 메인 앱 (하단 네비게이션 바 포함) */}
        <Route element={<MainLayout />}>
          <Route path="/main" element={<Main />} />
          <Route path="/medicine" element={<Medicine />} />
          <Route path="/history" element={<History />} />
          <Route path="/reward" element={<Reward />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>

        {/* 내약 추가 페이지 (네비게이션 바 없음) */}
        <Route path="/medicine/add" element={<MedicineAdd />} />

        {/* 결과 페이지 (네비게이션 바 없음) */}
        <Route path="/result01" element={<Result01 />} />
        <Route path="/result2" element={<Result2 />} />
        
        {/* 설정 페이지 */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </Router>
  );
}

export default App;
