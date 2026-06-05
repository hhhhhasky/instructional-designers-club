import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, BookOpen, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import Header from "@/components/layout/Header";
import PageNavigation from "@/components/common/PageNavigation";
import Footer from "@/components/common/Footer";
import PageMeta from "@/components/common/PageMeta";

export default function NewMemberPage() {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  const navItems = [
    { id: 'activities', label: '近期活动' },
    { id: 'tutorial', label: '新手村教程' },
    { id: 'roadmap', label: '专业进阶地图' },
  ];

  return (
    <>
      <PageMeta
        title="新会员必读"
        description="教学设计师俱乐部新会员指南。了解近期活动、新手村教程和专业进阶地图，快速融入共学社区。"
        canonicalPath="/new-member"
        keywords="新会员,教学设计入门,新手教程,教学设计师俱乐部"
      />
    <div className="min-h-screen bg-cream">
      <Header />
      <PageNavigation items={navItems} />
      {/* Hero Section */}
      <section className="relative py-20 xl:py-32 px-4 overflow-hidden gradient-animate pt-32 xl:pt-40">
        <div className="absolute top-20 right-10 w-72 h-72 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">

          <h1 className="text-4xl xl:text-6xl font-ds-bold text-tx tracking-tight drop-shadow-sm animate-fade-in-down" style={{ fontFamily: 'var(--fd)' }}>
            新会员必读
          </h1>
          <p className="text-lg xl:text-2xl text-tx max-w-3xl mx-auto leading-relaxed font-medium animate-fade-in-up">
            欢迎加入<span className="gradient-text">教学设计师俱乐部</span>！这里是你的专业成长起点
          </p>
        </div>
      </section>
      {/* 近期活动汇总 */}
      <section id="activities" className="py-12 xl:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <Calendar className="w-6 h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl xl:text-3xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>近期活动汇总</h2>
          </div>

          <Card className="border-bd shadow-ds-md hover-lift animate-scale-in">
            <CardHeader>
              <CardTitle className="text-xl xl:text-2xl">2025年12月</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 必修：建构主义学习营 */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-acl text-ac text-sm font-semibold rounded-full border-solid border-[rgb(26,26,26)] border-[1px] border-[rgb(26,26,26)]">必修</span>
                  <h3 className="font-ds-bold text-xl text-tx" style={{ fontFamily: 'var(--fd)' }}>重构讲授法学习营</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div>
                    <p className="text-txs mb-4">时间：2025年12月8日 - 12月31日</p>
                    <img
                      src="https://miaoda-edit-image.cdn.bcebos.com/7iwdhpt0pypt/IMG-7v1w6jar8um8.png"
                      alt="建构主义学习营海报"
                      className="w-full rounded-lg border border-bd shadow-sm"
                      data-editor-config="%7B%22defaultSrc%22%3A%22https%3A%2F%2Fmiaoda-edit-image.cdn.bcebos.com%2F7iwdhpt0pypt%2FIMG-7v1w6jar8um8.png%22%7D" />
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div>
                      <h4 className="font-semibold text-lg mb-2 text-tx">活动介绍</h4>
                      <p className="text-tx leading-relaxed">Make 讲授法 Great Again！4次大课，帮助你重新给自己最常用的教学法升级！</p>
                    </div>
                    <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                      <DialogTrigger asChild>
                        <div className="relative group cursor-pointer">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-ac to-tl rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-300" />
                          <Button size="lg" className="relative w-full text-lg py-6 shadow-ds-sm hover:shadow-lg transition-all duration-300">
                            <Sparkles className="w-5 h-5 mr-2" />
                            立即报名
                          </Button>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-center">扫码添加企业微信</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                          <img
                            src="https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251113/file-7j3wd4bwsdmo.jpg"
                            alt="企业微信二维码"
                            className="w-full max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setQrDialogOpen(false)}
                          />
                          <p className="text-sm text-txs text-center">
                            扫描二维码添加企业微信，了解更多活动详情
                            <br />
                            <span className="text-xs">（点击图片关闭）</span>
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-bd my-8" />

              {/* 选修：拆解得到 */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-warm text-tx text-sm font-semibold rounded-full border border-bd">选修</span>
                  <h3 className="font-ds-bold text-xl text-tx" style={{ fontFamily: 'var(--fd)' }}>公开课磨课</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div>
                    <p className="text-txs mb-4">时间：持续进行中</p>
                    <img
                      src="https://miaoda-edit-image.cdn.bcebos.com/7iwdhpt0pypt/IMG-7v22smd0j7cw.png"
                      alt="拆解得到活动海报"
                      className="w-full rounded-lg border border-bd shadow-sm"
                      data-editor-config="%7B%22defaultSrc%22%3A%22https%3A%2F%2Fmiaoda-edit-image.cdn.bcebos.com%2F7iwdhpt0pypt%2FIMG-7v22smd0j7cw.png%22%7D" />
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div>
                      <h4 className="font-semibold text-lg mb-2 text-tx">活动介绍</h4>
                      <p className="text-tx mb-4 leading-relaxed">欢迎想发起公开课磨课的老师，在俱乐部里发起你的公开课磨课会议！</p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-tx">报名条件：</p>
                        <ul className="space-y-2 text-sm text-txs">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-ac mt-0.5 flex-shrink-0" />
                            <span>愿意发起至少一次公开课磨课</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-ac mt-0.5 flex-shrink-0" />
                            <span>愿意填写完善自己的磨课会议文档</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                      <DialogTrigger asChild>
                        <div className="relative group cursor-pointer">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-ac to-tl rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-300" />
                          <Button size="lg" className="relative w-full text-lg py-6 shadow-ds-sm hover:shadow-lg transition-all duration-300">
                            <Sparkles className="w-5 h-5 mr-2" />
                            立即报名
                          </Button>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-center">扫码添加企业微信</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                          <img
                            src="https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251113/file-7j3wd4bwsdmo.jpg"
                            alt="企业微信二维码"
                            className="w-full max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setQrDialogOpen(false)}
                          />
                          <p className="text-sm text-txs text-center">
                            扫描二维码添加企业微信，了解更多活动详情
                            <br />
                            <span className="text-xs">（点击图片关闭）</span>
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* 新手村教程 */}
      <section id="tutorial" className="py-12 xl:py-16 px-4 bg-warm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <span className="text-3xl">🎓</span>
            <h2 className="text-2xl xl:text-3xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>新手村教程</h2>
          </div>

          <Card className="border-bd shadow-ds-md hover-lift animate-fade-in-up">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-acl flex items-center justify-center flex-shrink-0 hover-scale transition-transform duration-300">
                    <span className="text-2xl">📺</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-tx mb-2" style={{ fontFamily: 'var(--fd)' }}>新会员必看视频</h3>
                    <p className="text-txs mb-4">
                      为了能够更加具体的介绍我们俱乐部的学习活动，我专门录制了一段「新手村教程」，强烈建议每位新会员先自行观看。
                    </p>
                    <div className="relative group inline-block">
                      <div className="absolute -inset-1 bg-gradient-to-r from-ac to-tl rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-300" />
                      <Button asChild variant="outline" size="lg" className="relative hover:scale-105 transition-transform duration-300">
                        <a
                          href="https://meeting.tencent.com/crm/KPzWZZLZ52"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          <span>新手村教程（新会员必看）</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-bd pt-6">
                  <h4 className="font-semibold text-tx mb-4">教程内容包括：</h4>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-ac mt-0.5 flex-shrink-0" />
                      <span className="text-txs">俱乐部学习活动介绍</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-ac mt-0.5 flex-shrink-0" />
                      <span className="text-txs">如何参与每周一课</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-ac mt-0.5 flex-shrink-0" />
                      <span className="text-txs">如何使用学习资源</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-ac mt-0.5 flex-shrink-0" />
                      <span className="text-txs">如何申请课程回放</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* 专业进阶地图 */}
      <section id="roadmap" className="py-12 xl:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <TrendingUp className="w-6 h-6 xl:w-8 xl:h-8 text-ac" />
            <h2 className="text-2xl xl:text-3xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>专业进阶地图</h2>
          </div>

          {/* 选课示范图 */}
          <Card className="border-bd shadow-ds-md mb-12 overflow-hidden hover-lift hover-glow animate-scale-in">
            <CardContent className="p-0">
              <img
                src="https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251120/file-7oesi9d3f280.png"
                alt="选课示范"
                className="w-full h-auto transition-transform duration-500 hover:scale-105"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 小白期 */}
            <Card className="border-bd shadow-ds-sm bg-gradient-to-r from-ac/5 to-ac/10 hover-lift hover-glow animate-scale-in">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ac/60 to-tl/60 flex items-center justify-center flex-shrink-0 shadow hover-scale transition-transform duration-300">
                    <span className="text-xl">🌟</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-ds-bold text-tx mb-2" style={{ fontFamily: 'var(--fd)' }}>小白期</h3>
                    <p className="text-sm text-txs mb-4">
                      <strong className="text-tx">痛点困惑：</strong>什么是教学设计？如何开始学习？从哪里入手？
                    </p>
                    <div className="bg-[var(--bc)]/80 rounded-lg p-3 hover-lift transition-all duration-300">
                      <p className="text-sm font-medium text-tx mb-2">推荐课程：</p>
                      <ul className="space-y-1 text-sm text-txs">
                        <li>• 教学设计101Course</li>
                        <li>• 什么是教学设计？</li>
                        <li>• 教学设计全景图</li>
                        <li>• 新手村教程</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 成长期 */}
            <Card className="border-bd shadow-ds-sm bg-gradient-to-r from-ac/5 to-ac/10 hover-lift hover-glow animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ac/60 to-tl/60 flex items-center justify-center flex-shrink-0 shadow hover-scale transition-transform duration-300">
                    <span className="text-xl">🌱</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-ds-bold text-tx mb-2" style={{ fontFamily: 'var(--fd)' }}>成长期</h3>
                    <p className="text-sm text-txs mb-4">
                      <strong className="text-tx">痛点困惑：</strong>如何提升教学效果？如何设计更好的教学活动？如何评估学习成果？
                    </p>
                    <div className="bg-[var(--bc)]/80 rounded-lg p-3 hover-lift transition-all duration-300">
                      <p className="text-sm font-medium text-tx mb-2">推荐课程：</p>
                      <ul className="space-y-1 text-sm text-txs">
                        <li>• 罗森海因教学原理</li>
                        <li>• 认知负荷理论</li>
                        <li>• 教学目标设计</li>
                        <li>• 教学评价方法</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 成熟期 */}
            <Card className="border-bd shadow-ds-sm bg-gradient-to-r from-ac/5 to-ac/10 hover-lift hover-glow animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ac/60 to-tl/60 flex items-center justify-center flex-shrink-0 shadow hover-scale transition-transform duration-300">
                    <span className="text-xl">⭐</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-ds-bold text-tx mb-2" style={{ fontFamily: 'var(--fd)' }}>成熟期</h3>
                    <p className="text-sm text-txs mb-4">
                      <strong className="text-tx">痛点困惑：</strong>如何应对复杂教学情境？如何创新教学设计？如何平衡理论与实践？
                    </p>
                    <div className="bg-[var(--bc)]/80 rounded-lg p-3 hover-lift transition-all duration-300">
                      <p className="text-sm font-medium text-tx mb-2">推荐课程：</p>
                      <ul className="space-y-1 text-sm text-txs">
                        <li>• 建构主义学习营</li>
                        <li>• 真实任务设计</li>
                        <li>• PBL项目式学习</li>
                        <li>• 学习动力设计</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 专家期 */}
            <Card className="border-bd shadow-ds-sm bg-gradient-to-r from-ac/5 to-ac/10 hover-lift hover-glow animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ac/60 to-tl/60 flex items-center justify-center flex-shrink-0 shadow hover-scale transition-transform duration-300">
                    <span className="text-xl">🏆</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-ds-bold text-tx mb-2" style={{ fontFamily: 'var(--fd)' }}>专家期</h3>
                    <p className="text-sm text-txs mb-4">
                      <strong className="text-tx">痛点困惑：</strong>如何形成自己的教学设计体系？如何指导其他教师？如何进行教学研究？
                    </p>
                    <div className="bg-[var(--bc)]/80 rounded-lg p-3">
                      <p className="text-sm font-medium text-tx mb-2">推荐课程：</p>
                      <ul className="space-y-1 text-sm text-txs">
                        <li>• 教学设计理论深度研究</li>
                        <li>• 教师培训与指导方法</li>
                        <li>• 教学研究方法论</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <p className="text-txs text-sm">
              💡 提示：根据自己的实际情况选择合适的学习路径，循序渐进地提升专业能力
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
    </>
  );
}
