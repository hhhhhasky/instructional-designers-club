import { useEffect, useState } from "react";
import { getHomePageSnapshot, type ClubStats, type HomeCourseBuckets } from "@/db/api";
import type { Course, MemberProfile, Faq, SiteContent, Testimonial } from "@/types/types";

// 首页可变内容的统一读取入口（带兜底）。
// 后台未配置 / 表未建 / 查询失败时，回退到当前硬编码内容，保证页面永不空白。

export interface HomeContent {
  loaded: boolean;
  hero: {
    title_line1: string;
    title_line2: string;
    subtitle: string;
    cta_text: string;
    cta_link: string;
  };
  intro: {
    section_title: string;
    section_subtitle: string;
    welcome_title: string;
    welcome_paragraphs: string[];
    product_intro_heading: string;
    plus_text: string;
    pro_text: string;
  };
  values: {
    values_title: string;
    values_subtitle: string;
    items: { emoji: string; text: string }[];
  };
  founder: {
    section_title: string;
    avatar_url: string;
    avatar_alt: string;
    name: string;
    motto: string;
    tags: { icon: string; label: string; color: string }[];
    info_items: { icon: string; label: string; text: string; color: string }[];
    stats: { icon: string; value: string; label: string; color: string }[];
  };
  stats: {
    section_title: string;
    section_subtitle: string;
    start_date: string;
    footnote: string;
  };
  membersMeta: {
    section_title: string;
    subtitle: string;
    footnote: string;
    cta_text: string;
    cta_link: string;
    cta_hint: string;
  };
  members: MemberProfile[];
  testimonialsMeta: {
    section_title: string;
    autoplay_ms: number;
    footnote: string;
  };
  testimonials: Testimonial[];
  faqTitle: string;
  faqs: Faq[];
  statsCounts: ClubStats;
  homeCourses: HomeCourseBuckets;
  loadingHomeCourses: boolean;
}

const asStr = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const asStrArr = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : fallback;
const asNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : fallback;
const pickArr = <T,>(v: unknown, fallback: T[]): T[] =>
  Array.isArray(v) && v.length > 0 ? (v as T[]) : fallback;

// ==================== 兜底默认值（= 当前硬编码内容） ====================

export const DEFAULT_HERO = {
  title_line1: "让每一堂课，",
  title_line2: "都值得被认真对待",
  subtitle: "一所AI时代的线上创新师范学院",
  cta_text: "申请成为会员",
  cta_link: "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb",
};

export const DEFAULT_INTRO = {
  section_title: "俱乐部介绍",
  section_subtitle: "为认真对待每一堂课的老师而建",
  welcome_title: "欢迎加入我们",
  welcome_paragraphs: [
    "教学设计师俱乐部是一个为教育者打造的共学社区。",
    "我们不认为教学只是“完成任务”——我们相信，好的教学是可以被设计、被打磨、被持续精进的技艺。",
    "在这里，你不会听到“三步搞定公开课”这样的承诺。你得到的是一套系统的 **教学设计方法论（CREATE 模型）**，帮助你把对教育的理解，变成每一节课里真实发生的学习。",
    "无论你教什么学科、在什么类型的学校，只要你还在思考“怎样让学生真正学到东西”——这里就有懂你的同行者。",
  ],
  product_intro_heading: "在俱乐部中，包括 Plus 和 Pro 两大会员产品：",
  plus_text:
    "Plus会员：包含 **70+节教学通识课** + 专属答疑社区。它帮你建立一套完整的教学设计思维框架——从理解学生如何学习，到设计有效的学习活动，再到评估学习效果。适合想要 **系统精进教学设计能力**、让日常教学更有章法的老师。",
  pro_text:
    "Pro会员：在 Plus 的基础上，增加了 **30+节教师 AI 课**，以及我研发的 **AI工具、网站、skill等资源包**。它不是教你用AI“代替备课”，而是教你用AI延伸教学设计的深度和广度——从教学分析、活动设计到课程开发，让AI成为你教学思考的协作伙伴。适合愿意深度实践、探索教学新可能的老师。",
};

export const DEFAULT_VALUES = {
  values_title: "我们相信的教学观",
  values_subtitle: "这些信念塑造了我们教什么、怎么教。如果你也认同，我们可能是同行者。",
  items: [
    { emoji: "✨", text: "**专业方法**先于直觉和经验" },
    { emoji: "🎯", text: "**学习是可以被优化的**" },
    { emoji: "🔬", text: "有效的教学是**科学循证的**" },
    { emoji: "⚡", text: "优质的教学是**有效果、有参与度、有效率的**" },
    { emoji: "🤝", text: "**尊重学习者的主体性**" },
    { emoji: "🧩", text: "**复杂的事物可以被拆解**" },
  ],
};

