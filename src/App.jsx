import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import IntroSplash from "./pages/IntroSplash";
import ProfileSetup from "./pages/ProfileSetup";
import SelectOption from "./pages/SelectOption";
import Main from "./pages/Main";
import Medicine from "./pages/Medicine";
import MedicineAdd from "./pages/MedicineAdd";
import MedicineAnalysis from "./pages/MedicineAnalysis";
import MyStatus from "./pages/MyStatus";
import MyRecommendation from "./pages/MyRecommendation";
import MyPage from "./pages/MyPage";
import Result01 from "./pages/Result01";
import Result2 from "./pages/Result2";
import MainLayout from "./layout/MainLayout";
import "./App.scss";

function App() {
  return (
    <Router>
      <Routes>
        {/* 온보딩 페이지 (네비게이션 바 없음) */}
        <Route path="/" element={<IntroSplash />} />
        <Route path="/profile" element={<ProfileSetup />} />
        <Route path="/select" element={<SelectOption />} />
        <Route path="/selectoption" element={<SelectOption />} />

        {/* 메인 앱 (하단 네비게이션 바 포함) */}
        <Route element={<MainLayout />}>
          <Route path="/main" element={<Main />} />
          <Route path="/medicine" element={<Medicine />} />
          <Route path="/status" element={<MyStatus />} />
          <Route path="/recommendation" element={<MyRecommendation />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>

        {/* 내약 추가 페이지 (네비게이션 바 없음) */}
        <Route path="/medicine/add" element={<MedicineAdd />} />

        {/* 🆕 약물 상호작용 분석 결과 페이지 (네비게이션 바 없음) */}
        <Route path="/medicine/analysis" element={<MedicineAnalysis />} />

        {/* 결과 페이지 (네비게이션 바 없음) */}
        <Route path="/result01" element={<Result01 />} />
        <Route path="/result2" element={<Result2 />} />
      </Routes>
    </Router>
  );
}

export default App;
