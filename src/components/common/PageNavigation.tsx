import { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  label: string;
}

interface PageNavigationProps {
  items: NavItem[];
}

export default function PageNavigation({ items }: PageNavigationProps) {
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      const sections = items.map(item => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 150;

      // 从后往前遍历，找到第一个顶部位置小于当前滚动位置的section
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section) {
          const sectionTop = section.offsetTop;
          if (scrollPosition >= sectionTop) {
            setActiveSection(items[i].id);
            return;
          }
        }
      }
      
      // 如果没有找到，默认设置为第一个
      if (items.length > 0) {
        setActiveSection(items[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="sticky top-16 md:top-20 z-40 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <nav className="flex flex-wrap items-center gap-1.5 md:gap-2 py-2 md:py-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeSection === item.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