export const DEFAULT_FOUNDER = {
  section_title: "俱乐部创始人",
  avatar_url:
    "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png",
  avatar_alt: "哈老师",
  name: "哈老师",
  motto: "教学是艺术和科学，更是工程和技术",
  tags: [
    { icon: "GraduationCap", label: "教学专家", color: "ac" },
    { icon: "Bot", label: "开发小白", color: "am" },
    { icon: "TrendingUp", label: "一人公司", color: "pp" },
  ],
  info_items: [
    { icon: "Lightbulb", label: "愿景", text: "做一所 AI 时代的创新师范学院", color: "am" },
    { icon: "BookOpen", label: "产品", text: "教学通识课 / 教师AI课", color: "ac" },
    { icon: "Users", label: "社区", text: "教学设计师俱乐部", color: "tl" },
  ],
  stats: [
    { icon: "Brain", value: "6h+", label: "每日AI", color: "pp" },
    { icon: "Bot", value: "80%", label: "AI外包", color: "am" },
    { icon: "BookOpen", value: "数百节", label: "师培课", color: "ac" },
    { icon: "UserCheck", value: "数千名", label: "师支持", color: "tl" },
    { icon: "TrendingUp", value: "数万名", label: "全网粉", color: "rose" },
  ],
};

export const DEFAULT_STATS = {
  section_title: "俱乐部数据",
  section_subtitle: "持续成长的学习社区",
  start_date: "2025-03-31",
  footnote: "💪 持续成长的学习社群，与几百位教育者一起探索AI时代的教学设计",
};

export const DEFAULT_MEMBERS_META = {
  section_title: "部分会员简介",
  subtitle: "来自不同领域的优秀教育者都在这里学习成长",
  footnote: "🌟 他们来自不同学校、不同学科，但有一个共同点：都在认真思考怎样让学生真正学到东西",
  cta_text: "申请成为会员",
  cta_link: "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb",
  cta_hint: "点击按钮填写报名表单，开启你的学习之旅",
};

export const DEFAULT_MEMBERS: MemberProfile[] = [
  { id: "d1", icon: "👶", name: "某高校幼儿教育L老师", description: "专注幼儿教育理论与实践研究", sort_order: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "d2", icon: "💭", name: "独立人文思辨教育Z老师", description: "致力于培养学生批判性思维", sort_order: 2, is_active: true, created_at: "", updated_at: "" },
  { id: "d3", icon: "📐", name: "某小学数学教研员M老师", description: "小学数学教学研究与指导专家", sort_order: 3, is_active: true, created_at: "", updated_at: "" },
  { id: "d4", icon: "⚛️", name: "某高中物理L老师", description: "高中物理教学创新实践者", sort_order: 4, is_active: true, created_at: "", updated_at: "" },
  { id: "d5", icon: "🏛️", name: "某中学政治R老师", description: "中学政治课程设计与教学", sort_order: 5, is_active: true, created_at: "", updated_at: "" },
  { id: "d6", icon: "🌍", name: "某高中英语M老师", description: "高中英语教学与跨文化交流", sort_order: 6, is_active: true, created_at: "", updated_at: "" },
  { id: "d7", icon: "🎯", name: "广州一土数学老师", description: "创新教育理念的践行者", sort_order: 7, is_active: true, created_at: "", updated_at: "" },
  { id: "d8", icon: "💡", name: "青少年创新PBL课程L老师", description: "项目式学习课程设计专家", sort_order: 8, is_active: true, created_at: "", updated_at: "" },
  { id: "d9", icon: "🌱", name: "厌学青少年疗愈导师J老师", description: "青少年心理疗愈与学习动力激发", sort_order: 9, is_active: true, created_at: "", updated_at: "" },
  { id: "d10", icon: "🌐", name: "某IB学校L老师", description: "国际文凭课程教学实践者", sort_order: 10, is_active: true, created_at: "", updated_at: "" },
  { id: "d11", icon: "🎓", name: "某大学教学设计在读博士", description: "教学设计理论深度研究者", sort_order: 11, is_active: true, created_at: "", updated_at: "" },
];

