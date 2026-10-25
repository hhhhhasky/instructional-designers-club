import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, LockKeyhole } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import { COURSE_PURCHASE_PRODUCTS } from '@/lib/course-purchase';

const COURSE_DETAILS = [
  { topic: '教学设计与课堂实践', headline: '把一堂课，想清楚。', color: 'var(--sage)', background: 'var(--sage-soft)', words: ['理解学习', '设计教学', '改进课堂'], content: '从学习与教学的底层规律，到教材、学情、目标、活动和评价，建立一套能用在日常课、说课与公开课中的设计方法。', audience: '想系统理顺备课思路的老师' },
  { topic: 'AI 工具与教学协作', headline: '让 AI，接住具体工作。', color: 'var(--brown)', background: 'var(--brown-soft)', words: ['认识工具', '人机协作', '工作流程'], content: '理解 AI 工具的用法，把教学分析、教学设计与课程开发中的具体工作交给 AI 辅助完成，同时保留教师自己的判断。', audience: '想把 AI 用进教学工作的老师' },
  { topic: '课标、教材与单课解读', headline: '读懂教材，才好教。', color: 'var(--slate)', background: 'var(--slate-soft)', words: ['课程标准', '单元结构', '单课教学'], content: '从总论到一至九年级分册，贯通道德与法治课标、教材单元与单课内容，理解教材为什么这样编、课堂可以怎样教。', audience: '需要深入研读道法教材的老师' },
];

export default function CourseLibraryPage() {
  const { user, profile, courseAccessCodes, loading } = useAuth();
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const products = COURSE_PURCHASE_PRODUCTS.map((product, index) => ({ ...product, ...COURSE_DETAILS[index], hasAccess: Boolean(user) && (profile?.role === 'admin' || canAccessCourse(courseAccessCodes, product.code)) }));
  const visible = products.filter((product) => filter === 'all' || (!loading && product.hasAccess));

  return (
    <div className="min-h-screen bg-bg text-tx">
      <PageMeta title="课程" description="浏览教学通识课、教师 AI 课与道法教材解读课，选择适合自己的学习方向。" canonicalPath="/course-library" />
      <header className="flex h-16 items-center justify-between border-b border-bd px-5 md:px-10">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-txs hover:text-ac"><ArrowLeft className="h-4 w-4" />返回官网首页</Link>
        {user ? <Link to="/learning" className="text-sm text-txs hover:text-ac">我的学习<ArrowRight className="ml-2 inline h-4 w-4" /></Link> : <Link to="/login" state={{ from: '/course-library' }} className="text-sm text-txs hover:text-ac">登录，查看已开通课程</Link>}
      </header>
      <main className="mx-auto max-w-[1600px] px-5 pb-16 pt-9 md:px-10 md:pt-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="mb-3 text-xs tracking-[0.18em] text-txs">哈老师 · 教师学习课程</p><h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">从你的教学问题出发</h1><p className="mt-3 text-sm leading-7 text-txs">学设计、用 AI、读教材。选择一门课，把方法带回课堂。</p></div>
          <BookOpen className="hidden h-9 w-9 text-ac/60 md:block" aria-hidden="true" />
        </div>
        <div className="mb-6 flex items-center justify-between border-b border-bd" role="group" aria-label="筛选课程">
          <div className="flex gap-7">{(['all', 'mine'] as const).map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-12 border-b-2 text-sm transition-colors ${filter === value ? 'border-ac font-semibold text-ac' : 'border-transparent text-txs hover:text-tx'}`}>{value === 'all' ? '全部课程' : '已开通'}</button>)}</div>
          <span className="text-xs text-txs">{loading && filter === 'mine' ? '正在确认权限' : `${visible.length} 门课程`}</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <article key={product.code} className="group relative flex flex-col overflow-hidden rounded-xl border border-bd bg-white transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-ac">
              <div className="relative px-6 py-7 md:px-7" style={{ backgroundColor: product.background, color: product.color }}>
                <p className="text-xs font-medium tracking-widest">{product.topic}</p>
                <p className="mb-7 mt-5 font-serif text-2xl font-bold leading-snug md:text-[28px]">{product.headline}</p>
                <div className="flex flex-wrap gap-2">{product.words.map((word) => <span key={word} className="border border-current/20 px-2 py-1 text-xs">{word}</span>)}</div>
              </div>
              <div className="flex flex-1 flex-col p-6 md:p-7">
                <p className={`mb-3 flex items-center gap-1.5 text-xs ${product.hasAccess ? 'text-sage' : 'text-txs'}`} role="status">{loading ? '正在确认观看权限…' : product.hasAccess ? <><Check className="h-3.5 w-3.5" />已开通 · 可观看</> : <><LockKeyhole className="h-3.5 w-3.5" />{user ? '未开通' : '登录后确认观看权限'}</>}</p>
                <h2 className="text-xl font-bold"><Link to={product.cataloguePath} className="after:absolute after:inset-0 focus:outline-none">{product.name}</Link></h2>
                <p className="mt-3 text-sm leading-7 text-txs">{product.content}</p>
                <p className="mb-6 mt-4 text-xs leading-6 text-txs">适合：{product.audience}</p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-bd pt-5">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-ac">{!loading && product.hasAccess ? '进入学习' : '查看课程'}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  {!loading && !product.hasAccess && <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" aria-label={`购买${product.name}（在新标签页打开小红书）`} className="relative z-10 inline-flex min-h-10 items-center gap-2 rounded-md bg-ac px-4 text-sm font-semibold text-white hover:bg-acd">购买课程<ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && <div className="py-16 text-center text-sm leading-7 text-txs" role="status">{loading ? '正在确认已开通课程…' : user ? '你还没有开通课程，可以先在「全部课程」中查看目录。' : '登录后，即可查看你已开通的课程。'}</div>}
        <p className="mt-7 text-xs leading-6 text-txs">购买将在小红书打开对应商品，官网不收款。课程按人工流程开通；已购买但仍显示未开通，请联系运营核对订单与官网账号。</p>
      </main>
    </div>
  );
}
