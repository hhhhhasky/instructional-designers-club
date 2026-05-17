import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ExternalLink, FileText } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";

// 文章数据
const articles = [
  {
    title: "教师主导的教学与以学生为中心的学习是对立的？",
    type: "translation",
    links: [
      { label: "译文链接", url: "http://xhslink.com/a/aL5Cg6BXMF7cb" },
      { label: "原文链接", url: "https://teacherhead.com/2019/12/08/myth-teacher-led-instruction-and-student-centred-learning-are-opposites/?share=jetpack-whatsapp&nb=1" }
    ]
  },
  {
    title: "哈佛大学大脑认知科学：为什么学过的记不住",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/685d07c80000000012022d14?source=webshare&xhsshare=pc_web&xsec_token=ABsZgc9w6jQ0yuv0zZ8PoeOkDl3Bz3EDL8SNQ4OUKS8mU=&xsec_source=pc_share" }
    ]
  },
  {
    title: "高手这么设计教学PPT：教师省事，提分有效",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/6853c1b5000000001703031b?source=webshare&xhsshare=pc_web&xsec_token=ABVSBtFpDGGndecfFYD5z68eQzjSGX7_k-uMKwiU1rGNg=&xsec_source=pc_share" }
    ]
  },
  {
    title: "教学设计经典论文 | 少教不教为什么不管用？",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/684012a3000000000f033939?source=webshare&xhsshare=pc_web&xsec_token=ABYXRtvREUSM0kJqXqBCZCV3EM0FFqsvakrjZF-TTsiwM=&xsec_source=pc_share" }
    ]
  },
  {
    title: "教师的班级管理课：比尔·罗杰斯的十大理念",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/68355815000000000303f973?source=webshare&xhsshare=pc_web&xsec_token=AB-aN-giAQbPX0LHBh5OvM50uFVzMcpAQ5uGBEFGZ0A8g=&xsec_source=pc_share" }
    ]
  },
  {
    title: "教学策略：让学生越学越会的10种记忆练习",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/683083dd0000000012004bbf?source=webshare&xhsshare=pc_web&xsec_token=ABJNuh8xyKtjI1g38S30CEuARO00MQBeK5KAe7hKYnDSA=&xsec_source=pc_share" }
    ]
  },
  {
    title: "翻译 | Cold Call：老师必备的课堂提问五步",
    type: "translation",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/6829ce39000000000c03a8b8?source=webshare&xhsshare=pc_web&xsec_token=ABengL3LNW0KAwHmZ6syZUqs-9XyWYttTQb24-86hqOWU=&xsec_source=pc_share" }
    ]
  },
  {
    title: "教知识，还是教思维？",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/68258eac000000001101c37c?source=webshare&xhsshare=pc_web&xsec_token=ABzKtIsm0pTXWghDEkIMA-V7zCytpARAmQnQgy84Yaqfk=&xsec_source=pc_share" }
    ]
  },
  {
    title: "学科知识与教学技巧：哪个更重要",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/682357ea000000001101eb9d?source=webshare&xhsshare=pc_web&xsec_token=ABxvfLOf_EH8wfRlEVXwWZ2_rBrNqKKyOQmYvTZoSgiqQ=&xsec_source=pc_share" }
    ]
  },
  {
    title: "新书精华翻译 | 显性教学被老师们大大低估",
    type: "translation",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/68216133000000000c03a549?source=webshare&xhsshare=pc_web&xsec_token=ABqbdMizcWKCZto7a5gh1Dc-DXk-dk-tH23kOAK-J-sS0=&xsec_source=pc_share" }
    ]
  },
  {
    title: "优质教育博客 | 教学到底是艺术还是技术？",
    type: "article",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/681d73bf000000000f030791?source=webshare&xhsshare=pc_web&xsec_token=ABWFmMIkceyw72NOeVCYOOcOC2jE9Bu_efUuYOVYL3c4M=&xsec_source=pc_share" }
    ]
  },
  {
    title: "外文翻译 | 这样培养成长型思维，效果微弱",
    type: "translation",
    links: [
      { label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/681c3b680000000012007b1a?source=webshare&xhsshare=pc_web&xsec_token=ABcsaZIlSCsq9ksgDXpye5i8nXhdtSm7DgYf1y3tYTA3Q=&xsec_source=pc_share" }
    ]
  },
  {
    title: "我最近发现，新老师们普遍对教学存在几种误解，以至于在备课上课上走了弯路。",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/OTmKerjMYGR3kQWrq14IfQ" }
    ]
  },
  {
    title: "建构主义的知识观：知识是被发现的，还是被发明的？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/9wywvx0kUnEIq3dOilpJDA" }
    ]
  },
  {
    title: "为什么要搞合作学习？我自己学，自己建构知识，不可以吗？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/n7lNKnQ2jSv9ucRPhs7-zw" }
    ]
  },
  {
    title: "建构主义十问十答：一篇文章回应你对建构主义所有的误解和困惑",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Q6qTMj5nyxIYcgfJdhbonA" }
    ]
  },
  {
    title: "从技术的角度，重新理解建构主义，老师们需要重构自己的「技术观」。",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/g2Yvt_VkEWKLY7_1UAOzAQ" }
    ]
  },
  {
    title: "教学设计思考：为什么很多老师最终不得不选择传统的教学方式？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/nuzdiXCV7nWT3H9l4Vl2rQ" }
    ]
  },
  {
    title: "地图不等于疆界：老师们，别被理论框死了，它只是你的「工具箱」",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/s8PBVW3dLBiatMWD66Dzhw" }
    ]
  },
  {
    title: "教学培训就好像AI调优，数据、算法、算力，三者缺一不可",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Z13o4InxO10IuTDfjkOiSw" }
    ]
  },
  {
    title: "追求「花样教学」，不如追求「系统化」的教学设计",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Zz8gtYIUNVP--QdgoMPFJQ" }
    ]
  },
  {
    title: "反思布卢姆：为何同一知识点的题目难度天壤之别？以2023年北京数学中考试卷为例",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/wwh0fNVK5BwpQfteIhC8Dg" }
    ]
  },
  {
    title: "一篇课文，四种上法：语文课的教学设计可能性远比你想的多",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/qqlgh1lIalemF8wYaYdLnQ" }
    ]
  },
  {
    title: "写好教学目标，既是教学设计的第一步，也是教学设计进阶的第一步 | 教学设计101Course第2课：教学目标分析",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/_g_JG90QM0dRibkDcyMkog" }
    ]
  },
  {
    title: "建构主义教学的迷思：为何主动探索不等于有效学习？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/rmPkbLdEZ8nAHkSXnczE_g" }
    ]
  },
  {
    title: "教学设计101 Course：01 什么是教学设计？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Nxs9nmR3vLMpv92Ys7W3HQ" }
    ]
  },
  {
    title: "你为什么要这么上这节课？为什么你要用游戏化/项目式/探究式学习？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/UmpJwXMRkNfKJireMAbkCA" }
    ]
  },
  {
    title: "专家和新手到底差在哪里？| 浅聊认知负荷理论",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/29pgYZzyNrXKLgMkG5rMAg" }
    ]
  },
  {
    title: "为了理解科学的教学：学生概念研究，以及学习视角的改变（2002年）",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/p37J_2_eMw-SPfKSRb-LDg" }
    ]
  },
  {
    title: "编程入门阶段学生的误解以及其他困难：一篇文献综述",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/jR-a0sV3_RH5JY27p9ukbw" }
    ]
  },
  {
    title: "聊聊学习体验设计 | Learning Experience Design| LXD",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/o12J8wiZ8uMDyw96ZOTE0w" }
    ]
  },
  {
    title: "建构主义：从哲学到实践（1997年）",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/lDqnO7C6PnJmuLbItnZBWw" }
    ]
  },
  {
    title: "拒绝假情境 | 浅谈情境教学",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/9YQcdDYtQwoInTHwgUMR6g" }
    ]
  },
  {
    title: "抽象的儿童与具体的儿童 | 浅谈理解儿童",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Lfrc68i0OWOrNRwuTib-FQ" }
    ]
  },
  {
    title: "放纵儿童？教训儿童？| 面对儿童行为问题的三个核心原则",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/SkC3ZD8WyUYuoRSefouiBQ" }
    ]
  },
  {
    title: "拉出教室就是真实性的学习吗？ | 浅谈真实性",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/u7fkmfZBxQBPgCc5Uia1ug" }
    ]
  },
  {
    title: "如何观察和分析幼儿行为？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/wGz3R8LhV-gku-DJSB2Y_A" }
    ]
  },
  {
    title: "PBL、克伯屈与杜威｜PBL利弊谈",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/iVYaR_Z8rloPwmv5lA4VUQ" }
    ]
  },
  {
    title: "大概念、学科结构与布鲁纳 | 大概念利弊谈",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/j5FVHKFEEeIyacoArLB0Pg" }
    ]
  },
  {
    title: "儿童中心是普世价值吗？| 进步主义教育利弊谈",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/MllntU-Wwz3jiDfnwLL91A" }
    ]
  },
  {
    title: "如何激发学习者的学习兴趣？",
    type: "wechat",
    links: [
      { label: "阅读全文", url: "https://mp.weixin.qq.com/s/Xb7cib0N5iLstGZuHvJveg" }
    ]
  }
];

