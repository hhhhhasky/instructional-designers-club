import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";
import PageMeta from "@/components/common/PageMeta";
import { getResources } from "@/db/api";
import type { Resource, ResourceType } from "@/types/types";

interface Article {
  title: string;
  type: ResourceType;
  links: { label: string; url: string }[];
}

// 兜底数据：后台未配置 / 查询失败时使用，保证页面永不空白。
const FALLBACK_ARTICLES: Article[] = [
  { title: "教师主导的教学与以学生为中心的学习是对立的？", type: "translation", links: [{ label: "译文链接", url: "http://xhslink.com/a/aL5Cg6BXMF7cb" }, { label: "原文链接", url: "https://teacherhead.com/2019/12/08/myth-teacher-led-instruction-and-student-centred-learning-are-opposites/?share=jetpack-whatsapp&nb=1" }] },
  { title: "哈佛大学大脑认知科学：为什么学过的记不住", type: "article", links: [{ label: "阅读全文", url: "https://www.xiaohongshu.com/discovery/item/685d07c80000000012022d14?source=webshare&xhsshare=pc_web&xsec_token=ABsZgc9w6jQ0yuv0zZ8PoeOkDl3Bz3EDL8SNQ4OUKS8mU=&xsec_source=pc_share" }] },
];

function toArticle(r: Resource): Article {
  return {
    title: r.title,
    type: r.resource_type,
    links: Array.isArray(r.links) ? r.links : [],
  };
}

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  translation: { label: "翻译", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  wechat: { label: "公众号", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  article: { label: "文章", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

export default function ResourcesPage() {
  const [articles, setArticles] = useState<Article[]>(FALLBACK_ARTICLES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getResources();
        if (cancelled) return;
        // 出错才走兜底；成功但为空（运营清空）则显示空，尊重运营操作。
        setArticles(data.map(toArticle));
      } catch {
        if (!cancelled) setArticles(FALLBACK_ARTICLES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getTypeInfo = (type: string) =>
    TYPE_STYLES[type] ?? { label: "文章", color: TYPE_STYLES.article.color };

  return (
    <>
      <PageMeta
        title="资源中心"
        description="精选教学设计文章与翻译作品，涵盖认知负荷理论、建构主义、PBL项目式学习等教学设计前沿话题。"
        canonicalPath="/resources"
        keywords="教学设计文章,教育翻译,教学理论,教学资源"
      />
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
              const typeInfo = getTypeInfo(article.type);
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
    </>
  );
}
