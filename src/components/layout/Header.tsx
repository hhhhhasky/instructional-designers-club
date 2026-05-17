import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import routes from "@/routes";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visibleRoutes = routes.filter(route => route.visible);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[rgba(250,248,245,0.92)] backdrop-blur-xl shadow-ds-sm border-b border-bd"
          : "bg-[rgba(250,248,245,0.6)] backdrop-blur-sm"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-14 xl:h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-ds-full flex items-center justify-center bg-acl">
              <GraduationCap className="w-5 h-5 text-ac" />
            </div>
            <span className="text-ds-lg font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
              教学设计师俱乐部
            </span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden xl:flex items-center gap-1">
            {visibleRoutes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className={`px-3 py-1.5 text-ds-sm font-ds-semibold rounded-ds-pill transition-all ${
                  location.pathname === route.path
                    ? "text-ac bg-acl"
                    : "text-txs hover:text-ac hover:bg-acl"
                }`}
              >
                {route.name}
              </Link>
            ))}
          </nav>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-3">
            <Button
              asChild
              size="sm"
              className="hidden xl:inline-flex btn-super-cta !text-white font-ds-bold text-ds-sm rounded-ds-lg"
            >
              <a
                href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb"
                target="_blank"
                rel="noopener noreferrer"
              >
                立即加入
              </a>
            </Button>

            {/* 移动端菜单按钮 */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="xl:hidden"
                >
                  {isOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 mt-8">
                  <div className="flex items-center gap-2 pb-4 border-b border-bd">
                    <div className="w-10 h-10 rounded-ds-full flex items-center justify-center bg-acl">
                      <GraduationCap className="w-6 h-6 text-ac" />
                    </div>
                    <span className="text-ds-lg font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
                      教学设计师俱乐部
                    </span>
                  </div>

                  <nav className="flex flex-col gap-2">
                    {visibleRoutes.map((route) => (
                      <Link
                        key={route.path}
                        to={route.path}
                        onClick={() => setIsOpen(false)}
                        className={`px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg transition-all ${
                          location.pathname === route.path
                            ? "text-ac bg-acl"
                            : "text-tx hover:bg-bgs"
                        }`}
                      >
                        {route.name}
                      </Link>
                    ))}
                  </nav>

                  <Button
                    asChild
                    size="lg"
                    className="w-full mt-4 btn-super-cta !text-white font-ds-bold rounded-ds-lg"
                  >
                    <a
                      href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      立即加入
                    </a>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
