import { Outlet, useNavigate } from "react-router-dom";
import "./SharedLayout.scss";

const SharedLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="shared-layout">
      <div className="shared-layout__content">
        <Outlet />
      </div>
      <div className="shared-layout__banner">
        <div className="banner-text">
          <p className="main-text">내 수명은 얼마나 남았을까?</p>
          <p className="sub-text">지금 바로 확인해보세요!</p>
        </div>
        <button className="download-btn" onClick={() => navigate("/")}>
          나도 분석하기
        </button>
      </div>
    </div>
  );
};

export default SharedLayout;
