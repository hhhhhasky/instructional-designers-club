import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, Users, Sparkles, Quote, Play, TrendingUp, Clock, Calendar, UserCheck, Gift, Crown, Star, Brain, Lightbulb, Target, Bot } from "lucide-react";
import { Link } from 'react-router-dom';
import Header from "@/components/layout/Header";
import PageNavigation from "@/components/common/PageNavigation";
import CountUp from "@/components/ui/CountUp";
import Footer from "@/components/common/Footer";
import PricingSection from "@/components/pricing/PricingSection";
import { getClubStats, getCoursesByMembershipType } from '@/db/api';
import type { Course } from '@/types/types';
import { TestimonialCarousel } from '@/components/testimonials/TestimonialCarousel';

export default function HomePage() {
  // 俱乐部统计数据状态
  const [stats, setStats] = useState({
    camps: 0,
    courses: 0,
    totalMinutes: 0,
    members: 500
  });

  // 课程数据状态
  const [freeCourses, setFreeCourses] = useState<Course[]>([]);
  const [plusCourses, setPlusCourses] = useState<Course[]>([]);
  const [proCourses, setProCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getClubStats();
        setStats(data);
      } catch (error) {
        console.error('加载俱乐部统计数据失败:', error);
      }
    };

    loadStats();
  }, []);

  // 加载课程数据
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoadingCourses(true);
        
        // 并行加载三种类型的课程
        const [freeData, plusData, proData] = await Promise.all([
          getCoursesByMembershipType('free'),
          getCoursesByMembershipType('plus'),
          getCoursesByMembershipType('pro')
        ]);

        // 只取前几门课程用于展示
        setFreeCourses(freeData.slice(0, 4));
        setPlusCourses(plusData.slice(0, 4));
        setProCourses(proData.slice(0, 4));
      } catch (error) {
        console.error('加载课程数据失败:', error);
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

  const navItems = [
    { id: 'introduction', label: '俱乐部介绍' },
    { id: 'founder', label: '创始人介绍' },
    { id: 'free-courses', label: '免费课程' },
    { id: 'member-courses', label: '会员课程' },
    { id: 'stats', label: '俱乐部数据' },
    { id: 'members', label: '会员简介' },
    { id: 'testimonials', label: '会员评价' },
    { id: 'faq', label: '常见问题' },
    { id: 'join', label: '会员方案' },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <PageNavigation items={navItems} />
      {/* Hero Section - 欢迎区域 */}
      <section className="relative py-6 md:py-24 xl:py-40 px-4 overflow-hidden pt-16 md:pt-32 xl:pt-48 bg-[transparent] bg-none">
        {/* 装饰性几何图形 - 在手机端隐藏 */}
        <div className="hidden md:block absolute top-32 right-20 w-16 h-16 rounded-full bg-accent/30 deco-circle animate-pulse-slow" />
        <div className="hidden md:block absolute top-48 right-40 w-8 h-8 rounded-full bg-accent-secondary/40 deco-circle" />
        <div className="hidden md:block absolute bottom-32 left-20 w-20 h-20 rounded-full bg-primary-glow/20 deco-circle animate-pulse-slow" />
        <div className="hidden md:block absolute bottom-48 left-48 w-12 h-12 rounded-full bg-accent/25 deco-circle" />
        
        <div className="relative max-w-6xl mx-auto text-center space-y-6 md:space-y-10">
          <div className="space-y-4 md:space-y-6 animate-fade-in-down">

            <h1 className="text-2xl md:text-5xl xl:text-7xl font-black text-foreground tracking-tight leading-tight">
              Hi，欢迎来到
              <br />
              <span className="text-foreground">教学设计师俱乐部</span>
            </h1>
            <p className="text-sm md:text-xl xl:text-3xl text-foreground/80 max-w-3xl mx-auto leading-relaxed font-medium">{"一所AI时代的线上创新师范学院"}</p>
          </div>
          
          <div className="flex flex-col items-center gap-3 md:gap-6 animate-fade-in-up">
            <Button 
              size="lg" 
              className="btn-pill text-sm md:text-lg xl:text-xl px-6 md:px-12 xl:px-16 py-3 md:py-7 xl:py-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-elegant)] font-bold border-2 border-primary"
              onClick={() => window.open('http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb', '_blank')}
            >
              立即加入俱乐部
              <span className="ml-2">→</span>
            </Button>

          </div>
        </div>
      </section>
      {/* 俱乐部介绍 */}
      <section id="introduction" className="py-6 md:py-16 xl:py-24 px-4 bg-yellow-soft">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-12">
            <h2 className="text-xl md:text-4xl xl:text-5xl font-black text-foreground mb-2 md:mb-4">俱乐部介绍</h2>
            <p className="text-sm md:text-lg xl:text-xl text-foreground/70">Hi，热爱教学的老师！</p>
          </div>
          
          <Card className="card-bordered shadow-[var(--shadow-card)] hover-lift">
            <CardHeader className="pb-2 md:pb-6">
              <CardTitle className="text-lg md:text-2xl xl:text-3xl font-bold">欢迎加入我们</CardTitle>
              <CardDescription className="text-sm md:text-base xl:text-lg leading-relaxed text-foreground/70">{"教学设计师俱乐部是一个专属老师们的陪伴式成长社区，很多老师平时备课没头绪、不知道怎么把知识讲透、不知道如何让学生爱上学科，我们就是来解决这些烦恼的。在这里，我们会用 CREATE 模型等实用的方法，帮你理清思路，把课备得更轻松。只要你想提升教学设计能力，无论教哪个学科，都能在这里找到懂你的同行者。期待你的加入，咱们一起享受教学。"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-6">
              {/* 俱乐部价值观 */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 md:p-6 border border-primary/20">
                <div className="flex items-center gap-2 mb-2 md:mb-4">
                  <span className="text-lg md:text-2xl">💎</span>
                  <h3 className="font-bold text-base md:text-xl text-foreground">俱乐部价值观</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-4">
                  {[
                    { emoji: '✨', text: <><strong className="text-primary">专业方法</strong>先于直觉和经验</> },
                    { emoji: '🎯', text: <><strong className="text-primary">学习是可以被优化的</strong></> },
                    { emoji: '🔬', text: <>有效的教学是<strong className="text-primary">科学循证的</strong></> },
                    { emoji: '⚡', text: <>优质的教学是<strong className="text-primary">有效果、有参与度、有效率的</strong></> },
                    { emoji: '🤝', text: <><strong className="text-primary">尊重学习者的主体性</strong></> },
                    { emoji: '🧩', text: <><strong className="text-primary">复杂的事物可以被拆解</strong></> },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/80 rounded-lg p-2.5 md:p-4">
                      <span className="text-base md:text-xl flex-shrink-0">{item.emoji}</span>
                      <p className="text-xs md:text-base text-foreground leading-snug">相信{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm md:text-lg mb-2 md:mb-3 text-foreground">{"在俱乐部中，包括 Plus 和 Pro 两大会员产品："}</h3>
                <ul className="space-y-2 md:space-y-3 text-muted-foreground">
                  <li key="plus-course" className="flex items-start gap-2 md:gap-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-medium flex-shrink-0 mt-0.5">1</span>
                    <span className="text-xs md:text-base text-foreground">{"Plus会员：包含70+节教学通识课+专属答疑社区。它解决的是“怎么把课备好讲透”“如何让教学有效、高效、高参与度”的基础问题，适合想要扎实基本功、系统提升教学设计能力的老师，适合公开课、日常课、说课、创新教育等教学场景。"}</span>
                  </li>
                  <li key="pro-course" className="flex items-start gap-2 md:gap-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-medium flex-shrink-0 mt-0.5">2</span>
                    <span className="text-xs md:text-base text-foreground">{"Pro会员：在 Plus 的基础上，增加了30+节教师 AI 课，以及我研发的AI工具、网站、skill等资源包。它帮你打破“AI 只能拿来写写教案大纲”的局限，解决的是怎么让 AI 帮你攻克以前觉得难啃的教学痛点，把课备得更有深度，适合追求 90 分教学水平、每天用 AI 至少 1 小时、探索教学新可能，并且愿意静下心来动手实践的老师们。"}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* 俱乐部创始人介绍 */}
      <section id="founder" className="py-6 md:py-12 xl:py-16 px-4 bg-[#ecece5ff] bg-none">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-8">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-primary" />
            <h2 className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground">俱乐部创始人</h2>
          </div>

          <Card className="border-border shadow-[var(--shadow-elegant)] overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-0">
              {/* 照片部分 */}
              <div className="xl:col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-5 md:p-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary-glow/20 rounded-2xl blur-2xl" />
                  <img
                    src="https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png"
                    alt="哈老师"
                    className="relative w-32 h-32 md:w-48 md:h-48 xl:w-64 xl:h-64 rounded-2xl object-cover shadow-[var(--shadow-elegant)] border-4 border-background"
                  />
                </div>
              </div>

              {/* 介绍部分 */}
              <div className="xl:col-span-2 p-4 md:p-6 xl:p-8 flex flex-col gap-4 md:gap-5">
                {/* 姓名 + 身份标签 */}
                <div>
                  <h3 className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground mb-2 md:mb-3">哈老师</h3>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      <GraduationCap className="w-3 h-3" />教学专家
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <Bot className="w-3 h-3" />开发小白
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                      <TrendingUp className="w-3 h-3" />一人公司
                    </span>
                  </div>
                </div>

                {/* 信念 */}
                <div className="relative pl-3 md:pl-4 border-l-4 border-primary/40">
                  <Quote className="absolute -top-1 -left-1 w-3.5 h-3.5 md:w-4 md:h-4 text-primary/30" />
                  <p className="text-xs md:text-sm xl:text-base text-foreground/80 italic leading-relaxed text-pretty">
                    教学是艺术和科学，更是工程和技术
                  </p>
                </div>

                {/* 愿景 / 产品 / 社区 */}
                <div className="space-y-2">
                  {[
                    { icon: Lightbulb, label: '愿景', text: '做一所 AI 时代的创新师范学院', bg: 'bg-amber-500/10', color: 'text-amber-500' },
                    { icon: BookOpen, label: '产品', text: '教学通识课 / 教师AI课', bg: 'bg-primary/10', color: 'text-primary' },
                    { icon: Users, label: '社区', text: '教学设计师俱乐部', bg: 'bg-teal-500/10', color: 'text-teal-600' },
                  ].map(({ icon: Icon, label, text, bg, color }) => (
                    <div key={label} className="flex items-center gap-2.5 md:gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-lg ${bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${color}`} />
                      </div>
                      <div className="min-w-0 flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0">{label}</span>
                        <p className="text-xs md:text-sm text-foreground leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 数据亮点 */}
                <div className="grid grid-cols-5 gap-2 pt-2 border-t border-border">
                  {[
                    { icon: Brain, value: '6h+', label: '每日AI', color: 'text-purple-500' },
                    { icon: Bot, value: '80%', label: 'AI外包', color: 'text-amber-500' },
                    { icon: BookOpen, value: '数百节', label: '师培课', color: 'text-primary' },
                    { icon: UserCheck, value: '数千名', label: '师支持', color: 'text-teal-600' },
                    { icon: TrendingUp, value: '数万名', label: '全网粉', color: 'text-rose-500' },
                  ].map(({ icon: Icon, value, label, color }) => (
                    <div key={label} className="flex flex-col items-center text-center gap-0.5 py-2 px-1 rounded-lg bg-muted/40">
                      <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${color}`} />
                      <span className="text-sm md:text-base font-bold text-foreground leading-tight">{value}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
      {/* 课程试看 */}
      {/* 免费课程 */}
      <section id="free-courses" className="py-6 md:py-16 xl:py-24 px-4 relative overflow-hidden bg-[#00000000] bg-none">
        {/* 装饰元素 */}
        <div className="hidden md:block absolute top-20 left-10 w-24 h-24 rounded-full bg-accent-secondary/20 deco-circle" />
        <div className="hidden md:block absolute bottom-20 right-10 w-16 h-16 rounded-full bg-primary-glow/15 deco-circle" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-5 md:mb-16 animate-fade-in">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-4">
              <Gift className="w-6 h-6 md:w-10 md:h-10 text-green-600" />
              <h2 className="text-xl md:text-4xl xl:text-5xl font-black text-foreground">免费课程</h2>
            </div>
            <p className="text-sm md:text-lg xl:text-xl text-foreground/70">精选免费课程，零门槛体验专业教学设计</p>
          </div>

          {loadingCourses ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">加载课程中...</p>
            </div>
          ) : freeCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无免费课程</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {freeCourses.map((course, index) => (
                <Card 
                  key={course.id} 
                  className="group hover-lift animate-scale-in border-2 border-green-200 hover:border-green-400 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <CardTitle className="text-lg md:text-xl group-hover:text-primary transition-colors">
                        {course.title}
                      </CardTitle>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 whitespace-nowrap flex-shrink-0">
                        <Gift className="w-3 h-3 mr-1" />
                        免费
                      </span>
                    </div>
                    {course.category && (
                      <p className="text-sm text-primary font-medium">{course.category}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {course.description || '探索教学设计的奥秘，提升教学专业能力'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {course.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {course.duration}分钟
                          </span>
                        )}
                      </div>
                      <Button asChild size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Link to={`/courses/${course.id}`}>
                          <Play className="w-4 h-4 mr-1" />
                          立即学习
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 查看更多按钮 */}
          <div className="text-center mt-8 md:mt-12">
            <Button asChild size="lg" variant="outline" className="hover-lift">
              <Link to="/courses">
                查看全部免费课程
                <TrendingUp className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* 会员课程 */}
      <section id="member-courses" className="py-6 md:py-16 xl:py-24 px-4 relative overflow-hidden bg-gradient-to-b from-background to-muted/20">
        {/* 装饰元素 */}
        <div className="hidden md:block absolute top-20 right-10 w-32 h-32 rounded-full bg-primary/10 deco-circle" />
        <div className="hidden md:block absolute bottom-20 left-10 w-20 h-20 rounded-full bg-accent-secondary/15 deco-circle" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-6 md:mb-20 animate-fade-in">
            <h2 className="text-xl md:text-4xl xl:text-5xl font-black text-foreground mb-2 md:mb-4">会员课程体系</h2>
            <p className="text-sm md:text-lg xl:text-xl text-foreground/70">从教学科学化到教学工程化的完整学习路径</p>
          </div>

          {loadingCourses ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">加载课程中...</p>
            </div>
          ) : (
            <div className="space-y-10 md:space-y-24">
              {/* 教学通识课（Plus）课程 */}
              <div className="animate-fade-in-up">
                <div className="flex items-center gap-3 mb-5 md:mb-12">
                  <div className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                    <Star className="w-4 h-4 md:w-6 md:h-6 xl:w-7 xl:h-7 flex-shrink-0" />
                    <div>
                      <h3 className="text-base md:text-2xl xl:text-3xl font-black">教学通识课（Plus）</h3>
                      <p className="text-xs md:text-base opacity-90">目标：教学科学化</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 md:mb-6 p-3 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                  <h4 className="text-sm md:text-lg font-bold text-foreground mb-1.5 md:mb-3">课程定位</h4>
                  <p className="text-xs md:text-base text-foreground/80 leading-relaxed">
                    帮助教师从教学随性化、教学经验化，进阶到<strong className="text-primary">教学科学化</strong>。
                    系统学习教学设计理论，掌握科学的教学方法，建立完整的教学设计思维框架。
                  </p>
                </div>

                {plusCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">暂无教学通识课（Plus）课程</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plusCourses.map((course, index) => (
                      <Card 
                        key={course.id} 
                        className="group hover-lift animate-scale-in border-2 border-blue-200 hover:border-blue-400 transition-all duration-300"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <CardTitle className="text-lg md:text-xl group-hover:text-primary transition-colors">
                              {course.title}
                            </CardTitle>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 whitespace-nowrap flex-shrink-0">
                              <Star className="w-3 h-3 mr-1" />
                              {/* 桌面端显示"通识课"，移动端简化为"Plus" */}
                              <span className="hidden md:inline">通识课</span>
                              <span className="md:hidden">Plus</span>
                            </span>
                          </div>
                          {course.category && (
                            <p className="text-sm text-primary font-medium">{course.category}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {course.description || '系统学习教学设计理论，提升教学专业能力'}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {course.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {course.duration}分钟
                                </span>
                              )}
                            </div>
                            <Button asChild size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <Link to={`/courses/${course.id}`}>
                                查看详情
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="text-center mt-8">
                  <Button asChild size="lg" variant="outline" className="hover-lift border-blue-300 hover:border-blue-500">
                    <Link to="/courses">
                      查看全部教学通识课（Plus）
                      <TrendingUp className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* 教师AI课（Pro）课程 */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center gap-3 mb-5 md:mb-12">
                  <div className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg">
                    <Crown className="w-4 h-4 md:w-6 md:h-6 xl:w-7 xl:h-7 flex-shrink-0" />
                    <div>
                      <h3 className="text-base md:text-2xl xl:text-3xl font-black">教师AI课（Pro）</h3>
                      <p className="text-xs md:text-base opacity-90">目标：教学工程化</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 md:mb-6 p-3 md:p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200">
                  <h4 className="text-sm md:text-lg font-bold text-foreground mb-1.5 md:mb-3">课程定位</h4>
                  <p className="text-xs md:text-base text-foreground/80 leading-relaxed">
                    在教学通识课（Plus）基础上，进一步实现<strong className="text-amber-600">教学工程化、备课流程化</strong>。
                    全面掌握AI技术，学习ClaudeCode等先进工具，让备课更高效，让教学更智能。
                  </p>
                </div>

                {proCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">暂无教师AI课（Pro）课程</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {proCourses.map((course, index) => (
                      <Card 
                        key={course.id} 
                        className="group hover-lift animate-scale-in border-2 border-amber-200 hover:border-amber-400 transition-all duration-300"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <CardTitle className="text-lg md:text-xl group-hover:text-primary transition-colors">
                              {course.title}
                            </CardTitle>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 whitespace-nowrap flex-shrink-0">
                              <Crown className="w-3 h-3 mr-1" />
                              {/* 桌面端显示"AI课"，移动端简化为"Pro" */}
                              <span className="hidden md:inline">AI课</span>
                              <span className="md:hidden">Pro</span>
                            </span>
                          </div>
                          {course.category && (
                            <p className="text-sm text-amber-600 font-medium">{course.category}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {course.description || '掌握AI技术，实现备课流程化和教学工程化'}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {course.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {course.duration}分钟
                                </span>
                              )}
                            </div>
                            <Button asChild size="sm" variant="outline" className="group-hover:bg-amber-600 group-hover:text-white transition-colors">
                              <Link to={`/courses/${course.id}`}>
                                查看详情
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="text-center mt-8">
                  <Button asChild size="lg" variant="outline" className="hover-lift border-amber-300 hover:border-amber-500">
                    <Link to="/courses">
                      查看全部教师AI课（Pro）
                      <TrendingUp className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      <section id="stats" className="py-6 md:py-16 xl:py-24 px-4 bg-blue-soft relative overflow-hidden">
        {/* 装饰元素 - 在手机端隐藏 */}
        <div className="hidden md:block absolute top-16 right-16 w-20 h-20 rounded-full bg-accent/20 deco-circle animate-pulse-slow" />
        <div className="hidden md:block absolute bottom-16 left-16 w-16 h-16 rounded-full bg-accent-secondary/25 deco-circle" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-5 md:mb-16 animate-fade-in">
            <h2 className="text-xl md:text-4xl xl:text-5xl font-black text-foreground mb-2 md:mb-4">俱乐部数据</h2>
            <p className="text-sm md:text-lg xl:text-xl text-foreground/70">持续成长的学习社区</p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-6 xl:gap-8">
            {/* 会员人数 */}
            <Card className="card-bordered shadow-[var(--shadow-card)] bg-card hover-lift animate-scale-in">
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Users className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-primary mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-black text-foreground mb-0.5 md:mb-2">
                    <CountUp end={stats.members} suffix="+" />
                  </p>
                  <p className="text-xs md:text-base text-muted-foreground font-semibold">会员人数</p>
                </div>
              </CardContent>
            </Card>

            {/* 学习营数量 */}
            <Card className="card-bordered shadow-[var(--shadow-card)] bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <GraduationCap className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-primary mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-black text-foreground mb-0.5 md:mb-2">
                    <CountUp end={stats.camps} />
                  </p>
                  <p className="text-xs md:text-base text-muted-foreground font-semibold">学习营数量</p>
                </div>
              </CardContent>
            </Card>

            {/* 课程节数 */}
            <Card className="card-bordered shadow-[var(--shadow-card)] bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <BookOpen className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-primary mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-black text-foreground mb-0.5 md:mb-2">
                    <CountUp end={stats.courses} />
                  </p>
                  <p className="text-xs md:text-base text-muted-foreground font-semibold">课程节数</p>
                </div>
              </CardContent>
            </Card>

            {/* 课程累计时长 */}
            <Card className="card-bordered shadow-[var(--shadow-card)] bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Clock className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-primary mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-black text-foreground mb-0.5 md:mb-2">
                    <CountUp end={stats.totalMinutes} />
                  </p>
                  <p className="text-xs md:text-base text-muted-foreground font-semibold">累计课程时长（分钟）</p>
                </div>
              </CardContent>
            </Card>

            {/* 运行天数 */}
            <Card className="card-bordered shadow-[var(--shadow-card)] bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.4s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Calendar className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-primary mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-black text-foreground mb-0.5 md:mb-2">
                    <CountUp end={Math.floor((new Date().getTime() - new Date('2025-03-31').getTime()) / (1000 * 60 * 60 * 24))} />
                  </p>
                  <p className="text-xs md:text-base text-muted-foreground font-semibold">运行天数</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 md:mt-12 text-center">
            <p className="text-foreground/70 text-sm md:text-lg font-medium">💪 持续成长的学习社群，与几百位教育者一起探索AI时代的教学设计</p>
          </div>
        </div>
      </section>
      {/* 部分会员简介 */}
      <section id="members" className="py-6 md:py-12 xl:py-16 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-8 animate-fade-in">
            <UserCheck className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-primary" />
            <h2 className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground">部分会员简介</h2>
          </div>

          <Card className="border-border shadow-[var(--shadow-card)] hover-lift animate-fade-in-up">
            <CardContent className="p-4 md:p-8">
              <p className="text-center text-sm md:text-base text-muted-foreground mb-5 md:mb-8">
                来自不同领域的优秀教育者都在这里学习成长
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 md:gap-4">
                {[
                  { icon: "👶", name: "某高校幼儿教育L老师", desc: "专注幼儿教育理论与实践研究" },
                  { icon: "💭", name: "独立人文思辨教育Z老师", desc: "致力于培养学生批判性思维" },
                  { icon: "📐", name: "某小学数学教研员M老师", desc: "小学数学教学研究与指导专家" },
                  { icon: "⚛️", name: "某高中物理L老师", desc: "高中物理教学创新实践者" },
                  { icon: "🏛️", name: "某中学政治R老师", desc: "中学政治课程设计与教学" },
                  { icon: "🌍", name: "某高中英语M老师", desc: "高中英语教学与跨文化交流" },
                  { icon: "🎯", name: "广州一土数学老师", desc: "创新教育理念的践行者" },
                  { icon: "💡", name: "青少年创新PBL课程L老师", desc: "项目式学习课程设计专家" },
                  { icon: "🌱", name: "厌学青少年疗愈导师J老师", desc: "青少年心理疗愈与学习动力激发" },
                  { icon: "🌐", name: "某IB学校L老师", desc: "国际文凭课程教学实践者" },
                  { icon: "🎓", name: "某大学教学设计在读博士", desc: "教学设计理论深度研究者" },
                ].map((member, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 hover-lift transition-all duration-200 border border-border group"
                  >
                    <div className="text-2xl md:text-3xl flex-shrink-0 transition-transform duration-300 group-hover:scale-125">{member.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground mb-0.5 md:mb-1 text-xs md:text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{member.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 md:mt-8 text-center">
                <p className="text-xs md:text-sm text-muted-foreground">
                  🌟 这么多优秀的教育者都在这里学习，你还在等什么？
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 立刻报名按钮 */}
          <div className="mt-8 md:mt-16 text-center animate-fade-in-up">
            <Button 
              size="lg" 
              className="btn-super-cta animate-glow-pulse text-base md:text-xl xl:text-2xl px-8 md:px-16 xl:px-20 py-4 md:py-8 xl:py-10 text-primary-foreground font-black rounded-full border-0 relative z-10"
              onClick={() => window.open('http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb', '_blank')}
            >
              <span className="relative z-10 flex items-center gap-2 md:gap-3">
                <span>💎</span>
                <span>立刻报名加入</span>
                <span className="text-xl md:text-2xl xl:text-3xl">→</span>
              </span>
            </Button>
            <p className="text-xs md:text-sm text-foreground/70 mt-3 md:mt-6 font-medium">
              点击按钮填写报名表单，开启你的学习之旅
            </p>
          </div>
        </div>
      </section>
      {/* 俱乐部课程介绍 */}
      <section id="testimonials" className="py-6 md:py-12 xl:py-16 px-4 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-8">
            <Quote className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-primary" />
            <h2 className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground">会员老师们这么说</h2>
          </div>

          <TestimonialCarousel
            images={[
              {
                url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xs.jpg",
                alt: "会员评价：新一期大大的期待！上一期的真实任务实操性真是受益匪浅"
              },
              {
                url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xu.jpg",
                alt: "会员评价：你真是做了好多非常好的归纳总结提炼"
              },
              {
                url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf083k.jpg",
                alt: "会员评价：感觉把你的课吃透，我一家B轮融资的企业去做内训师"
              },
              {
                url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xt.jpg",
                alt: "会员评价：哈老师您的思路真的很好，但是我有点疑问"
              },
              {
                url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf1gcg.jpg",
                alt: "会员评价：很喜欢您的课，接地气，也有深度"
              }
            ]}
            autoplayDelay={5000}
          />

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              来自俱乐部会员老师的真实反馈，他们在这里收获了专业成长和教学突破
            </p>
          </div>
        </div>
      </section>
      {/* CTA 报名邀请 */}
      <section id="faq" className="py-6 md:py-12 xl:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-8">
            <span className="text-2xl md:text-3xl">❓</span>
            <h2 className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground">FAQ 常见问题解答</h2>
          </div>

          <div className="space-y-3 md:space-y-6">
            {/* Q1 */}
            <Card className="border-border shadow-[var(--shadow-card)] hover-lift">
              <CardHeader className="pb-2 md:pb-6">
                <CardTitle className="text-sm md:text-lg xl:text-xl text-foreground">
                  Q1：俱乐部的课程适合哪些学段、哪些学科的老师？
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">A：</strong>适合全学段全学科，从小学到高校均可。为了做到差异化教学，我也会在课程中列举不同学段的例子做应用示范。同时我们也有不同的学科教研组，便于大家讨论更具体的学科备课上课问题。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Q2 */}
            <Card className="border-border shadow-[var(--shadow-card)] hover-lift">
              <CardHeader className="pb-2 md:pb-6">
                <CardTitle className="text-sm md:text-lg xl:text-xl text-foreground">
                  Q2：俱乐部能提供一对一的课程指导吗？
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 md:p-4">
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">A：</strong>不提供一对一指导，但是很欢迎大家在俱乐部内主动发起你的磨课会议。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* 立即加入 - 产品档位展示 */}
      <PricingSection />
      <Footer />
    </div>
  );
}
