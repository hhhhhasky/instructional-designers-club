-- ============================================================
-- 教学设计师俱乐部 - 内容运营后台（R-P0-02）
-- 创建时间: 2026-06-14
-- 说明: 首页可变内容 + 资源文章 + 动态/活动 的内容管理表与 RLS
--       运营者用后台表单即可维护，全程不碰代码。
-- 幂等说明: 使用 IF NOT EXISTS / ON CONFLICT，可重复执行。
-- ============================================================

-- ==================== 1. site_content：首页单例区块（键值 + JSONB 结构化数据） ====================
CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "section_key"   text PRIMARY KEY,
    "section_label" text NOT NULL,
    "data"          jsonb NOT NULL DEFAULT '{}'::jsonb,
    "updated_at"    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE "public"."site_content" IS '首页单例区块内容（Hero / 介绍 / 创始人 / 价值观 / 数据 等），后台表单编辑';

ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read site_content" ON "public"."site_content";
CREATE POLICY "public read site_content"
    ON "public"."site_content" FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "admin write site_content" ON "public"."site_content";
CREATE POLICY "admin write site_content"
    ON "public"."site_content" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 2. member_profiles：会员风采（多条） ====================
CREATE TABLE IF NOT EXISTS "public"."member_profiles" (
    "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "icon"        text NOT NULL DEFAULT '⭐',
    "name"        text NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "sort_order"  integer NOT NULL DEFAULT 0,
    "is_active"   boolean NOT NULL DEFAULT true,
    "created_at"  timestamptz NOT NULL DEFAULT now(),
    "updated_at"  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."member_profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read member_profiles" ON "public"."member_profiles";
CREATE POLICY "public read member_profiles"
    ON "public"."member_profiles" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write member_profiles" ON "public"."member_profiles";
CREATE POLICY "admin write member_profiles"
    ON "public"."member_profiles" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 3. faqs：常见问题（多条） ====================
CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "question"   text NOT NULL,
    "answer"     text NOT NULL,
    "sort_order" integer NOT NULL DEFAULT 0,
    "is_active"  boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read faqs" ON "public"."faqs";
CREATE POLICY "public read faqs"
    ON "public"."faqs" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write faqs" ON "public"."faqs";
CREATE POLICY "admin write faqs"
    ON "public"."faqs" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 4. testimonials：会员评价（多条，图片 + 摘要） ====================
CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "image_url"  text NOT NULL,
    "alt_text"   text NOT NULL DEFAULT '',
    "author"     text,
    "sort_order" integer NOT NULL DEFAULT 0,
    "is_active"  boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read testimonials" ON "public"."testimonials";
CREATE POLICY "public read testimonials"
    ON "public"."testimonials" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write testimonials" ON "public"."testimonials";
CREATE POLICY "admin write testimonials"
    ON "public"."testimonials" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 5. announcements：动态 / 上新 / 公告（与 R-P0-03 共用） ====================
CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "type"         text NOT NULL DEFAULT 'announcement',  -- new_course | live | event | announcement
    "title"        text NOT NULL,
    "summary"      text,
    "link_url"     text,
    "link_label"   text,
    "is_pinned"    boolean NOT NULL DEFAULT false,
    "is_active"    boolean NOT NULL DEFAULT true,
    "published_at" timestamptz NOT NULL DEFAULT now(),
    "expires_at"   timestamptz,                           -- null = 永不过期
    "sort_order"   integer NOT NULL DEFAULT 0,
    "created_at"   timestamptz NOT NULL DEFAULT now(),
    "updated_at"   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read announcements" ON "public"."announcements";
CREATE POLICY "public read announcements"
    ON "public"."announcements" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write announcements" ON "public"."announcements";
CREATE POLICY "admin write announcements"
    ON "public"."announcements" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 6. activities：活动 / 直播（多条） ====================
CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "title"        text NOT NULL,
    "description"  text,
    "activity_type" text NOT NULL DEFAULT 'event',  -- live | lesson_review | study_group | event
    "start_time"   timestamptz,
    "end_time"     timestamptz,
    "location"     text,
    "meeting_url"  text,
    "is_active"    boolean NOT NULL DEFAULT true,
    "sort_order"   integer NOT NULL DEFAULT 0,
    "created_at"   timestamptz NOT NULL DEFAULT now(),
    "updated_at"   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read activities" ON "public"."activities";
CREATE POLICY "public read activities"
    ON "public"."activities" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write activities" ON "public"."activities";
CREATE POLICY "admin write activities"
    ON "public"."activities" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 7. resources：资源中心文章（多条） ====================
CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "title"         text NOT NULL,
    "resource_type" text NOT NULL DEFAULT 'article',  -- translation | wechat | article
    "description"   text,
    "cover_url"     text,
    "links"         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{label, url}]
    "sort_order"    integer NOT NULL DEFAULT 0,
    "is_active"     boolean NOT NULL DEFAULT true,
    "created_at"    timestamptz NOT NULL DEFAULT now(),
    "updated_at"    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read resources" ON "public"."resources";
