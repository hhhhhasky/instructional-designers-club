import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import routes from "../../routes";

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigation = routes.filter((route) => route.visible !== false);

  // 关闭菜单当路由改变时
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // 防止菜单打开时页面滚动
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  return (
    <header className="bg-card border-b-2 border-border sticky top-0 z-50 backdrop-blur-sm bg-card/95">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20 md:justify-center">
          {/* Logo和网站名称 */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center group">
              {/* Logo */}
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <span className="text-xl md:text-2xl font-black text-primary-foreground">教</span>
              </div>
              {/* 网站名称 */}
              <span className="ml-2 md:ml-3 text-base md:text-xl font-black text-foreground group-hover:text-primary transition-colors duration-300">
                教学设计师俱乐部
              </span>
            </Link>
          </div>

          {/* 桌面端导航 */}
          <div className="hidden md:flex items-center space-x-2 ml-6 lg:ml-8">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 md:px-6 py-2 md:py-2.5 text-sm md:text-base font-semibold rounded-full transition-all duration-300 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* 移动端汉堡菜单按钮 */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-all duration-300"
              aria-label="打开菜单"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* 移动端全屏菜单 */}
      <div
        className={`md:hidden fixed inset-0 top-16 bg-background z-40 transition-all duration-300 ease-in-out ${
          isMenuOpen
            ? 'opacity-100 visible'
            : 'opacity-0 invisible'
        }`}
      >
        <nav className="h-full overflow-y-auto">
          <div className="px-4 pt-4 pb-6 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-6 py-4 text-lg font-semibold rounded-xl transition-all duration-300 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-foreground hover:bg-muted active:bg-muted/80"
                }`}
                style={{ minHeight: '56px' }}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* 移动端菜单遮罩层 */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 bg-black/20 z-30 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
};

export default Header;
