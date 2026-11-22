begin;

-- Seed real course records so the current admin can add content to the same lesson URLs.
with chapters as (
  insert into public.course_categories (name, sort_order, is_active, access_product_code)
  values
    ('导论', 1, true, 'gongding-gongkaike'),
    ('公开课上什么', 2, true, 'gongding-gongkaike'),
    ('公开课怎么上', 3, true, 'gongding-gongkaike'),
    ('彩蛋', 4, true, 'gongding-gongkaike')
  returning id, name, sort_order
),
lessons(chapter_number, lesson_number, title) as (
  values
    (1, 1, '四个层次：优质公开课长什么样？'),
    (1, 2, '教学设计四阶段六要素：公开课备课的底层逻辑'),
    (2, 3, '课标｜课标定位：备这节课，该到课标哪里找？'),
    (2, 4, '课标｜课标解读：找到了相关要求，怎么读懂它？'),
    (2, 5, '教材｜单元位置：如何确定一节课在单元中的功能和定位？'),
    (2, 6, '教材｜内容分析：如何用好教材里的素材和栏目？'),
    (2, 7, '学情｜学科误解：学生看起来都会，这节公开课到底还要教什么？'),
    (2, 8, '学情｜认知分析：如何预判公开课学生的错误回答？'),
    (2, 9, '目标｜三大标准：为什么教参上的目标不能拿来备公开课？'),
    (2, 10, '目标｜目标句式：如何写出一个具体、可测量、可评估的学习目标？'),
    (2, 11, '评价｜教学评一体化：如何让评价贯穿公开课的前中后环节？'),
    (2, 12, '评价｜表现性任务：如何设计一个出彩的表现性任务？'),
    (2, 13, '评价｜量规制定：如何研发一个严谨的量规？'),
    (2, 14, '评价｜自评互评：公开课上，怎样让学生根据标准自评、互评，并据此改进？'),
    (3, 15, '流程｜导入：好的公开课导入长什么样？'),
    (3, 16, '流程｜导入：这节公开课到底该怎么开头？'),
    (3, 17, '流程｜问题链：公开课提问又多又散，怎么办？'),
    (3, 18, '流程｜任务链：怎样设计任务才有递进？'),
    (3, 19, '流程｜情境链：如何不让情境创设像过家家？'),
    (3, 20, '流程｜核心议题：如何用来组织整节课？'),
    (3, 21, '环节｜教学策略：讲授、练习、探究、合作，什么时候用哪种？'),
    (3, 22, '环节｜学习支架：学生学不会，我能提供哪些支持？'),
    (3, 23, '环节｜理答追问：如何对学生的回答和表现进行判断、反馈和调整？'),
    (3, 24, '磨课｜评课意见一大堆，到底哪些应该改？'),
    (4, 25, '大单元｜只上一课时，怎么体现大单元教学？'),
    (4, 26, '大单元｜大单元的核心任务怎样分到几节课？'),
    (4, 27, 'AI 融合｜AI 技术，除了智能体、数字人、AI 动画，还有哪些用法？'),
    (4, 28, 'AI 融合｜我这节课怎么融合 AI 更适合？'),
    (4, 29, '项目式学习｜项目的驱动性问题怎么设计？'),
    (4, 30, '项目式学习｜一节公开课，能让学生把项目往前推进哪一步？'),
    (4, 31, '说课｜说课框架：怎样说清这节课为什么这样设计？'),
    (4, 32, '说课｜只有 10 分钟，哪些内容值得讲？')
)
insert into public.courses (
  title, description, instructor, category_id, category, sort_order,
  status, access_product_code, membership_type, is_trial, duration, level
)
select
  lessons.title, '哈老师正在加班加点研发中，请大家敬请期待', '哈老师',
  chapters.id, chapters.name, lessons.lesson_number, 'published', 'gongding-gongkaike',
  'plus', false, null, null
from lessons
join chapters on chapters.sort_order = lessons.chapter_number
order by lessons.lesson_number;

commit;