CREATE POLICY "public read resources"
    ON "public"."resources" FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin write resources" ON "public"."resources";
CREATE POLICY "admin write resources"
    ON "public"."resources" FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==================== 8. updated_at 自动维护触发器 ====================
CREATE OR REPLACE FUNCTION "public"."touch_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ==================== 9. 公开会员计数（SECURITY DEFINER，绕过 profiles 的 RLS） ====================
-- profiles 表对匿名用户不可读（RLS），但首页「会员人数」需要对所有人显示真实值。
-- 用 SECURITY DEFINER 函数只返回计数，不暴露任何会员信息。
CREATE OR REPLACE FUNCTION "public"."public_member_count"()
RETURNS bigint
LANGUAGE "sql"
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::bigint FROM public.profiles WHERE status = 'active';
$$;
COMMENT ON FUNCTION "public"."public_member_count"() IS '公开可见的活跃会员计数，绕过 profiles RLS，仅返回数字';

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'site_content','member_profiles','faqs','testimonials',
        'announcements','activities','resources'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
    END LOOP;
END $$;

-- ============================================================
-- 种子数据：把当前硬编码内容一次性迁入数据库（ON CONFLICT 幂等）
-- ============================================================

-- ---------- site_content：各单例区块 ----------
INSERT INTO "public"."site_content" ("section_key", "section_label", "data") VALUES
('hero', '首页主视觉（Hero）', '{
  "title_line1": "让每一堂课，",
  "title_line2": "都值得被认真对待",
  "subtitle": "一所AI时代的线上创新师范学院",
  "cta_text": "申请成为会员",
  "cta_link": "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb"
}'::jsonb),
('introduction', '俱乐部介绍', '{
  "section_title": "俱乐部介绍",
  "section_subtitle": "为认真对待每一堂课的老师而建",
  "welcome_title": "欢迎加入我们",
  "welcome_paragraphs": [
    "教学设计师俱乐部是一个为教育者打造的共学社区。",
    "我们不认为教学只是“完成任务”——我们相信，好的教学是可以被设计、被打磨、被持续精进的技艺。",
    "在这里，你不会听到“三步搞定公开课”这样的承诺。你得到的是一套系统的 **教学设计方法论（CREATE 模型）**，帮助你把对教育的理解，变成每一节课里真实发生的学习。",
    "无论你教什么学科、在什么类型的学校，只要你还在思考“怎样让学生真正学到东西”——这里就有懂你的同行者。"
  ],
  "product_intro_heading": "在俱乐部中，包括 Plus 和 Pro 两大会员产品：",
  "plus_text": "Plus会员：包含 **70+节教学通识课** + 专属答疑社区。它帮你建立一套完整的教学设计思维框架——从理解学生如何学习，到设计有效的学习活动，再到评估学习效果。适合想要 **系统精进教学设计能力**、让日常教学更有章法的老师。",
  "pro_text": "Pro会员：在 Plus 的基础上，增加了 **30+节教师 AI 课**，以及我研发的 **AI工具、网站、skill等资源包**。它不是教你用AI“代替备课”，而是教你用AI延伸教学设计的深度和广度——从教学分析、活动设计到课程开发，让AI成为你教学思考的协作伙伴。适合愿意深度实践、探索教学新可能的老师。"
}'::jsonb),
('club_values', '教学价值观（6 条信念）', '{
  "values_title": "我们相信的教学观",
  "values_subtitle": "这些信念塑造了我们教什么、怎么教。如果你也认同，我们可能是同行者。",
  "items": [
    {"emoji": "✨", "text": "**专业方法**先于直觉和经验"},
    {"emoji": "🎯", "text": "**学习是可以被优化的**"},
    {"emoji": "🔬", "text": "有效的教学是**科学循证的**"},
    {"emoji": "⚡", "text": "优质的教学是**有效果、有参与度、有效率的**"},
    {"emoji": "🤝", "text": "**尊重学习者的主体性**"},
    {"emoji": "🧩", "text": "**复杂的事物可以被拆解**"}
  ]
}'::jsonb),
('founder', '俱乐部创始人', '{
  "section_title": "俱乐部创始人",
  "avatar_url": "https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png",
  "avatar_alt": "哈老师",
  "name": "哈老师",
  "tags": [
    {"icon": "GraduationCap", "label": "教学专家", "color": "ac"},
    {"icon": "Bot", "label": "开发小白", "color": "am"},
    {"icon": "TrendingUp", "label": "一人公司", "color": "pp"}
  ],
  "motto": "教学是艺术和科学，更是工程和技术",
  "info_items": [
    {"icon": "Lightbulb", "label": "愿景", "text": "做一所 AI 时代的创新师范学院", "color": "am"},
    {"icon": "BookOpen", "label": "产品", "text": "教学通识课 / 教师AI课", "color": "ac"},
    {"icon": "Users", "label": "社区", "text": "教学设计师俱乐部", "color": "tl"}
  ],
  "stats": [
    {"icon": "Brain", "value": "6h+", "label": "每日AI", "color": "pp"},
    {"icon": "Bot", "value": "80%", "label": "AI外包", "color": "am"},
    {"icon": "BookOpen", "value": "数百节", "label": "师培课", "color": "ac"},
    {"icon": "UserCheck", "value": "数千名", "label": "师支持", "color": "tl"},
    {"icon": "TrendingUp", "value": "数万名", "label": "全网粉", "color": "rose"}
  ]
}'::jsonb),
('stats', '俱乐部数据（会员数可在此手动调整）', '{
  "section_title": "俱乐部数据",
  "section_subtitle": "持续成长的学习社区",
  "member_count": null,
  "start_date": "2025-03-31",
  "footnote": "💪 持续成长的学习社群，与几百位教育者一起探索AI时代的教学设计"
}'::jsonb),
('members', '部分会员简介', '{
  "section_title": "部分会员简介",
  "subtitle": "来自不同领域的优秀教育者都在这里学习成长",
  "footnote": "🌟 他们来自不同学校、不同学科，但有一个共同点：都在认真思考怎样让学生真正学到东西",
  "cta_text": "申请成为会员",
  "cta_link": "http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb",
  "cta_hint": "点击按钮填写报名表单，开启你的学习之旅"
}'::jsonb),
('testimonials', '会员评价', '{
  "section_title": "会员老师们这么说",
  "autoplay_ms": 5000,
  "footnote": "来自俱乐部会员老师的真实反馈，他们在这里收获了专业成长和教学突破"
}'::jsonb),
('faq', 'FAQ 常见问题', '{
  "section_title": "FAQ 常见问题解答"
}'::jsonb)
ON CONFLICT ("section_key") DO NOTHING;

