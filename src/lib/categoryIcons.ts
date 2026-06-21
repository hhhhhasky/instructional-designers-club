import {
  Award,
  BookOpen,
  Brain,
  Compass,
  Layers,
  Lightbulb,
  Puzzle,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// 教师AI课 / 教学通识课共用的「系列(category)」图标映射
const categoryIconConfig: Record<string, LucideIcon> = {
  教学设计: Lightbulb,
  教学目标: Target,
  认知负荷理论: Brain,
  建构主义: Puzzle,
  应用学习科学: Rocket,
  PBL项目式学习: Compass,
  真实任务设计: Zap,
  罗森海恩共读: Award,
  课堂管理: TrendingUp,
  教学评估: TrendingUp,
  教学幻象: Sparkles,
  AI工具应用: Layers,
  教育技术: Layers,
  ClaudeCode教程: Layers,
  AI科普: Brain,
  AI工具测评: Layers,
};

export const getCategoryIcon = (category: string): LucideIcon => {
  if (categoryIconConfig[category]) return categoryIconConfig[category];
  for (const key in categoryIconConfig) {
    if (category.includes(key) || key.includes(category)) return categoryIconConfig[key];
  }
  return BookOpen;
};
