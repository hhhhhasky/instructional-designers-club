import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, Users, Sparkles, Quote, Play, TrendingUp, Clock, Calendar, UserCheck, Gift, Crown, Star } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import Header from "@/components/layout/Header";
import MemberHomeHero from "@/components/home/MemberHomeHero";
import PageNavigation from "@/components/common/PageNavigation";
import CountUp from "@/components/ui/CountUp";
import Footer from "@/components/common/Footer";
import PricingSection from "@/components/pricing/PricingSection";
import { getClubStats, getCoursesByMembershipType } from '@/db/api';
import type { Course } from '@/types/types';
import { TestimonialCarousel } from '@/components/testimonials/TestimonialCarousel';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import LockOverlay from '@/components/common/LockOverlay';
import UpgradePopup from '@/components/common/UpgradePopup';
import PageMeta from '@/components/common/PageMeta';
import { useHomeContent } from '@/hooks/useHomeContent';
import { getIcon, getColor, renderInline } from '@/lib/content-render';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, accessLevel, profile, loading } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLevel, setUpgradeLevel] = useState<'plus' | 'pro'>('plus');
  const content = useHomeContent();

  const handleCourseClick = useCallback((courseId: string, membershipType: string) => {
    if (membershipType === 'free') {
      navigate(`/courses/${courseId}`);
      return;
    }
    if (!canAccessCourse(accessLevel, membershipType as 'free' | 'plus' | 'pro')) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${courseId}` } });
        return;
      }
      setUpgradeLevel(membershipType as 'plus' | 'pro');
      setShowUpgrade(true);
      return;
    }
    navigate(`/courses/${courseId}`);
  }, [navigate, user, accessLevel]);

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
    <>
      <PageMeta
        title="教学设计师俱乐部"
        description="一所AI时代的线上创新师范学院。提供系统化教学设计课程、教师AI课、学习营和共学社区，帮助教育者提升教学专业能力。"
        canonicalPath="/"
        keywords="教学设计,教师培训,AI教学,课程设计,教学设计师俱乐部"
      />
    <div className="min-h-screen bg-cream">
      <Header />
      <PageNavigation items={navItems} />
      {user && profile && !loading && <MemberHomeHero />}
      {/* ========== Hero Section ========== */}
      <section className="relative py-20 md:py-24 xl:py-40 px-4 overflow-hidden pt-28 md:pt-32 xl:pt-48 gradient-animate border-b-2 border-bd">
        <div className="absolute top-20 right-10 w-72 h-72 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

        <div className="relative max-w-6xl mx-auto text-center space-y-6 md:space-y-10">
          <div className="space-y-4 md:space-y-6 animate-fade-in-down">
            <h1 className="text-4xl md:text-5xl xl:text-7xl font-ds-black text-tx tracking-tight leading-tight" style={{ fontFamily: 'var(--fd)' }}>
              {content.hero.title_line1}
              <br />
              <span className="text-tx">{content.hero.title_line2}</span>
            </h1>
            <p className="text-lg md:text-2xl xl:text-3xl text-txs max-w-3xl mx-auto leading-relaxed font-medium">{content.hero.subtitle}</p>
          </div>

          <div className="flex flex-col items-center gap-3 md:gap-6 animate-fade-in-up">
            <Button
              size="lg"
              className="btn-pill text-base md:text-xl xl:text-2xl px-8 md:px-12 xl:px-16 py-3 md:py-7 xl:py-8 bg-ac !text-white font-ds-bold hover:bg-acd shadow-ds-accent border-2 border-ac"
              onClick={() => window.open(content.hero.cta_link, '_blank')}
            >
              {content.hero.cta_text}
              <span className="ml-2">→</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ========== 俱乐部介绍 ========== */}
      <section id="introduction" className="py-8 md:py-16 xl:py-24 px-4 bg-aml">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx mb-2 md:mb-4" style={{ fontFamily: 'var(--fd)' }}>{content.intro.section_title}</h2>
            <p className="text-sm md:text-xl xl:text-2xl text-txs">{content.intro.section_subtitle}</p>
          </div>

          <Card className="card-bordered shadow-ds-sm hover-lift">
            <CardHeader className="p-6 md:p-8 xl:p-10 pb-2 md:pb-6">
              <CardTitle className="text-xl md:text-3xl xl:text-4xl font-ds-bold" style={{ fontFamily: 'var(--fd)' }}>{content.intro.welcome_title}</CardTitle>
              <CardDescription className="text-sm md:text-base xl:text-lg leading-relaxed text-txs mt-3">
                {content.intro.welcome_paragraphs.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <><br /><br /></>}
                    {renderInline(p)}
                  </span>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8 xl:p-10 pt-2 md:pt-4 space-y-4 md:space-y-6">
              {/* 俱乐部价值观 */}
              <div className="bg-gradient-to-br from-ac/5 to-ac/10 rounded-xl p-4 md:p-6 border border-ac/20">
                <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
                  <span className="text-xl md:text-3xl">💎</span>
                  <h3 className="font-ds-bold text-xl md:text-3xl text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.values.values_title}</h3>
                </div>
                <p className="text-sm md:text-base text-txs text-center mb-4 md:mb-6 max-w-2xl mx-auto">
                  {content.values.values_subtitle}
                </p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                  {content.values.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 bg-bc rounded-ds-md p-3 md:p-5 border border-bd shadow-ds-xs hover:shadow-ds-sm hover:border-ac/30 transition-all duration-200">
                      <span className="text-lg md:text-2xl flex-shrink-0">{item.emoji}</span>
                      <p className="text-sm md:text-base text-tx leading-snug">相信{renderInline(item.text)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-ds-bold text-lg md:text-2xl mb-3 md:mb-4 text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.intro.product_intro_heading}</h3>
                <ul className="space-y-3 md:space-y-4">
                  <li key="plus-course" className="flex items-start gap-3 md:gap-4">
                    <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-acl text-ac text-sm md:text-base font-ds-bold flex-shrink-0 mt-0.5">1</span>
                    <span className="text-sm md:text-base text-tx leading-relaxed">
                      {renderInline(content.intro.plus_text)}
                    </span>
                  </li>
                  <li key="pro-course" className="flex items-start gap-3 md:gap-4">
                    <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-aml text-am text-sm md:text-base font-ds-bold flex-shrink-0 mt-0.5">2</span>
                    <span className="text-sm md:text-base text-tx leading-relaxed">
                      {renderInline(content.intro.pro_text, "text-am font-semibold")}
                    </span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== 俱乐部创始人介绍 ========== */}
      <section id="founder" className="py-8 md:py-16 xl:py-20 px-4 bg-warm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-10">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.founder.section_title}</h2>
          </div>

          <Card className="border-bd shadow-ds-md overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-0">
              <div className="xl:col-span-1 bg-gradient-to-br from-ac/5 to-ac/10 flex items-center justify-center p-5 md:p-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-ac/20 to-aml/20 rounded-2xl blur-2xl" />
                  <img
                    src={content.founder.avatar_url}
                    alt={content.founder.avatar_alt}
                    className="relative w-32 h-32 md:w-48 md:h-48 xl:w-64 xl:h-64 rounded-2xl object-cover shadow-ds-md border-4 border-cream"
                  />
                </div>
              </div>

              <div className="xl:col-span-2 p-4 md:p-6 xl:p-8 flex flex-col gap-4 md:gap-5">
                <div>
                  <h3 className="text-xl md:text-2xl xl:text-3xl font-ds-bold text-tx mb-2 md:mb-3" style={{ fontFamily: 'var(--fd)' }}>{content.founder.name}</h3>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {content.founder.tags.map((tag, i) => {
                      const c = getColor(tag.color);
                      const Icon = getIcon(tag.icon);
                      return (
                        <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold border ${c.badge}`}>
                          <Icon className="w-3.5 h-3.5" />{tag.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="relative pl-3 md:pl-4 border-l-4 border-ac/40">
                  <Quote className="absolute -top-1 -left-1 w-3.5 h-3.5 md:w-4 md:h-4 text-ac/30" />
                  <p className="text-sm md:text-base xl:text-lg text-txs italic leading-relaxed text-pretty">
                    {content.founder.motto}
                  </p>
                </div>

                <div className="space-y-2">
                  {content.founder.info_items.map((item, i) => {
                    const c = getColor(item.color);
                    const Icon = getIcon(item.icon);
                    return (
                      <div key={i} className="flex items-center gap-2.5 md:gap-3">
                        <div className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg ${c.iconWrap} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 md:w-4.5 md:h-4.5 ${c.iconColor}`} />
                        </div>
                        <div className="min-w-0 flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-txt uppercase tracking-wide flex-shrink-0">{item.label}</span>
                          <p className="text-sm md:text-base text-tx leading-relaxed">{item.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-5 gap-2 pt-2 border-t border-bd">
                  {content.founder.stats.map((s, i) => {
                    const c = getColor(s.color);
                    return (
                      <div key={i} className="flex flex-col items-center text-center gap-0.5 py-2 px-1 rounded-lg bg-warm/40">
                        {(() => { const Icon = getIcon(s.icon); return <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${c.iconColor}`} />; })()}
                        <span className="text-sm md:text-base font-bold text-tx leading-tight">{s.value}</span>
                        <span className="text-[10px] md:text-xs text-txt leading-tight">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ========== 免费课程 ========== */}
      <section id="free-courses" className="py-8 md:py-16 xl:py-24 px-4 relative overflow-hidden bg-tll">
        <div className="hidden md:block absolute top-20 left-10 w-24 h-24 rounded-full bg-tl/10 deco-circle" />
        <div className="hidden md:block absolute bottom-20 right-10 w-16 h-16 rounded-full bg-acl/20 deco-circle" />

        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-6 md:mb-16 animate-fade-in">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
              <Gift className="w-6 h-6 md:w-10 md:h-10 text-tl" />
              <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>免费课程</h2>
            </div>
            <p className="text-sm md:text-xl xl:text-2xl text-txs">精选免费课程，零门槛体验专业教学设计</p>
          </div>

          {loadingCourses ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ac"></div>
              <p className="mt-4 text-txs">加载课程中...</p>
            </div>
          ) : freeCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-txs">暂无免费课程</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {freeCourses.map((course, index) => (
                <Card
                  key={course.id}
                  className="group hover-lift animate-scale-in border-2 border-tl/30 hover:border-tl/60 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <CardTitle className="text-lg md:text-xl group-hover:text-ac transition-colors">
                        {course.title}
                      </CardTitle>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-ds-pill text-xs font-ds-bold bg-tll text-tl whitespace-nowrap flex-shrink-0 border border-tl/30">
                        <Gift className="w-3 h-3 mr-1" />
                        免费
                      </span>
                    </div>
                    {course.category && (
                      <p className="text-sm text-ac font-medium">{course.category}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm md:text-base text-txs mb-4 line-clamp-2">
                      {course.description || '探索教学设计的奥秘，提升教学专业能力'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-txs">
                        {course.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {course.duration}分钟
                          </span>
                        )}
                      </div>
                      <Button asChild size="sm" variant="outline" className="group-hover:bg-tl group-hover:text-white group-hover:border-tl transition-colors">
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

      {/* ========== 会员课程体系 ========== */}
      <section id="member-courses" className="py-8 md:py-16 xl:py-24 px-4 relative overflow-hidden bg-warm">
        <div className="hidden md:block absolute top-20 right-10 w-32 h-32 rounded-full bg-ac/10 deco-circle" />
        <div className="hidden md:block absolute bottom-20 left-10 w-20 h-20 rounded-full bg-tll/15 deco-circle" />

        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-8 md:mb-20 animate-fade-in">
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx mb-3 md:mb-4" style={{ fontFamily: 'var(--fd)' }}>会员课程体系</h2>
            <p className="text-sm md:text-xl xl:text-2xl text-txs">从理解学习开始，到设计出真正有效的课堂</p>
          </div>

          {loadingCourses ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ac"></div>
              <p className="mt-4 text-txs">加载课程中...</p>
            </div>
          ) : (
            <div className="space-y-12 md:space-y-24">
              {/* ===== 教学通识课（Plus）===== */}
              <div className="animate-fade-in-up">
                <div className="text-center mb-5 md:mb-10">
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <Star className="w-6 h-6 md:w-10 md:h-10 text-ac" />
                    <h3 className="text-lg md:text-3xl xl:text-4xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>教学通识课（Plus）</h3>
                  </div>
                  <p className="text-sm md:text-lg text-txs">目标：教学科学化</p>
                </div>

                <div className="mb-5 md:mb-8 p-4 md:p-6 bg-acl/40 rounded-xl border border-ac/20">
                  <h4 className="text-base md:text-xl font-ds-bold text-tx mb-2 md:mb-3" style={{ fontFamily: 'var(--fd)' }}>课程定位</h4>
                  <p className="text-sm md:text-lg text-txs leading-relaxed">
                    帮助你理解"学生是如何学习的"，并基于这些理解来设计课堂。
                    系统学习教学设计理论，把直觉和经验变成可迁移、可迭代的专业方法。
                  </p>
                </div>

                {plusCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-txs">暂无教学通识课（Plus）课程</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plusCourses.map((course, index) => (
                      <Card
                        key={course.id}
                        className="group hover-lift animate-scale-in border-2 border-ac/20 hover:border-ac/40 transition-all duration-300 relative cursor-pointer"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        onClick={() => handleCourseClick(course.id, 'plus')}
                      >
                        {!canAccessCourse(accessLevel, 'plus') && <LockOverlay level="plus" />}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <CardTitle className="text-lg md:text-xl group-hover:text-ac transition-colors">
                              {course.title}
                            </CardTitle>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-ds-pill text-xs font-ds-bold bg-acl text-ac whitespace-nowrap flex-shrink-0 border border-ac/20">
                              <Star className="w-3 h-3 mr-1" />
                              <span className="hidden md:inline">通识课</span>
                              <span className="md:hidden">Plus</span>
                            </span>
                          </div>
                          {course.category && (
                            <p className="text-sm text-ac font-medium">{course.category}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm md:text-base text-txs mb-4 line-clamp-2">
                            {course.description || '系统学习教学设计理论，提升教学专业能力'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-txs">
                            {course.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {course.duration}分钟
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="text-center mt-8">
                  <Button asChild size="lg" variant="outline" className="hover-lift border-ac/20 hover:border-ac/60">
                    <Link to="/courses">
                      查看全部教学通识课（Plus）
                      <TrendingUp className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* ===== 教师AI课（Pro）===== */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="text-center mb-5 md:mb-10">
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <Crown className="w-6 h-6 md:w-10 md:h-10 text-am" />
                    <h3 className="text-lg md:text-3xl xl:text-4xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>教师AI课（Pro）</h3>
                  </div>
                  <p className="text-sm md:text-lg text-txs">目标：教学工程化</p>
                </div>

                <div className="mb-5 md:mb-8 p-4 md:p-6 bg-aml/40 rounded-xl border border-am/20">
                  <h4 className="text-base md:text-xl font-ds-bold text-tx mb-2 md:mb-3" style={{ fontFamily: 'var(--fd)' }}>课程定位</h4>
                  <p className="text-sm md:text-lg text-txs leading-relaxed">
                    在教学通识课（Plus）基础上，用AI拓展教学设计的边界。
                    学会用ClaudeCode等工具构建自己的备课工作流，让AI成为你思考和设计的协作伙伴。
                  </p>
                </div>

                {proCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-txs">暂无教师AI课（Pro）课程</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {proCourses.map((course, index) => (
                      <Card
                        key={course.id}
                        className="group hover-lift animate-scale-in border-2 border-am/20 hover:border-am/40 transition-all duration-300 relative cursor-pointer"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        onClick={() => handleCourseClick(course.id, 'pro')}
                      >
                        {!canAccessCourse(accessLevel, 'pro') && <LockOverlay level="pro" />}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <CardTitle className="text-lg md:text-xl group-hover:text-ac transition-colors">
                              {course.title}
                            </CardTitle>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-ds-pill text-xs font-ds-bold bg-aml text-am whitespace-nowrap flex-shrink-0 border border-am/20">
                              <Crown className="w-3 h-3 mr-1" />
                              <span className="hidden md:inline">AI课</span>
                              <span className="md:hidden">Pro</span>
                            </span>
                          </div>
                          {course.category && (
                            <p className="text-sm text-am font-medium">{course.category}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm md:text-base text-txs mb-4 line-clamp-2">
                            {course.description || '掌握AI技术，实现备课流程化和教学工程化'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-txs">
                            {course.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {course.duration}分钟
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="text-center mt-8">
                  <Button asChild size="lg" variant="outline" className="hover-lift border-am/20 hover:border-am/60">
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

      {/* ========== 俱乐部数据 ========== */}
      <section id="stats" className="py-8 md:py-16 xl:py-24 px-4 bg-acl relative overflow-hidden">
        <div className="hidden md:block absolute top-16 right-16 w-20 h-20 rounded-full bg-ac/10 deco-circle animate-pulse-slow" />
        <div className="hidden md:block absolute bottom-16 left-16 w-16 h-16 rounded-full bg-tl/15 deco-circle" />

        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-6 md:mb-16 animate-fade-in">
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx mb-2 md:mb-4" style={{ fontFamily: 'var(--fd)' }}>{content.stats.section_title}</h2>
            <p className="text-sm md:text-xl xl:text-2xl text-txs">{content.stats.section_subtitle}</p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-6 xl:gap-8">
            <Card className="card-bordered shadow-ds-sm bg-card hover-lift animate-scale-in">
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Users className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-ac mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-ds-black text-tx mb-0.5 md:mb-2">
                    <CountUp end={stats.members} suffix="+" />
                  </p>
                  <p className="text-xs md:text-base text-txs font-semibold">会员人数</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-bordered shadow-ds-sm bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <GraduationCap className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-ac mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-ds-black text-tx mb-0.5 md:mb-2">
                    <CountUp end={stats.camps} />
                  </p>
                  <p className="text-xs md:text-base text-txs font-semibold">学习营数量</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-bordered shadow-ds-sm bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <BookOpen className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-ac mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-ds-black text-tx mb-0.5 md:mb-2">
                    <CountUp end={stats.courses} />
                  </p>
                  <p className="text-xs md:text-base text-txs font-semibold">课程节数</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-bordered shadow-ds-sm bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Clock className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-ac mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-ds-black text-tx mb-0.5 md:mb-2">
                    <CountUp end={stats.totalMinutes} />
                  </p>
                  <p className="text-xs md:text-base text-txs font-semibold">累计课程时长（分钟）</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-bordered shadow-ds-sm bg-card hover-lift animate-scale-in" style={{ animationDelay: '0.4s' }}>
              <CardContent className="p-3 md:p-8 text-center space-y-1.5 md:space-y-4">
                <Calendar className="w-7 h-7 md:w-12 md:h-12 xl:w-14 xl:h-14 text-ac mx-auto transition-transform duration-300 hover:scale-110" />
                <div>
                  <p className="text-2xl md:text-5xl xl:text-6xl font-ds-black text-tx mb-0.5 md:mb-2">
                    <CountUp end={Math.max(0, Math.floor((new Date().getTime() - new Date(content.stats.start_date).getTime()) / (1000 * 60 * 60 * 24)))} />
                  </p>
                  <p className="text-xs md:text-base text-txs font-semibold">运行天数</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 md:mt-12 text-center">
            <p className="text-txs text-sm md:text-lg font-medium">{content.stats.footnote}</p>
          </div>
        </div>
      </section>

      {/* ========== 部分会员简介 ========== */}
      <section id="members" className="py-8 md:py-16 xl:py-20 px-4 bg-warm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-10 animate-fade-in">
            <UserCheck className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.membersMeta.section_title}</h2>
          </div>

          <Card className="border-bd shadow-ds-sm hover-lift animate-fade-in-up">
            <CardContent className="p-4 md:p-8">
              <p className="text-center text-sm md:text-lg text-txs mb-6 md:mb-10">
                {content.membersMeta.subtitle}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {content.members.map((member, index) => (
                  <div
                    key={member.id || index}
                    className="flex items-start gap-3 md:gap-4 p-3 md:p-5 rounded-ds-md bg-bc border border-bd shadow-ds-xs hover:shadow-ds-sm hover-lift transition-all duration-200 group"
                  >
                    <div className="text-2xl md:text-3xl flex-shrink-0 transition-transform duration-300 group-hover:scale-125">{member.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-ds-bold text-tx mb-1 md:mb-1.5 text-sm md:text-base">{member.name}</p>
                      <p className="text-xs md:text-sm text-txt leading-relaxed">{member.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 md:mt-10 text-center">
                <p className="text-sm md:text-base text-txt">
                  {content.membersMeta.footnote}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 立刻报名按钮 */}
          <div className="mt-10 md:mt-16 text-center animate-fade-in-up">
            <Button
              size="lg"
              className="btn-super-cta animate-glow-pulse text-base md:text-2xl xl:text-3xl px-8 md:px-16 xl:px-20 py-4 md:py-8 xl:py-10 !text-white font-ds-black rounded-full border-0 relative z-10"
              onClick={() => window.open(content.membersMeta.cta_link, '_blank')}
            >
              <span className="relative z-10 flex items-center gap-2 md:gap-3">
                <span>💎</span>
                <span>{content.membersMeta.cta_text}</span>
                <span className="text-xl md:text-2xl xl:text-3xl">→</span>
              </span>
            </Button>
            <p className="text-sm md:text-base text-txs mt-3 md:mt-6 font-medium">
              {content.membersMeta.cta_hint}
            </p>
          </div>
        </div>
      </section>

      {/* ========== 会员老师们这么说 ========== */}
      <section id="testimonials" className="py-8 md:py-16 xl:py-20 px-4 bg-tll">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-10">
            <Quote className="w-5 h-5 md:w-6 md:h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.testimonialsMeta.section_title}</h2>
          </div>

          <TestimonialCarousel
            images={content.testimonials.map((t) => ({ url: t.image_url, alt: t.alt_text }))}
            autoplayDelay={content.testimonialsMeta.autoplay_ms}
          />

          <div className="mt-8 text-center">
            <p className="text-txt text-sm md:text-base">
              {content.testimonialsMeta.footnote}
            </p>
          </div>
        </div>
      </section>

      {/* ========== FAQ 常见问题解答 ========== */}
      <section id="faq" className="py-8 md:py-16 xl:py-20 px-4 bg-warm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-10">
            <span className="text-2xl md:text-3xl">❓</span>
            <h2 className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>{content.faqTitle}</h2>
          </div>

          <div className="space-y-4 md:space-y-6">
            {content.faqs.map((faq, index) => (
              <Card key={faq.id || index} className="border-bd shadow-ds-sm hover-lift">
                <CardHeader className="pb-2 md:pb-6">
                  <CardTitle className="text-base md:text-xl xl:text-2xl text-tx" style={{ fontFamily: 'var(--fd)' }}>
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-ac/5 border border-ac/20 rounded-lg p-4 md:p-5">
                    <p className="text-sm md:text-lg text-txs leading-relaxed">
                      <strong className="text-tx font-ds-bold">A：</strong>{renderInline(faq.answer, "text-tx font-semibold")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 立即加入 - 产品档位展示 */}
      <PricingSection />
      <Footer />
      <UpgradePopup
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        requiredLevel={upgradeLevel}
      />
    </div>
    </>
  );
}