-- ---------- member_profiles：11 位会员 ----------
INSERT INTO "public"."member_profiles" ("icon", "name", "description", "sort_order") VALUES
('👶', '某高校幼儿教育L老师', '专注幼儿教育理论与实践研究', 1),
('💭', '独立人文思辨教育Z老师', '致力于培养学生批判性思维', 2),
('📐', '某小学数学教研员M老师', '小学数学教学研究与指导专家', 3),
('⚛️', '某高中物理L老师', '高中物理教学创新实践者', 4),
('🏛️', '某中学政治R老师', '中学政治课程设计与教学', 5),
('🌍', '某高中英语M老师', '高中英语教学与跨文化交流', 6),
('🎯', '广州一土数学老师', '创新教育理念的践行者', 7),
('💡', '青少年创新PBL课程L老师', '项目式学习课程设计专家', 8),
('🌱', '厌学青少年疗愈导师J老师', '青少年心理疗愈与学习动力激发', 9),
('🌐', '某IB学校L老师', '国际文凭课程教学实践者', 10),
('🎓', '某大学教学设计在读博士', '教学设计理论深度研究者', 11);

-- ---------- faqs：2 条 ----------
INSERT INTO "public"."faqs" ("question", "answer", "sort_order") VALUES
('Q1：俱乐部的课程适合哪些学段、哪些学科的老师？',
 '适合全学段全学科，从小学到高校均可。课程聚焦的是教学设计的底层方法论——理解学习、设计教学、评估效果——这些能力在任何学科、任何学段都通用。我们也有不同的学科教研组，便于大家在具体的教学场景中讨论和应用。', 1),
