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
          ? "bg-background/95 backdrop-blur-md shadow-md border-b border-border"
          : "bg-background/80 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 xl:px-6">
        <div className="flex items-center justify-between h-16 xl:h-20 bg-[transparent] bg-none">
          {/* Logo 和名称 */}
          <Link
            to="/"
            className="flex items-center gap-2 xl:gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-full from-primary to-primary-glow flex items-center justify-center shadow-md bg-[#f0e4c2ff] bg-none">
              <GraduationCap className="w-5 h-5 xl:w-6 xl:h-6 text-primary-foreground" />
            </div>
            <span className="text-base xl:text-lg font-bold text-foreground">
              教学设计师俱乐部
            </span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden xl:flex items-center gap-1">
            {visibleRoutes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === route.path
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
              className="hidden xl:inline-flex shadow-md hover:shadow-lg transition-all"
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
                  <div className="flex items-center gap-2 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-full from-primary to-primary-glow flex items-center justify-center bg-[#f0e4c2ff] bg-none">
                      <GraduationCap className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <span className="text-base font-bold text-foreground">
                      教学设计师俱乐部
                    </span>
                  </div>
                  
                  <nav className="flex flex-col gap-2">
                    {visibleRoutes.map((route) => (
                      <Link
                        key={route.path}
                        to={route.path}
                        onClick={() => setIsOpen(false)}
                        className={`px-4 py-3 text-left text-sm font-medium rounded-lg transition-all ${
                          location.pathname === route.path
                            ? "text-primary bg-primary/10"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        {route.name}
                      </Link>
                    ))}
                  </nav>

                  <Button
                    asChild
                    size="lg"
                    className="w-full mt-4 shadow-md"
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
