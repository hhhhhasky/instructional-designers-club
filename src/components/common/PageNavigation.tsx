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
    <div className="sticky top-14 md:top-14 z-40 bg-[rgba(250,248,245,0.95)] backdrop-blur-xl border-b border-bd shadow-ds-xs">
      <div className="max-w-[1200px] mx-auto">
        <nav className="flex overflow-x-auto md:flex-wrap md:justify-center items-center gap-1.5 md:gap-2 py-2 md:py-3 px-3 md:px-4
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`flex-shrink-0 px-2.5 py-1.5 md:px-4 md:py-2 rounded-ds-md text-ds-xs md:text-ds-sm font-ds-medium whitespace-nowrap transition-all duration-200 ${
                activeSection === item.id
                  ? 'bg-ac text-white shadow-ds-xs'
                  : 'text-txs hover:text-ac hover:bg-acl'
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
