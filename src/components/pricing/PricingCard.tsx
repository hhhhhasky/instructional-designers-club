import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingTier {
  id: string;
  name: string;
  englishName: string;
  icon: React.ElementType;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  notes?: string[];
  buttonText?: string;
  buttonLink?: string;
  highlighted?: boolean;
  badge?: string;
  badgeColor?: string;
  isFree?: boolean;
}

interface PricingCardProps {
  tier: PricingTier;
  index: number;
}

export default function PricingCard({ tier, index }: PricingCardProps) {
  const Icon = tier.icon;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500",
        "hover:shadow-[var(--shadow-hover)] hover:-translate-y-2",
        tier.highlighted
          ? "border-2 border-primary shadow-[var(--shadow-elegant)] scale-105 md:scale-110 z-10"
          : "border border-border shadow-[var(--shadow-card)]",
        "animate-scale-in group"
      )}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* 推荐标签 */}
      {tier.badge && (
        <div
          className={cn(
            "absolute top-0 right-0 px-4 py-1 text-xs font-bold rounded-bl-xl z-20",
            "animate-pulse-slow",
            tier.badgeColor || "bg-primary text-primary-foreground"
          )}
        >
          {tier.badge}
        </div>
      )}
      {/* 背景装饰 */}
      {tier.highlighted && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary-glow/5 to-transparent pointer-events-none" />
          {/* 光晕效果 */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary-glow/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '1s' }} />
        </>
      )}
      <CardHeader className="relative pb-4">
        {/* 图标 */}
        <div
          className={cn(
            "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center relative",
            "transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
            tier.highlighted
              ? "bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-glow)]"
              : "bg-gradient-to-br from-muted to-muted/50"
          )}
        >
          {tier.highlighted && (
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl animate-pulse-slow" />
          )}
          <Icon
            className={cn(
              "w-8 h-8 relative z-10 transition-all duration-500",
              tier.highlighted ? "text-primary-foreground" : "text-foreground"
            )}
          />
        </div>

        {/* 档位名称 + 英文名 */}
        <div className="text-center">
          <CardTitle className="text-2xl font-black text-foreground mb-1">
            {tier.name}
          </CardTitle>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
            {tier.englishName}
          </p>
        </div>

        {/* 价格 */}
        <div className="text-center mt-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className={cn(
              "text-4xl font-black transition-all duration-500",
              tier.highlighted ? "text-primary group-hover:scale-110" : "text-primary"
            )}>
              {tier.price}
            </span>
            <span className="text-lg text-muted-foreground font-medium">
              / {tier.period}
            </span>
          </div>
        </div>

        {/* 一句话价值 */}
        <CardDescription className="text-center mt-4 text-sm leading-relaxed text-foreground/80 font-medium px-2">
          {tier.tagline}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative flex flex-col h-full">
        {/* 权益列表 */}
        <div className="flex-grow space-y-3 mb-6">
          <h4 className="text-sm font-bold text-foreground/70 mb-3">包含权益：</h4>
          <ul className="space-y-2">
            {tier.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check
                  className={cn(
                    "w-5 h-5 flex-shrink-0 mt-0.5",
                    tier.highlighted ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span 
                  className="text-sm text-foreground/90 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: feature }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* 特殊说明 */}
        {tier.notes && tier.notes.length > 0 && (
          <div className="pt-4 border-t border-border mb-6">
            {tier.notes.map((note, idx) => (
              <p
                key={idx}
                className="text-xs text-muted-foreground leading-relaxed mb-2 last:mb-0"
              >
                {note}
              </p>
            ))}
          </div>
        )}

        {/* 按钮 */}
        {tier.isFree ? (
          <div className="w-full py-6 rounded-xl bg-muted/50 border border-border text-center">
            <p className="text-sm font-bold text-foreground/70">✨ 当前版本已解锁</p>
            <p className="text-xs text-muted-foreground mt-1">浏览本页面即可体验</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              className={cn(
                "w-full font-bold text-lg py-7 rounded-xl transition-all duration-500",
                "relative overflow-hidden group/btn",
                "border-2",
                tier.highlighted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] hover:scale-[1.02]"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary shadow-[0_4px_20px_rgb(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-[1.02]"
              )}
              onClick={() => tier.buttonLink && window.open(tier.buttonLink, "_blank")}
            >
              {tier.highlighted && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                  <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse-slow" />
                </>
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {tier.buttonText}
                <span className="text-xl transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
              </span>
            </Button>
            <p className="text-xs text-center text-muted-foreground">点击按钮填写报名表单，开启你的学习之旅</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