('Q2：俱乐部能提供一对一的课程指导吗？',
 '不提供一对一指导，但是很欢迎大家在俱乐部内主动发起你的磨课会议。', 2);

-- ---------- testimonials：5 条 ----------
INSERT INTO "public"."testimonials" ("image_url", "alt_text", "sort_order") VALUES
('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xs.jpg', '会员评价：新一期大大的期待！上一期的真实任务实操性真是受益匪浅', 1),
('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xu.jpg', '会员评价：你真是做了好多非常好的归纳总结提炼', 2),
('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf083k.jpg', '会员评价：感觉把你的课吃透，我一家B轮融资的企业去做内训师', 3),
('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf78xt.jpg', '会员评价：哈老师您的思路真的很好，但是我有点疑问', 4),
('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20260403/file-apcr3vmf1gcg.jpg', '会员评价：很喜欢您的课，接地气，也有深度', 5);

-- ---------- resources：40 篇文章（迁出 ResourcesPage 硬编码） ----------
INSERT INTO "public"."resources" ("title", "resource_type", "links", "sort_order") VALUES
('教师主导的教学与以学生为中心的学习是对立的？', 'translation',
 '[{"label":"译文链接","url":"http://xhslink.com/a/aL5Cg6BXMF7cb"},{"label":"原文链接","url":"https://teacherhead.com/2019/12/08/myth-teacher-led-instruction-and-student-centred-learning-are-opposites/?share=jetpack-whatsapp&nb=1"}]'::jsonb, 1),
