import PricingCard, { PricingTier } from "./PricingCard";
import ComparisonTable from "./ComparisonTable";
import { Gift, Sparkles, Crown } from "lucide-react";

export default function PricingSection() {
  const pricingTiers: PricingTier[] = [
    {
      id: "free",
      name: "免费版",
      englishName: "Free",
      icon: Gift,
      price: "¥0",
      period: "永久",
      tagline: "适合想了解「教学设计」魅力的老师，先尝后买，零风险。",
      features: [
        "🎁 <strong>精选试听课</strong>：免费解锁至少<strong>2节核心概念课</strong>，听懂底层逻辑",
        "📚 <strong>干货博客</strong>：只有内行才懂的<strong>教学洞察文章</strong>",
        "🔔 <strong>新品优先知情权</strong>：第一时间获取<strong>最新课程动态</strong>"
      ],
      isFree: true,
      highlighted: false
    },
    {
      id: "plus",
      name: "会员版",
      englishName: "Plus",
      icon: Sparkles,
      price: "¥199",
      period: "年",
      tagline: "适合自驱力强的「自学者」，用几本书的价格，换一套完整的课程体系。",
      features: [
        "🎯 <strong>全站录播课通关</strong>：解锁<strong>40+节体系化视频课</strong>，从入门到精通",
        "🔄 <strong>持续更新</strong>：会员期内新增的录播课程，<strong>全部免费看</strong>",
        "👥 <strong>学习社群</strong>：加入学员大群，与<strong>400+位同行</strong>一起学习"
      ],
      notes: [
        "⚠️ 此档位不含直播拆解服务"
      ],
      buttonText: "领取系列课程",
      buttonLink: "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb",
      highlighted: true,
      badge: "最受欢迎",
      badgeColor: "bg-primary text-primary-foreground"
    },
    {
      id: "pro",
      name: "专家版",
      englishName: "Pro",
      icon: Crown,
      price: "¥990",
      period: "年",
      tagline: "适合全面拥抱 AI，且每天使用 AI 时长大于 1 小时的老师，帮助你全面掌握 AI 技术，帮助你用 AI 技术实现备课流程化，教学工程化。",
      features: [
        "✅ 享有<strong>教学通识课（Plus）的所有权益</strong>",
        "🎥 <strong>闭门直播（12场/年）</strong>：每月至少一场，深度拆解<strong>名师好课、真实改课案例</strong>或进行「work with me」式备课过程公开",
        "💻 <strong>教师AI课（Pro专属课程）</strong>：全面掌握AI技术，实现备课流程化<br/>• <strong>AI科普</strong>：系统讲解人工智能的核心概念和技术原理<br/>• <strong>AI工具测评</strong>：详细测评52个AI工具，解决52个教学问题<br/>• <strong>ClaudeCode教程</strong>：从安装、API配置，到skill、MCP，实现备课流程化"
      ],
      notes: [
        "🎯 此版本每年仅服务于100名专业老师"
      ],
      buttonText: "成为专业老师（限额招募）",
      buttonLink: "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb",
      highlighted: false,
      badge: "限额招募",
      badgeColor: "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
    }
  ];

  return (
    <section
      id="join"
      className="py-12 md:py-20 xl:py-32 px-4 bg-gradient-to-b from-background via-muted/30 to-background relative overflow-hidden"
    >
      {/* 装饰元素 */}
      <div className="hidden md:block absolute top-20 left-20 w-24 h-24 rounded-full bg-primary/10 deco-circle animate-pulse-slow" />
      <div className="hidden md:block absolute bottom-20 right-20 w-20 h-20 rounded-full bg-primary-glow/15 deco-circle" />
      <div className="hidden md:block absolute top-40 right-32 w-12 h-12 rounded-full bg-accent/20 deco-circle" />
      <div className="max-w-7xl mx-auto relative">
        {/* 标题区域 */}
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl xl:text-5xl font-black text-foreground mb-4">
            会员权益对比
          </h2>
          <p className="text-base md:text-lg xl:text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            清晰了解各版本权益，选择最适合你的学习方案
          </p>
        </div>

        {/* 详细对比表格 */}
        <div className="mb-12 md:mb-16">
          <ComparisonTable />
        </div>

        {/* 退款保障说明 - 信息卡片样式 */}
        <div className="max-w-2xl mx-auto animate-fade-in-up">
          <div className="bg-gradient-to-r from-primary/5 via-primary-glow/5 to-primary/5 rounded-2xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">🛡️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">退款保障</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  购买后<strong className="text-primary">{"7天内"}</strong>不满意可随时申请退款，<strong className="text-primary">{"7天内"}</strong>体验我们的课程服务
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
