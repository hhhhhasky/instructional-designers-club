import { Check, X, Minus, Gift, Sparkles, Crown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ComparisonFeature {
  category: string;
  name: string;
  free: string | boolean | number;
  plus: string | boolean | number;
  pro: string | boolean | number;
  description?: string;
}

export default function ComparisonTable() {
  const features: ComparisonFeature[] = [
    // 基础课程
    {
      category: "基础课程",
      name: "精选试听课",
      free: "2节核心课",
      plus: "全部试听",
      pro: "全部试听",
      description: "免费体验核心概念课程，听懂底层逻辑"
    },
    {
      category: "基础课程",
      name: "教学设计实操课",
      free: false,
      plus: "40+节体系化课程",
      pro: "40+节体系化课程",
      description: "从入门到精通的完整课程体系"
    },
    {
      category: "基础课程",
      name: "课程持续更新",
      free: false,
      plus: true,
      pro: true,
      description: "会员期内新增课程全部免费"
    },
    {
      category: "基础课程",
      name: "干货博客",
      free: true,
      plus: true,
      pro: true,
      description: "教学洞察文章，内行才懂的专业内容"
    },

    // 社群服务
    {
      category: "社群服务",
      name: "学习社群",
      free: false,
      plus: "500+位同行",
      pro: "500+位同行",
      description: "加入学员大群，与同行一起学习交流"
    },
    {
      category: "社群服务",
      name: "闭门直播",
      free: false,
      plus: false,
      pro: "12场/年",
      description: "每月至少1场，深度拆解名师好课、真实改课案例"
    },

    // 进阶课程
    {
      category: "进阶课程",
      name: "AI科普课程",
      free: false,
      plus: false,
      pro: true,
      description: "系统讲解人工智能核心概念和技术原理"
    },
    {
      category: "进阶课程",
      name: "AI工具测评",
      free: false,
      plus: false,
      pro: "52个工具",
      description: "详细测评52个AI工具，解决52个教学问题"
    },
    {
      category: "进阶课程",
      name: "ClaudeCode教程",
      free: false,
      plus: false,
      pro: "完整教程",
      description: "从安装、API配置到skill、MCP，实现备课流程化"
    }
  ];

  // 按类别分组
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, ComparisonFeature[]>);

  // 渲染单元格内容
  const renderCell = (value: string | boolean | number, tier: 'free' | 'plus' | 'pro') => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className={`w-5 h-5 mx-auto ${
          tier === 'pro' ? 'text-am' :
          tier === 'plus' ? 'text-ac' :
          'text-tl'
        }`} />
      ) : (
        <X className="w-5 h-5 mx-auto text-txt/30" />
      );
    }

    if (typeof value === 'number' && value === 0) {
      return <X className="w-5 h-5 mx-auto text-txt/30" />;
    }

    return (
      <span className={`font-medium ${
        tier === 'pro' ? 'text-am' :
        tier === 'plus' ? 'text-ac' :
        'text-tl'
      }`}>
        {value}
      </span>
    );
  };

  return (
    <div className="w-full space-y-10 md:space-y-12">
      {/* 说明区域 */}
      <Card className="border-2 border-ac/20 bg-gradient-to-r from-acl to-acl">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-ac mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-ds-black text-tx mb-3 text-lg md:text-xl" style={{ fontFamily: 'var(--fd)' }}>版本对比说明</h3>
              <p className="text-sm md:text-base text-txs leading-relaxed">
                以下表格详细对比了<strong>免费版</strong>、<strong>教学通识课（Plus）</strong>和<strong>教师AI课（Pro）</strong>的功能差异。
                教学通识课（Plus）适合自驱力强的自学者，教师AI课（Pro）适合全面拥抱AI、追求教学工程化的专业老师。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 对比表格 - 桌面端 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          {/* 表头 */}
          <thead>
            <tr className="border-b-2 border-bd">
              <th className="text-left p-4 font-bold text-tx w-1/4">功能项目</th>
              <th className="text-center p-4 w-1/4">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-tl" />
                    <span className="font-bold text-tx">免费版</span>
                  </div>
                  <span className="text-sm text-txs">Free</span>
                </div>
              </th>
              <th className="text-center p-4 w-1/4 bg-acl/40">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-ac" />
                    <span className="font-bold text-tx">教学通识课</span>
                  </div>
                  <span className="text-sm text-txs">Plus</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-ac text-white">
                    最受欢迎
                  </span>
                </div>
              </th>
              <th className="text-center p-4 w-1/4 bg-aml/40">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-am" />
                    <span className="font-bold text-tx">教师AI课</span>
                  </div>
                  <span className="text-sm text-txs">Pro</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-am text-white">
                    限额招募
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          {/* 表体 */}
          <tbody>
            {Object.entries(groupedFeatures).map(([category, categoryFeatures], categoryIndex) => (
              <>
                {/* 分类标题行 - 增大字号和间距 */}
                <tr key={`category-${categoryIndex}`} className="bg-gradient-to-r from-acl to-acl">
                  <td colSpan={4} className="p-6 font-ds-black text-tx text-xl md:text-2xl border-t-4 border-ac/30" style={{ fontFamily: 'var(--fd)' }}>
                    {category}
                  </td>
                </tr>

                {/* 功能行 - 增加间距 */}
                {categoryFeatures.map((feature, featureIndex) => (
                  <tr
                    key={`feature-${categoryIndex}-${featureIndex}`}
                    className="border-b border-bd hover:bg-warm/20 transition-colors"
                  >
                    <td className="p-5 md:p-6">
                      <div>
                        <div className="font-bold text-tx text-base md:text-lg mb-2">{feature.name}</div>
                        {feature.description && (
                          <div className="text-sm text-txs leading-relaxed">{feature.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-5 md:p-6 text-center">
                      {renderCell(feature.free, 'free')}
                    </td>
                    <td className="p-5 md:p-6 text-center bg-acl/20">
                      {renderCell(feature.plus, 'plus')}
                    </td>
                    <td className="p-5 md:p-6 text-center bg-aml/20">
                      {renderCell(feature.pro, 'pro')}
                    </td>
                  </tr>
                ))}

                {/* 区块间增加空白行 */}
                {categoryIndex < Object.keys(groupedFeatures).length - 1 && (
                  <tr key={`spacer-${categoryIndex}`} className="h-4 md:h-6">
                    <td colSpan={4} className="bg-cream"></td>
                  </tr>
                )}
              </>
            ))}

            {/* 价格行 - 特殊样式 */}
            <tr className="bg-gradient-to-r from-acl to-acl border-t-4 border-ac/30">
              <td className="p-6 font-ds-black text-tx text-xl md:text-2xl" style={{ fontFamily: 'var(--fd)' }}>
                价格
              </td>
              <td className="p-6 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-ds-black text-tl">¥0</span>
                  <span className="text-sm text-txs">永久免费</span>
                </div>
              </td>
              <td className="p-6 text-center bg-acl/40">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-ds-black text-ac">¥199</span>
                  <span className="text-sm text-txs">/ 年</span>
                </div>
              </td>
              <td className="p-6 text-center bg-aml/40">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-ds-black text-am">¥990</span>
                  <span className="text-sm text-txs">/ 年</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 对比表格 - 移动端 */}
      <div className="md:hidden space-y-8">
        {Object.entries(groupedFeatures).map(([category, categoryFeatures], categoryIndex) => (
          <Card key={`mobile-category-${categoryIndex}`} className="border-2">
            <CardHeader className="pb-4 bg-gradient-to-r from-acl to-acl border-b-4 border-ac/30">
              <CardTitle className="text-xl md:text-2xl font-ds-black" style={{ fontFamily: 'var(--fd)' }}>{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {categoryFeatures.map((feature, featureIndex) => (
                <div key={`mobile-feature-${categoryIndex}-${featureIndex}`} className="space-y-3">
                  <div className="font-bold text-base text-tx">{feature.name}</div>
                  {feature.description && (
                    <div className="text-sm text-txs leading-relaxed">{feature.description}</div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {/* Free */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-tll border-2 border-tl/30">
                      <Gift className="w-5 h-5 text-tl" />
                      <span className="font-bold text-tl">Free</span>
                      <div className="text-center w-full">
                        {renderCell(feature.free, 'free')}
                      </div>
                    </div>

                    {/* Plus */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-acl border-2 border-ac/30">
                      <Sparkles className="w-5 h-5 text-ac" />
                      <span className="font-bold text-ac">Plus</span>
                      <div className="text-center w-full">
                        {renderCell(feature.plus, 'plus')}
                      </div>
                    </div>

                    {/* Pro */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-aml border-2 border-am/30">
                      <Crown className="w-5 h-5 text-am" />
                      <span className="font-bold text-am">Pro</span>
                      <div className="text-center w-full">
                        {renderCell(feature.pro, 'pro')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>


      {/* 常见问题链接 */}
      <div className="text-center">
        <p className="text-sm md:text-base text-txs mb-4">
          还有疑问？查看我们的常见问题解答
        </p>
        <Button asChild variant="link" className="text-ac text-base">
          <a href="#faq">
            查看常见问题 →
          </a>
        </Button>
      </div>
    </div>
  );
}
