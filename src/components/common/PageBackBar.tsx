import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PageBackBar({ to = '/', label = '返回官网首页' }: { to?: string; label?: string }) {
  return (
    <header className="flex min-h-12 shrink-0 items-center border-b border-bd bg-[var(--paper)] px-4 py-1.5 md:px-6 print:hidden">
      <Link to={to} className="group inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-sm text-txs transition-colors hover:text-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        {label}
      </Link>
    </header>
  );
}
