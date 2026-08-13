#!/usr/bin/env node

/** Build a copyright-safe, official-catalogue-backed payload for missing junior subjects. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { completeTextbookPayload, validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const vaultDir = "/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教材课标知识库/初中生物地理历史教材";
const outputPath = path.resolve(process.argv[2] ?? "supabase/seed-data/hai-missing-junior-textbooks.json");
const curriculumStandardUrl = "https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html";
const sha256 = (value) => crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
const zh = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const n = (value) => { const s = String(value); if (/^\d+$/u.test(s)) return Number(s); if (s.includes("十")) { const [a, b] = s.split("十"); return (a ? zh[a] ?? 0 : 1) * 10 + (b ? zh[b] ?? 0 : 0); } return zh[s] ?? 0; };

const sources = {
  biology: {
    subject: "生物", publisher: "人民教育出版社", edition: "人教版义务教育教科书·生物学（官方目录摘要）",
    urls: ["https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250811.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250710.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250820.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250709.shtml"],
    books: [
      [7, "上册", [["第一单元 生物和生物圈", ["第一章 认识生物｜第一节 生物的特征", "第一章 认识生物｜第二节 调查周边环境中的生物", "第二章 了解生物圈｜第一节 生物与环境的关系", "第二章 了解生物圈｜第二节 生物与环境组成生态系统", "第二章 了解生物圈｜第三节 生物圈是最大的生态系统"]], ["第二单元 生物体的结构层次", ["第一章 细胞是生命活动的基本单位｜第一节 练习使用显微镜", "第一章 细胞是生命活动的基本单位｜第二节 植物细胞", "第一章 细胞是生命活动的基本单位｜第三节 动物细胞", "第一章 细胞是生命活动的基本单位｜第四节 细胞的生活", "第二章 细胞怎样构成生物体｜第一节 细胞通过分裂产生新细胞", "第二章 细胞怎样构成生物体｜第二节 动物体的结构层次", "第二章 细胞怎样构成生物体｜第三节 植物体的结构层次", "第二章 细胞怎样构成生物体｜第四节 单细胞生物"]], ["第三单元 生物圈中的绿色植物", ["第一章 生物圈中有哪些绿色植物｜第一节 藻类、苔藓和蕨类植物", "第一章 生物圈中有哪些绿色植物｜第二节 种子植物", "第二章 被子植物的一生｜第一节 种子的萌发", "第二章 被子植物的一生｜第二节 植株的生长", "第二章 被子植物的一生｜第三节 开花和结果", "第三章 绿色植物与生物圈的水循环", "第四章 绿色植物是生物圈中有机物的制造者", "第五章 绿色植物与生物圈中碳—氧平衡", "第六章 爱护植被，绿化祖国"]]]],
      [7, "下册", [["第四单元 生物圈中的人", ["第一章 人的由来｜第一节 人类的起源和发展", "第一章 人的由来｜第二节 人的生殖", "第一章 人的由来｜第三节 青春期", "第二章 人体的营养｜第一节 食物中的营养物质", "第二章 人体的营养｜第二节 消化和吸收", "第二章 人体的营养｜第三节 合理营养与食品安全", "第三章 人体的呼吸｜第一节 呼吸道对空气的处理", "第三章 人体的呼吸｜第二节 发生在肺内的气体交换", "第四章 人体内物质的运输｜第一节 流动的组织——血液", "第四章 人体内物质的运输｜第二节 血流的管道——血管", "第四章 人体内物质的运输｜第三节 输送血液的泵——心脏", "第四章 人体内物质的运输｜第四节 输血与血型", "第五章 人体内废物的排出", "第六章 人体生命活动的调节｜第一节 人体对外界环境的感知", "第六章 人体生命活动的调节｜第二节 神经系统的组成", "第六章 人体生命活动的调节｜第三节 神经调节的基本方式", "第六章 人体生命活动的调节｜第四节 激素调节", "第七章 人类活动对生物圈的影响｜第一节 分析人类活动对生态环境的影响", "第七章 人类活动对生物圈的影响｜第二节 探究环境污染对生物的影响", "第七章 人类活动对生物圈的影响｜第三节 拟定保护生态环境的计划"]]]],
      [8, "上册", [["第五单元 生物圈中的其他生物", ["第一章 动物的主要类群｜第一节 腔肠动物和扁形动物", "第一章 动物的主要类群｜第二节 线形动物和环节动物", "第一章 动物的主要类群｜第三节 软体动物和节肢动物", "第一章 动物的主要类群｜第四节 鱼", "第一章 动物的主要类群｜第五节 两栖动物和爬行动物", "第一章 动物的主要类群｜第六节 鸟", "第一章 动物的主要类群｜第七节 哺乳动物", "第二章 动物的运动和行为｜第一节 动物的运动", "第二章 动物的运动和行为｜第二节 先天性行为和学习行为", "第二章 动物的运动和行为｜第三节 社会行为", "第三章 动物在生物圈中的作用", "第四章 细菌和真菌｜第一节 细菌和真菌的分布", "第四章 细菌和真菌｜第二节 细菌", "第四章 细菌和真菌｜第三节 真菌", "第四章 细菌和真菌｜第四节 细菌和真菌在自然界中的作用", "第四章 细菌和真菌｜第五节 人类对细菌和真菌的作用", "第五章 病毒"]], ["第六单元 生物的多样性及其保护", ["第一章 根据生物的特征进行分类｜第一节 尝试对生物进行分类", "第一章 根据生物的特征进行分类｜第二节 从种到界", "第二章 认识生物的多样性", "第三章 保护生物的多样性"]]]],
      [8, "下册", [["第七单元 生物圈中生命的延续和发展", ["第一章 生物的生殖和发育｜第一节 植物的生殖", "第一章 生物的生殖和发育｜第二节 昆虫的生殖和发育", "第一章 生物的生殖和发育｜第三节 两栖动物的生殖和发育", "第一章 生物的生殖和发育｜第四节 鸟的生殖和发育", "第二章 生物的遗传和变异｜第一节 基因控制生物的性状", "第二章 生物的遗传和变异｜第二节 基因在亲子代间的传递", "第二章 生物的遗传和变异｜第三节 基因的显性和隐性", "第二章 生物的遗传和变异｜第四节 人的性别遗传", "第二章 生物的遗传和变异｜第五节 生物的变异", "第三章 生命起源和生物进化｜第一节 地球上生命的起源", "第三章 生命起源和生物进化｜第二节 生物进化的历程", "第三章 生命起源和生物进化｜第三节 生物进化的原因"]], ["第八单元 健康地生活", ["第一章 传染病和免疫｜第一节 传染病及其预防", "第一章 传染病和免疫｜第二节 免疫与计划免疫", "第二章 用药和急救", "第三章 选择健康的生活方式"]]]],
    ],
  },
  geography: {
    subject: "地理", publisher: "人民教育出版社", edition: "人教版义务教育教科书·地理（官方目录摘要）",
    urls: ["https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250689.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250708.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250688.shtml", "https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250707.shtml"],
    books: [
      [7, "上册", [["第一章 地球和地图", ["第一节 地球和地球仪", "第二节 地球的运动", "第三节 地图的阅读", "第四节 地形图的判读"]], ["第二章 陆地和海洋", ["第一节 大洲和大洋", "第二节 海陆的变迁"]], ["第三章 天气与气候", ["第一节 多变的天气", "第二节 气温的变化与分布", "第三节 降水的变化与分布", "第四节 世界的气候"]], ["第四章 居民与聚落", ["第一节 人口与人种", "第二节 世界的语言和宗教", "第三节 人类的聚居地——聚落"]], ["第五章 发展与合作", ["发展与合作"]]]],
      [7, "下册", [["第六章 我们生活的大洲——亚洲", ["第一节 位置和范围", "第二节 自然环境"]], ["第七章 我们邻近的地区和国家", ["第一节 日本", "第二节 东南亚", "第三节 印度", "第四节 俄罗斯"]], ["第八章 东半球其他的地区和国家", ["第一节 中东", "第二节 欧洲西部", "第三节 撒哈拉以南非洲", "第四节 澳大利亚"]], ["第九章 西半球的国家", ["第一节 美国", "第二节 巴西"]], ["第十章 极地地区", ["极地地区"]]]],
      [8, "上册", [["第一章 从世界看中国", ["第一节 疆域", "第二节 人口", "第三节 民族"]], ["第二章 中国的自然环境", ["第一节 地形和地势", "第二节 气候", "第三节 河流", "第四节 自然灾害"]], ["第三章 中国的自然资源", ["第一节 自然资源的基本特征", "第二节 土地资源", "第三节 水资源"]], ["第四章 中国的经济发展", ["第一节 交通运输", "第二节 农业", "第三节 工业"]]]],
      [8, "下册", [["第五章 中国的地理差异", ["中国的地理差异"]], ["第六章 北方地区", ["第一节 自然特征与农业", "第二节 ‘白山黑水’——东北三省", "第三节 世界最大的黄土堆积区——黄土高原", "第四节 祖国的首都——北京"]], ["第七章 南方地区", ["第一节 自然特征与农业", "第二节 ‘鱼米之乡’——长江三角洲地区", "第三节 ‘东方明珠’——香港和澳门", "第四节 祖国的神圣领土——台湾省"]], ["第八章 西北地区", ["第一节 自然特征与农业", "第二节 干旱的宝地——塔里木盆地"]], ["第九章 青藏地区", ["第一节 自然特征与农业", "第二节 高原湿地——三江源地区"]], ["第十章 中国在世界中", ["中国在世界中"]]]],
    ],
  },
  history: {
    subject: "历史", publisher: "人民教育出版社", edition: "统编版义务教育教科书·中国历史（官方目录摘要）",
    urls: ["https://www.pep.com.cn/products/jc/czjks/201802/t20180227_1922743.shtml", "https://www.pep.com.cn/products/jc/czjks/201802/t20180226_1922741.shtml", "https://www.pep.com.cn/products/jc/czjks/201802/t20180226_1922742.shtml", "https://www.pep.com.cn/products/jc/czjks/201802/t20180226_1922737.shtml"],
    books: [
      [7, "上册", [["第一单元 史前时期：中国境内人类的活动", ["第1课 中国早期人类的代表——北京人", "第2课 原始农耕生活", "第3课 远古的传说"]], ["第二单元 夏商周时期：早期国家的产生与社会变革", ["第4课 早期国家的产生和发展", "第5课 青铜器与甲骨文", "第6课 动荡的春秋时期", "第7课 战国时期的社会变化", "第8课 百家争鸣"]], ["第三单元 秦汉时期：统一多民族国家的建立与巩固", ["第9课 秦统一中国", "第10课 秦末农民大起义", "第11课 西汉建立和‘文景之治’", "第12课 汉武帝巩固大一统王朝", "第13课 东汉的兴亡", "第14课 沟通中外文明的‘丝绸之路’", "第15课 两汉的科技和文化"]], ["第四单元 三国两晋南北朝时期：政权分立与民族交融", ["第16课 三国鼎立", "第17课 两晋的短暂统一和北方各族的内迁", "第18课 东晋南朝时期江南地区的开发", "第19课 北魏政治和北方民族大交融", "第20课 魏晋南北朝的科技与文化", "第21课 活动课：让我们共同来感受历史"]]]],
      [7, "下册", [["第一单元 隋唐时期：繁荣与开放的时代", ["第1课 隋唐的统一与灭亡", "第2课 从‘贞观之治’到‘开元盛世’", "第3课 盛唐气象", "第4课 唐朝的中外文化交流", "第5课 安史之乱与唐朝衰亡"]], ["第二单元 辽宋夏金元时期：民族关系发展和社会变化", ["第6课 北宋的政治", "第7课 辽、西夏与北宋的并立", "第8课 金与南宋的对峙", "第9课 宋代经济的发展", "第10课 蒙古族的兴起与元朝的建立", "第11课 元朝的统治", "第12课 宋元时期的都市和文化", "第13课 宋元时期的科技与中外交通"]], ["第三单元 明清时期：统一多民族国家的巩固与发展", ["第14课 明朝的统治", "第15课 明朝的对外关系", "第16课 明朝的科技、建筑与文学", "第17课 明朝的灭亡", "第18课 统一多民族国家的巩固和发展", "第19课 清朝前期社会经济的发展", "第20课 清朝君主专制的强化", "第21课 清朝前期的文学艺术", "第22课 活动课：中国传统节日的起源"]]]],
      [8, "上册", [["第一单元 中国开始沦为半殖民地半封建国家", ["第1课 鸦片战争", "第2课 第二次鸦片战争", "第3课 太平天国运动"]], ["第二单元 近代化的早期探索与民族危机的加剧", ["第4课 洋务运动", "第5课 甲午中日战争与瓜分中国狂潮", "第6课 戊戌变法", "第7课 抗击八国联军"]], ["第三单元 资产阶级民主革命与中华民国的建立", ["第8课 革命先行者孙中山", "第9课 辛亥革命", "第10课 中华民国的创建", "第11课 北洋政府的黑暗统治"]], ["第四单元 新时代的曙光", ["第12课 新文化运动", "第13课 五四运动", "第14课 中国共产党诞生"]], ["第五单元 从国共合作到国共对峙", ["第15课 北伐战争", "第16课 毛泽东开辟井冈山道路", "第17课 中国工农红军长征"]], ["第六单元 中华民族的抗日战争", ["第18课 从九一八事变到西安事变", "第19课 七七事变与全民族抗战", "第20课 正面战场的抗战", "第21课 敌后战场的抗战", "第22课 抗日战争的胜利"]], ["第七单元 解放战争", ["第23课 内战爆发", "第24课 人民解放战争的胜利"]], ["第八单元 近代经济、社会生活与教育文化事业的发展", ["第25课 经济和社会生活的变化", "第26课 教育文化事业的发展", "第27课 活动课：考察近代历史遗迹"]]]],
      [8, "下册", [["第一单元 中华人民共和国的成立和巩固", ["第1课 中华人民共和国成立", "第2课 抗美援朝", "第3课 土地改革"]], ["第二单元 社会主义制度的建立与社会主义建设的探索", ["第4课 工业化的起步和人民代表大会制度的建立", "第5课 三大改造", "第6课 艰辛探索与建设成就"]], ["第三单元 中国特色社会主义道路", ["第7课 伟大的历史转折", "第8课 经济体制改革", "第9课 对外开放", "第10课 建设中国特色社会主义", "第11课 为实现中国梦而努力奋斗"]], ["第四单元 民族团结与祖国统一", ["第12课 民族大团结", "第13课 香港和澳门的回归", "第14课 海峡两岸的交往"]], ["第五单元 国防建设与外交成就", ["第15课 钢铁长城", "第16课 独立自主的和平外交", "第17课 外交事业的发展"]], ["第六单元 科技文化与社会生活", ["第18课 科技文化成就", "第19课 社会生活的变迁", "第20课 活动课：生活环境的巨大变化"]]]],
      [9, "上册", [["第一单元 古代亚非文明", ["第1课 古代埃及", "第2课 古代两河流域", "第3课 古代印度"]], ["第二单元 古代欧洲文明", ["第4课 希腊城邦和亚历山大帝国", "第5课 罗马城邦和罗马帝国", "第6课 希腊罗马古典文化"]], ["第三单元 封建时代的欧洲", ["第7课 基督教的兴起和法兰克王国", "第8课 西欧庄园", "第9课 中世纪城市和大学的兴起", "第10课 拜占庭帝国和《查士丁尼法典》"]], ["第四单元 封建时代的亚洲国家", ["第11课 古代日本", "第12课 阿拉伯帝国"]], ["第五单元 走向近代", ["第13课 西欧经济和社会的发展", "第14课 文艺复兴运动", "第15课 探寻新航路", "第16课 早期殖民掠夺"]], ["第六单元 资本主义制度的初步确立", ["第17课 君主立宪制的英国", "第18课 美国的独立", "第19课 法国大革命和拿破仑帝国"]], ["第七单元 工业革命和国际共产主义运动的兴起", ["第20课 第一次工业革命", "第21课 马克思主义的诞生和国际共产主义运动的兴起"]]]],
      [9, "下册", [["第一单元 殖民地人民的反抗和资本主义制度的扩展", ["第1课 殖民地人民的反抗斗争", "第2课 俄国的改革", "第3课 美国内战", "第4课 日本明治维新"]], ["第二单元 第二次工业革命和近代科学文化", ["第5课 第二次工业革命", "第6课 工业化国家的社会变化", "第7课 近代科学与文化"]], ["第三单元 第一次世界大战和战后初期的世界", ["第8课 第一次世界大战", "第9课 列宁与十月革命", "第10课 《凡尔赛条约》和《九国公约》", "第11课 苏联的社会主义建设", "第12课 亚非拉民族民主运动的高涨"]], ["第四单元 经济大危机和第二次世界大战", ["第13课 罗斯福新政", "第14课 法西斯国家的侵略扩张", "第15课 第二次世界大战"]], ["第五单元 冷战和美苏对峙", ["第16课 冷战", "第17课 二战后资本主义的新变化", "第18课 社会主义的发展与挫折", "第19课 亚非拉国家的新发展"]], ["第六单元 冷战结束后的世界", ["第20课 联合国与世界贸易组织", "第21课 冷战后的世界格局", "第22课 不断发展的现代社会"]]]],
    ],
  },
};

function makeBook(source, grade, volume, units) {
  const key = `${source.subject === "生物" ? "biology" : source.subject === "地理" ? "geography" : "history"}-${grade}-${volume === "上册" ? 1 : 2}`;
  const slug = `official-catalog-${key}`;
  const markdown = [`# ${source.edition}｜${grade}年级${volume}`, "", "> 本文件只保存人民教育出版社公开目录与原创的学科定位摘要，不复制教材正文。正式生成教案时仍须提供教材正文、教师用书或可核验的课题材料。", "", "## 核验来源", `- ${curriculumStandardUrl}（教育部：义务教育课程方案和课程标准（2022年版））`, ...source.urls.map((url) => `- ${url}`), "", "## 目录层级" ];
  const sections = [];
  const links = [];
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const [unitTitle, lessonTitles] = units[unitIndex];
    const unitNumber = unitIndex + 1;
    const unitKey = `${slug}::u${unitNumber}`;
    const unitContent = `# 第${unitNumber}单元 ${unitTitle}\n\n本单元以“${unitTitle}”为内容边界。目录来源为人民教育出版社公开书目信息；具体教材表述、图片、活动和数据需以当册教材核对。`;
    sections.push(section({ slug, level: "unit", unitNumber, unitTitle, content: unitContent, sort: unitNumber * 1000, source }));
    markdown.push(`### 第${unitNumber}单元 ${unitTitle}`, "", ...lessonTitles.map((title, index) => `${index + 1}. ${title}`), "");
    for (let lessonIndex = 0; lessonIndex < lessonTitles.length; lessonIndex += 1) {
      const lessonNumber = lessonIndex + 1;
      const [chapter, lessonTitle = chapter] = lessonTitles[lessonIndex].split("｜");
      const lessonKey = `${slug}::u${unitNumber}::l${lessonNumber}`;
      const content = `## ${lessonTitles[lessonIndex]}\n\n学科定位：本课属于“${unitTitle}”单元。课堂设计应从教材事实、学科关键概念或学科实践出发，形成可观察的解释、证据、方法或作品；目录本身不替代教材正文。`;
      sections.push(section({ slug, level: "lesson", unitNumber, unitTitle, lessonNumber, lessonTitle: lessonTitle.trim(), content, sort: unitNumber * 1000 + lessonNumber, source }));
      links.push({ section_key: unitKey, linked_section_key: lessonKey, relation_type: "unit_to_lesson" }, { section_key: lessonKey, linked_section_key: unitKey, relation_type: "lesson_to_unit" });
    }
  }
  const sourceText = markdown.join("\n");
  return { slug, markdown: sourceText, sections, links, collection: { slug, title: `人教版${source.subject}${grade}年级${volume}官方目录摘要`, stage: "初中", subject: source.subject, publisher: source.publisher, edition_family: source.subject === "历史" ? "统编版" : "人教版", edition_label: source.edition, grade_level: grade, grade_label: `${grade}年级`, volume, publication_status: "catalogue_summary", verification_status: "official_publisher_catalogue", requires_confirmation: true, content_type: "official_catalogue_summary", source_type: "official_public_catalogue", source_file_name: `教材课标知识库/初中生物地理历史教材/${source.subject}${grade}年级${volume}_官方目录摘要.md`, source_note: "官方公开目录摘要，不是教材逐字正文；生物/地理/历史课程标准与新修订教材版本需要教师按当前在用版本复核。", source_hash: sha256(sourceText), metadata: { official_sources: source.urls, parser: "official-catalogue-summary-v1", copyright_boundary: "目录标题与原创学科定位摘要；不含教材正文" } } };
}

function section({ slug, level, unitNumber, unitTitle, lessonNumber = 0, lessonTitle = "", content, sort, source }) { const text = content.trim(); return { section_key: level === "unit" ? `${slug}::u${unitNumber}` : `${slug}::u${unitNumber}::l${lessonNumber}`, collection_slug: slug, section_level: level, unit_number: unitNumber, unit_label: `第${unitNumber}单元`, unit_title: unitTitle, lesson_number: lessonNumber, lesson_label: lessonNumber ? `第${lessonNumber}课` : "", lesson_title: lessonNumber ? lessonTitle : "", frame_number: 0, frame_label: "", frame_title: "", section_path: `${unitNumber} ${unitTitle}${lessonNumber ? ` / ${lessonNumber} ${lessonTitle}` : " / 单元背景"}`, content_type: level === "unit" ? "unit_context" : "lesson_summary", content_markdown: text, content_text: text.replace(/[#>*`|_]/gu, " ").replace(/\s+/gu, " ").trim(), knowledge_point_count: 1, char_count: text.length, sort_order: sort, content_hash: sha256(text), verification_status: "official_catalogue_summary", metadata: { official_source_subject: source.subject, parser: "official-catalogue-summary-v1" } }; }

function main() {
  const collections = []; const sections = []; const links = [];
  for (const source of Object.values(sources)) for (const [grade, volume, units] of source.books) { const book = makeBook(source, grade, volume, units); collections.push(book.collection); sections.push(...book.sections); links.push(...book.links); const out = path.join(vaultDir, `${source.subject}${grade}年级${volume}_官方目录摘要.md`); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${book.markdown}\n`, "utf8"); }
  const payload = completeTextbookPayload({ schemaVersion: "hai-textbook-v2", generatedAt: new Date().toISOString(), excluded_scopes: ["高中教材", "教材正文与受版权保护的全文"], collections, sections, links });
  validateHaiTextbookPayload(payload, { source: outputPath }); fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: outputPath, source_dir: vaultDir, collections: payload.collections.length, sections: payload.sections.length, links: payload.links.length }, null, 2));
}
main();