('哈佛大学大脑认知科学：为什么学过的记不住', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/685d07c80000000012022d14?source=webshare&xhsshare=pc_web&xsec_token=ABsZgc9w6jQ0yuv0zZ8PoeOkDl3Bz3EDL8SNQ4OUKS8mU=&xsec_source=pc_share"}]'::jsonb, 2),
('高手这么设计教学PPT：教师省事，提分有效', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/6853c1b5000000001703031b?source=webshare&xhsshare=pc_web&xsec_token=ABVSBtFpDGGndecfFYD5z68eQzjSGX7_k-uMKwiU1rGNg=&xsec_source=pc_share"}]'::jsonb, 3),
('教学设计经典论文 | 少教不教为什么不管用？', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/684012a3000000000f033939?source=webshare&xhsshare=pc_web&xsec_token=ABYXRtvREUSM0kJqXqBCZCV3EM0FFqsvakrjZF-TTsiwM=&xsec_source=pc_share"}]'::jsonb, 4),
('教师的班级管理课：比尔·罗杰斯的十大理念', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/68355815000000000303f973?source=webshare&xhsshare=pc_web&xsec_token=AB-aN-giAQbPX0LHBh5OvM50uFVzMcpAQ5uGBEFGZ0A8g=&xsec_source=pc_share"}]'::jsonb, 5),
('教学策略：让学生越学越会的10种记忆练习', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/683083dd0000000012004bbf?source=webshare&xhsshare=pc_web&xsec_token=ABJNuh8xyKtjI1g38S30CEuARO00MQBeK5KAe7hKYnDSA=&xsec_source=pc_share"}]'::jsonb, 6),
('翻译 | Cold Call：老师必备的课堂提问五步', 'translation',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/6829ce39000000000c03a8b8?source=webshare&xhsshare=pc_web&xsec_token=ABengL3LNW0KAwHmZ6syZUqs-9XyWYttTQb24-86hqOWU=&xsec_source=pc_share"}]'::jsonb, 7),
('教知识，还是教思维？', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/68258eac000000001101c37c?source=webshare&xhsshare=pc_web&xsec_token=ABzKtIsm0pTXWghDEkIMA-V7zCytpARAmQnQgy84Yaqfk=&xsec_source=pc_share"}]'::jsonb, 8),
('学科知识与教学技巧：哪个更重要', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/682357ea000000001101eb9d?source=webshare&xhsshare=pc_web&xsec_token=ABxvfLOf_EH8wfRlEVXwWZ2_rBrNqKKyOQmYvTZoSgiqQ=&xsec_source=pc_share"}]'::jsonb, 9),
('新书精华翻译 | 显性教学被老师们大大低估', 'translation',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/68216133000000000c03a549?source=webshare&xhsshare=pc_web&xsec_token=ABqbdMizcWKCZto7a5gh1Dc-DXk-dk-tH23kOAK-J-sS0=&xsec_source=pc_share"}]'::jsonb, 10),
('优质教育博客 | 教学到底是艺术还是技术？', 'article',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/681d73bf000000000f030791?source=webshare&xhsshare=pc_web&xsec_token=ABWFmMIkceyw72NOeVCYOOcOC2jE9Bu_efUuYOVYL3c4M=&xsec_source=pc_share"}]'::jsonb, 11),
('外文翻译 | 这样培养成长型思维，效果微弱', 'translation',
 '[{"label":"阅读全文","url":"https://www.xiaohongshu.com/discovery/item/681c3b680000000012007b1a?source=webshare&xhsshare=pc_web&xsec_token=ABcsaZIlSCsq9ksgDXpye5i8nXhdtSm7DgYf1y3tYTA3Q=&xsec_source=pc_share"}]'::jsonb, 12),
('我最近发现，新老师们普遍对教学存在几种误解，以至于在备课上课上走了弯路。', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/OTmKerjMYGR3kQWrq14IfQ"}]'::jsonb, 13),
('建构主义的知识观：知识是被发现的，还是被发明的？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/9wywvx0kUnEIq3dOilpJDA"}]'::jsonb, 14),
('为什么要搞合作学习？我自己学，自己建构知识，不可以吗？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/n7lNKnQ2jSv9ucRPhs7-zw"}]'::jsonb, 15),
('建构主义十问十答：一篇文章回应你对建构主义所有的误解和困惑', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Q6qTMj5nyxIYcgfJdhbonA"}]'::jsonb, 16),
('从技术的角度，重新理解建构主义，老师们需要重构自己的「技术观」。', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/g2Yvt_VkEWKLY7_1UAOzAQ"}]'::jsonb, 17),
('教学设计思考：为什么很多老师最终不得不选择传统的教学方式？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/nuzdiXCV7nWT3H9l4Vl2rQ"}]'::jsonb, 18),
('地图不等于疆界：老师们，别被理论框死了，它只是你的「工具箱」', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/s8PBVW3dLBiatMWD66Dzhw"}]'::jsonb, 19),
('教学培训就好像AI调优，数据、算法、算力，三者缺一不可', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Z13o4InxO10IuTDfjkOiSw"}]'::jsonb, 20),
('追求「花样教学」，不如追求「系统化」的教学设计', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Zz8gtYIUNVP--QdgoMPFJQ"}]'::jsonb, 21),
('反思布卢姆：为何同一知识点的题目难度天壤之别？以2023年北京数学中考试卷为例', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/wwh0fNVK5BwpQfteIhC8Dg"}]'::jsonb, 22),
('一篇课文，四种上法：语文课的教学设计可能性远比你想的多', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/qqlgh1lIalemF8wYaYdLnQ"}]'::jsonb, 23),
('写好教学目标，既是教学设计的第一步，也是教学设计进阶的第一步 | 教学设计101Course第2课：教学目标分析', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/_g_JG90QM0dRibkDcyMkog"}]'::jsonb, 24),
('建构主义教学的迷思：为何主动探索不等于有效学习？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/rmPkbLdEZ8nAHkSXnczE_g"}]'::jsonb, 25),
('教学设计101 Course：01 什么是教学设计？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Nxs9nmR3vLMpv92Ys7W3HQ"}]'::jsonb, 26),
('你为什么要这么上这节课？为什么你要用游戏化/项目式/探究式学习？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/UmpJwXMRkNfKJireMAbkCA"}]'::jsonb, 27),
('专家和新手到底差在哪里？| 浅聊认知负荷理论', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/29pgYZzyNrXKLgMkG5rMAg"}]'::jsonb, 28),
('为了理解科学的教学：学生概念研究，以及学习视角的改变（2002年）', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/p37J_2_eMw-SPfKSRb-LDg"}]'::jsonb, 29),
('编程入门阶段学生的误解以及其他困难：一篇文献综述', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/jR-a0sV3_RH5JY27p9ukbw"}]'::jsonb, 30),
('聊聊学习体验设计 | Learning Experience Design| LXD', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/o12J8wiZ8uMDyw96ZOTE0w"}]'::jsonb, 31),
('建构主义：从哲学到实践（1997年）', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/lDqnO7C6PnJmuLbItnZBWw"}]'::jsonb, 32),
('拒绝假情境 | 浅谈情境教学', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/9YQcdDYtQwoInTHwgUMR6g"}]'::jsonb, 33),
('抽象的儿童与具体的儿童 | 浅谈理解儿童', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Lfrc68i0OWOrNRwuTib-FQ"}]'::jsonb, 34),
('放纵儿童？教训儿童？| 面对儿童行为问题的三个核心原则', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/SkC3ZD8WyUYuoRSefouiBQ"}]'::jsonb, 35),
('拉出教室就是真实性的学习吗？ | 浅谈真实性', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/u7fkmfZBxQBPgCc5Uia1ug"}]'::jsonb, 36),
('如何观察和分析幼儿行为？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/wGz3R8LhV-gku-DJSB2Y_A"}]'::jsonb, 37),
('PBL、克伯屈与杜威｜PBL利弊谈', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/iVYaR_Z8rloPwmv5lA4VUQ"}]'::jsonb, 38),
('大概念、学科结构与布鲁纳 | 大概念利弊谈', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/j5FVHKFEEeIyacoArLB0Pg"}]'::jsonb, 39),
('儿童中心是普世价值吗？| 进步主义教育利弊谈', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/MllntU-Wwz3jiDfnwLL91A"}]'::jsonb, 40),
('如何激发学习者的学习兴趣？', 'wechat',
 '[{"label":"阅读全文","url":"https://mp.weixin.qq.com/s/Xb7cib0N5iLstGZuHvJveg"}]'::jsonb, 41);
