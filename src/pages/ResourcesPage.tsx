import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";
import PageBackBar from "@/components/common/PageBackBar";
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
  translation: { label: "翻译", color: "bg-steel-soft text-steel border-steel/20" },
  wechat: { label: "公众号", color: "bg-sage-soft text-sage border-sage/20" },
  article: { label: "文章", color: "bg-brown-soft text-brown border-brown/20" },
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
      <PageBackBar />
      {/* Hero Section */}
      <section className="border-b border-bd px-4 py-8 md:py-10">

        <div className="max-w-6xl mx-auto space-y-3">

          <h1 className="text-3xl md:text-4xl font-ds-bold text-tx tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
            资源中心
          </h1>
          <p className="max-w-3xl text-base leading-7 text-txs">
            精选<span className="gradient-text">教学设计</span>文章与翻译作品
          </p>
        </div>
      </section>
      {/* 文章列表 */}
      <section className="px-4 py-8 md:py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <BookOpen className="w-5 h-5 text-ac" />
            <h2 className="text-xl md:text-2xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>全部文章</h2>
            <span className="text-sm text-txs">共 {articles.length} 篇</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {articles.map((article, index) => {
              const typeInfo = getTypeInfo(article.type);
              return (
                <Card key={index} className="border-bd shadow-none transition-colors hover:border-ac/30 group">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg leading-7 group-hover:text-ac transition-colors">
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
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warm hover:bg-acl text-sm font-medium text-tx hover:text-ac transition-all "
                        >
                          <ExternalLink className="w-4 h-4 transition-transform group-" />
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
