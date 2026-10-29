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
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const data = await getResources({ fresh: true });
        if (cancelled) return;
        const seen = new Set<string>();
        setArticles(data.map(toArticle).filter((article) => {
          const key = JSON.stringify([article.title, article.type, article.links]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

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

          <h1 className="text-3xl font-bold text-tx tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
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
            <h2 className="text-2xl font-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>全部文章</h2>
            <span className="text-sm text-txs">{loading ? "正在加载…" : failed ? "暂时无法加载" : `共 ${articles.length} 篇`}</span>
          </div>

          {failed && <div role="alert" className="mb-6 rounded-lg border border-bd bg-white p-5 text-sm text-txs">文章暂时加载失败，请检查网络后重试。 <button type="button" onClick={() => setAttempt(value => value + 1)} className="font-semibold text-ac hover:underline">重新加载</button></div>}
          {!loading && !failed && articles.length === 0 && <p className="py-8 text-sm text-txs">暂无文章。</p>}
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
