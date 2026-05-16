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
          tier === 'pro' ? 'text-amber-600' : 
          tier === 'plus' ? 'text-blue-600' : 
          'text-green-600'
        }`} />
      ) : (
        <X className="w-5 h-5 mx-auto text-muted-foreground/30" />
      );
    }
    
    if (typeof value === 'number' && value === 0) {
      return <X className="w-5 h-5 mx-auto text-muted-foreground/30" />;
    }
    
    return (
      <span className={`font-medium ${
        tier === 'pro' ? 'text-amber-700' : 
        tier === 'plus' ? 'text-blue-700' : 
        'text-green-700'
      }`}>
        {value}
      </span>
    );
  };

  return (
    <div className="w-full space-y-10 md:space-y-12">
      {/* 说明区域 */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-black text-foreground mb-3 text-lg md:text-xl">版本对比说明</h3>
              <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
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
            <tr className="border-b-2 border-border">
              <th className="text-left p-4 font-bold text-foreground w-1/4">功能项目</th>
              <th className="text-center p-4 w-1/4">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-foreground">免费版</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Free</span>
                </div>
              </th>
              <th className="text-center p-4 w-1/4 bg-blue-50/50">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-foreground">教学通识课</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Plus</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                    最受欢迎
                  </span>
                </div>
              </th>
              <th className="text-center p-4 w-1/4 bg-amber-50/50">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-foreground">教师AI课</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Pro</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">
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
                <tr key={`category-${categoryIndex}`} className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <td colSpan={4} className="p-6 font-black text-foreground text-xl md:text-2xl border-t-4 border-primary/30">
                    {category}
                  </td>
                </tr>
                
                {/* 功能行 - 增加间距 */}
                {categoryFeatures.map((feature, featureIndex) => (
                  <tr 
                    key={`feature-${categoryIndex}-${featureIndex}`}
                    className="border-b border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="p-5 md:p-6">
                      <div>
                        <div className="font-bold text-foreground text-base md:text-lg mb-2">{feature.name}</div>
                        {feature.description && (
                          <div className="text-sm text-muted-foreground leading-relaxed">{feature.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-5 md:p-6 text-center">
                      {renderCell(feature.free, 'free')}
                    </td>
                    <td className="p-5 md:p-6 text-center bg-blue-50/30">
                      {renderCell(feature.plus, 'plus')}
                    </td>
                    <td className="p-5 md:p-6 text-center bg-amber-50/30">
                      {renderCell(feature.pro, 'pro')}
                    </td>
                  </tr>
                ))}
                
                {/* 区块间增加空白行 */}
                {categoryIndex < Object.keys(groupedFeatures).length - 1 && (
                  <tr key={`spacer-${categoryIndex}`} className="h-4 md:h-6">
                    <td colSpan={4} className="bg-background"></td>
                  </tr>
                )}
              </>
            ))}
            
            {/* 价格行 - 特殊样式 */}
            <tr className="bg-gradient-to-r from-primary/5 to-primary/10 border-t-4 border-primary/30">
              <td className="p-6 font-black text-foreground text-xl md:text-2xl">
                价格
              </td>
              <td className="p-6 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-black text-green-700">¥0</span>
                  <span className="text-sm text-muted-foreground">永久免费</span>
                </div>
              </td>
              <td className="p-6 text-center bg-blue-50/50">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-black text-blue-700">¥199</span>
                  <span className="text-sm text-muted-foreground">/ 年</span>
                </div>
              </td>
              <td className="p-6 text-center bg-amber-50/50">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-black text-amber-700">¥990</span>
                  <span className="text-sm text-muted-foreground">/ 年</span>
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
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b-4 border-primary/30">
              <CardTitle className="text-xl md:text-2xl font-black">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {categoryFeatures.map((feature, featureIndex) => (
                <div key={`mobile-feature-${categoryIndex}-${featureIndex}`} className="space-y-3">
                  <div className="font-bold text-base text-foreground">{feature.name}</div>
                  {feature.description && (
                    <div className="text-sm text-muted-foreground leading-relaxed">{feature.description}</div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {/* Free */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-green-50 border-2 border-green-200">
                      <Gift className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-700">Free</span>
                      <div className="text-center w-full">
                        {renderCell(feature.free, 'free')}
                      </div>
                    </div>
                    
                    {/* Plus */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-blue-50 border-2 border-blue-200">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-blue-700">Plus</span>
                      <div className="text-center w-full">
                        {renderCell(feature.plus, 'plus')}
                      </div>
                    </div>
                    
                    {/* Pro */}
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-amber-50 border-2 border-amber-200">
                      <Crown className="w-5 h-5 text-amber-600" />
                      <span className="font-bold text-amber-700">Pro</span>
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

      {/* 总结区域 */}
      <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Crown className="w-7 h-7 md:w-8 md:h-8 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-black text-foreground mb-4 text-xl md:text-2xl">教师AI课（Pro）核心优势</h3>
              <ul className="space-y-3 text-sm md:text-base text-foreground/80 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">全面AI赋能：</strong>AI科普 + 52个工具测评 + ClaudeCode完整教程，实现备课流程化</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">深度学习机会：</strong>每月至少1场闭门直播，深度拆解名师好课和真实改课案例</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">教学工程化：</strong>从教学科学化进阶到教学工程化，让教学更高效、更智能</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">限额服务：</strong>每年仅服务100名专业老师，确保高质量学习体验</span>
                </li>
              </ul>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg text-base md:text-lg py-6">
                  <a href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb" target="_blank" rel="noopener noreferrer">
                    <Crown className="w-5 h-5 mr-2" />
                    成为教师AI课（Pro）专家（限额招募）
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-base md:text-lg py-6">
                  <a href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb" target="_blank" rel="noopener noreferrer">
                    <Sparkles className="w-5 h-5 mr-2" />
                    选择教学通识课（Plus）
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 常见问题链接 */}
      <div className="text-center">
        <p className="text-sm md:text-base text-muted-foreground mb-4">
          还有疑问？查看我们的常见问题解答
        </p>
        <Button asChild variant="link" className="text-primary text-base">
          <a href="#faq">
            查看常见问题 →
          </a>
        </Button>
      </div>
    </div>
  );
}
