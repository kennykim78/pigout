import { Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import './MainLayout.scss';

const MainLayout = () => {
  return (
    <div className="main-layout">
      <div className="main-layout__content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
