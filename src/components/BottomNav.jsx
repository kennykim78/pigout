import { NavLink } from 'react-router-dom';
import './BottomNav.scss';

const BottomNav = () => {
  const navItems = [
    { path: '/main', label: 'Home', icon: '🏠' },
    { path: '/medicine', label: '약', icon: '💊' },
    { path: '/status', label: '내 상태', icon: '📊' },
    { path: '/recommendation', label: '내 추천', icon: '🎁' },
    { path: '/mypage', label: 'My', icon: '👤' },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
          }
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