export default function ResourcesPage() {
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "translation":
        return { label: "翻译", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
      case "wechat":
        return { label: "公众号", color: "bg-green-500/10 text-green-600 border-green-500/20" };
      default:
        return { label: "文章", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      {/* Hero Section */}
      <section className="relative py-20 xl:py-32 px-4 overflow-hidden gradient-animate pt-32 xl:pt-40">
        <div className="absolute top-20 right-10 w-72 h-72 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">

          <h1 className="text-4xl xl:text-6xl font-ds-bold text-tx tracking-tight drop-shadow-sm animate-fade-in-down" style={{ fontFamily: 'var(--fd)' }}>
            资源中心
          </h1>
          <p className="text-lg xl:text-2xl text-tx max-w-3xl mx-auto leading-relaxed font-medium animate-fade-in-up">
            精选<span className="gradient-text">教学设计</span>文章与翻译作品
          </p>
        </div>
      </section>
      {/* 文章列表 */}
      <section className="py-12 xl:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <BookOpen className="w-6 h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl xl:text-3xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>全部文章</h2>
            <span className="text-sm text-txs">共 {articles.length} 篇</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {articles.map((article, index) => {
              const typeInfo = getTypeLabel(article.type);
              return (
                <Card key={index} className="border-bd shadow-sm hover-lift hover-glow transition-all duration-300 group animate-fade-in-up">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg xl:text-xl group-hover:text-ac transition-colors">
                        {article.title}
                      </CardTitle>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 hover-scale transition-transform duration-300 ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {article.links.map((link, linkIndex) => (
                        <a
                          key={linkIndex}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warm hover:bg-acl text-sm font-medium text-tx hover:text-ac transition-all hover:scale-105 hover:shadow-md"
                        >
                          <ExternalLink className="w-4 h-4 transition-transform group-hover:rotate-12" />
                          <span>{link.label}</span>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