export const DEFAULT_TESTIMONIALS_META = {
  section_title: "会员老师们这么说",
  autoplay_ms: 5000,
  footnote: "来自俱乐部会员老师的真实反馈，他们在这里收获了专业成长和教学突破",
};

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "t1", image_url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xs.jpg", alt_text: "会员评价：新一期大大的期待！上一期的真实任务实操性真是受益匪浅", author: null, sort_order: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "t2", image_url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xu.jpg", alt_text: "会员评价：你真是做了好多非常好的归纳总结提炼", author: null, sort_order: 2, is_active: true, created_at: "", updated_at: "" },
  { id: "t3", image_url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf083k.jpg", alt_text: "会员评价：感觉把你的课吃透，我一家B轮融资的企业去做内训师", author: null, sort_order: 3, is_active: true, created_at: "", updated_at: "" },
  { id: "t4", image_url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xt.jpg", alt_text: "会员评价：哈老师您的思路真的很好，但是我有点疑问", author: null, sort_order: 4, is_active: true, created_at: "", updated_at: "" },
  { id: "t5", image_url: "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf1gcg.jpg", alt_text: "会员评价：很喜欢您的课，接地气，也有深度", author: null, sort_order: 5, is_active: true, created_at: "", updated_at: "" },
];

export const DEFAULT_FAQ_TITLE = "FAQ 常见问题解答";

export const DEFAULT_FAQS: Faq[] = [
  { id: "f1", question: "Q1：俱乐部的课程适合哪些学段、哪些学科的老师？", answer: "适合全学段全学科，从小学到高校均可。课程聚焦的是教学设计的底层方法论——理解学习、设计教学、评估效果——这些能力在任何学科、任何学段都通用。我们也有不同的学科教研组，便于大家在具体的教学场景中讨论和应用。", sort_order: 1, is_active: true, created_at: "", updated_at: "" },
  { id: "f2", question: "Q2：俱乐部能提供一对一的课程指导吗？", answer: "不提供一对一指导，但是很欢迎大家在俱乐部内主动发起你的磨课会议。", sort_order: 2, is_active: true, created_at: "", updated_at: "" },
];

const FALLBACK: HomeContent = {
  loaded: false,
  hero: DEFAULT_HERO,
  intro: DEFAULT_INTRO,
  values: DEFAULT_VALUES,
  founder: DEFAULT_FOUNDER,
  stats: DEFAULT_STATS,
  membersMeta: DEFAULT_MEMBERS_META,
  members: DEFAULT_MEMBERS,
  testimonialsMeta: DEFAULT_TESTIMONIALS_META,
  testimonials: DEFAULT_TESTIMONIALS,
  faqTitle: DEFAULT_FAQ_TITLE,
  faqs: DEFAULT_FAQS,
  statsCounts: {
    camps: 0,
    courses: 0,
    totalMinutes: 0,
    members: 500,
  },
  homeCourses: {
    free: [],
    plus: [],
    pro: [],
  },
  loadingHomeCourses: true,
};

const d = (row: SiteContent | null | undefined): Record<string, unknown> => row?.data ?? {};

function buildHomeContentFromSnapshot(snapshot: Awaited<ReturnType<typeof getHomePageSnapshot>>): HomeContent {
  const siteContent = snapshot.site_content ?? {};
  const heroRow = siteContent.hero;
  const introRow = siteContent.introduction;
  const valuesRow = siteContent.club_values;
  const founderRow = siteContent.founder;
  const statsRow = siteContent.stats;
  const membersMetaRow = siteContent.members;
  const testimonialsMetaRow = siteContent.testimonials;
  const faqMetaRow = siteContent.faq;

  return {
    loaded: true,
    hero: {
      title_line1: asStr(d(heroRow).title_line1, DEFAULT_HERO.title_line1),
      title_line2: asStr(d(heroRow).title_line2, DEFAULT_HERO.title_line2),
      subtitle: asStr(d(heroRow).subtitle, DEFAULT_HERO.subtitle),
      cta_text: asStr(d(heroRow).cta_text, DEFAULT_HERO.cta_text),
      cta_link: asStr(d(heroRow).cta_link, DEFAULT_HERO.cta_link),
    },
    intro: {
      section_title: asStr(d(introRow).section_title, DEFAULT_INTRO.section_title),
      section_subtitle: asStr(d(introRow).section_subtitle, DEFAULT_INTRO.section_subtitle),
      welcome_title: asStr(d(introRow).welcome_title, DEFAULT_INTRO.welcome_title),
      welcome_paragraphs: asStrArr(d(introRow).welcome_paragraphs, DEFAULT_INTRO.welcome_paragraphs),
      product_intro_heading: asStr(d(introRow).product_intro_heading, DEFAULT_INTRO.product_intro_heading),
      plus_text: asStr(d(introRow).plus_text, DEFAULT_INTRO.plus_text),
      pro_text: asStr(d(introRow).pro_text, DEFAULT_INTRO.pro_text),
    },
    values: {
      values_title: asStr(d(valuesRow).values_title, DEFAULT_VALUES.values_title),
      values_subtitle: asStr(d(valuesRow).values_subtitle, DEFAULT_VALUES.values_subtitle),
      items: pickArr(d(valuesRow).items, DEFAULT_VALUES.items),
    },
    founder: {
      section_title: asStr(d(founderRow).section_title, DEFAULT_FOUNDER.section_title),
      avatar_url: asStr(d(founderRow).avatar_url, DEFAULT_FOUNDER.avatar_url),
      avatar_alt: asStr(d(founderRow).avatar_alt, DEFAULT_FOUNDER.avatar_alt),
      name: asStr(d(founderRow).name, DEFAULT_FOUNDER.name),
      motto: asStr(d(founderRow).motto, DEFAULT_FOUNDER.motto),
      tags: Array.isArray(d(founderRow).tags) ? (d(founderRow).tags as typeof DEFAULT_FOUNDER.tags) : DEFAULT_FOUNDER.tags,
      info_items: Array.isArray(d(founderRow).info_items) ? (d(founderRow).info_items as typeof DEFAULT_FOUNDER.info_items) : DEFAULT_FOUNDER.info_items,
      stats: Array.isArray(d(founderRow).stats) ? (d(founderRow).stats as typeof DEFAULT_FOUNDER.stats) : DEFAULT_FOUNDER.stats,
    },
    stats: {
      section_title: asStr(d(statsRow).section_title, DEFAULT_STATS.section_title),
      section_subtitle: asStr(d(statsRow).section_subtitle, DEFAULT_STATS.section_subtitle),
      start_date: asStr(d(statsRow).start_date, DEFAULT_STATS.start_date),
      footnote: asStr(d(statsRow).footnote, DEFAULT_STATS.footnote),
    },
    membersMeta: {
      section_title: asStr(d(membersMetaRow).section_title, DEFAULT_MEMBERS_META.section_title),
      subtitle: asStr(d(membersMetaRow).subtitle, DEFAULT_MEMBERS_META.subtitle),
      footnote: asStr(d(membersMetaRow).footnote, DEFAULT_MEMBERS_META.footnote),
      cta_text: asStr(d(membersMetaRow).cta_text, DEFAULT_MEMBERS_META.cta_text),
      cta_link: asStr(d(membersMetaRow).cta_link, DEFAULT_MEMBERS_META.cta_link),
      cta_hint: asStr(d(membersMetaRow).cta_hint, DEFAULT_MEMBERS_META.cta_hint),
    },
    testimonialsMeta: {
      section_title: asStr(d(testimonialsMetaRow).section_title, DEFAULT_TESTIMONIALS_META.section_title),
      autoplay_ms: asNum(d(testimonialsMetaRow).autoplay_ms, DEFAULT_TESTIMONIALS_META.autoplay_ms),
      footnote: asStr(d(testimonialsMetaRow).footnote, DEFAULT_TESTIMONIALS_META.footnote),
    },
    faqTitle: asStr(d(faqMetaRow).section_title, DEFAULT_FAQ_TITLE),
    members: Array.isArray(snapshot.member_profiles) ? snapshot.member_profiles : DEFAULT_MEMBERS,
    testimonials: Array.isArray(snapshot.testimonials) ? snapshot.testimonials : DEFAULT_TESTIMONIALS,
    faqs: Array.isArray(snapshot.faqs) ? snapshot.faqs : DEFAULT_FAQS,
    statsCounts: snapshot.stats_counts,
    homeCourses: {
      free: snapshot.home_courses.free as Course[],
      plus: snapshot.home_courses.plus as Course[],
      pro: snapshot.home_courses.pro as Course[],
    },
    loadingHomeCourses: false,
  };
}

export function useHomeContent(): HomeContent {
  const [content, setContent] = useState<HomeContent>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await getHomePageSnapshot();
        if (!cancelled) setContent(buildHomeContentFromSnapshot(snapshot));
      } catch (error) {
        console.error("加载首页内容快照失败:", error);
        if (!cancelled) setContent({ ...FALLBACK, loaded: true, loadingHomeCourses: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return content;
}
