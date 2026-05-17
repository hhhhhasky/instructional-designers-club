-- ============================================================
-- 教学设计师俱乐部 - 业务表迁移 SQL
-- 用于自建 Supabase 项目
-- ============================================================

-- 1. 自定义枚举类型
CREATE TYPE "public"."course_level" AS ENUM (
    '入门',
    '初级',
    '中级',
    '高级'
);

CREATE TYPE "public"."course_status" AS ENUM (
    'draft',
    'published',
    'archived'
);

CREATE TYPE "public"."log_action" AS ENUM (
    'create',
    'update',
    'delete',
    'publish',
    'archive',
    'restore'
);

CREATE TYPE "public"."resource_type" AS ENUM (
    'pdf',
    'video',
    'link',
    'document',
    'image',
    'other'
);

CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'editor',
    'viewer'
);

-- 2. 课程分类表
CREATE TABLE "public"."course_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "scenarios" "text"[] DEFAULT '{}'::"text"[],
    "applicable_audience" "text"[] DEFAULT '{}'::"text"[],
    "applicable_scenarios" "text"[] DEFAULT '{}'::"text"[],
    "content_types" "text"[] DEFAULT '{}'::"text"[]
);

COMMENT ON TABLE "public"."course_categories" IS '课程类别表';
COMMENT ON COLUMN "public"."course_categories"."name" IS '类别名称';
COMMENT ON COLUMN "public"."course_categories"."sort_order" IS '排序顺序（数字越小越靠前）';
COMMENT ON COLUMN "public"."course_categories"."is_active" IS '是否启用';
COMMENT ON COLUMN "public"."course_categories"."applicable_audience" IS '适用人群';
COMMENT ON COLUMN "public"."course_categories"."applicable_scenarios" IS '适用场景';
COMMENT ON COLUMN "public"."course_categories"."content_types" IS '内容类型';

-- 3. 课程表
CREATE TABLE "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "instructor" character varying(100),
    "category_id" "uuid",
    "category" character varying(100),
    "level" "public"."course_level" DEFAULT '入门'::"public"."course_level",
    "semester" character varying(50),
    "duration" integer DEFAULT 60,
    "credits" numeric(3,1) DEFAULT 0.0,
    "status" "public"."course_status" DEFAULT 'draft'::"public"."course_status",
    "image_url" "text",
    "video_url" "text",
    "meeting_url" "text",
    "sort_order" integer DEFAULT 0,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "membership_type" "text" DEFAULT 'plus'::"text",
    "is_trial" boolean DEFAULT false,
    CONSTRAINT "courses_membership_type_check" CHECK (("membership_type" = ANY (ARRAY['free'::"text", 'plus'::"text", 'pro'::"text"])))
);

COMMENT ON TABLE "public"."courses" IS '课程主表';
COMMENT ON COLUMN "public"."courses"."title" IS '课程名称';
COMMENT ON COLUMN "public"."courses"."instructor" IS '授课教师/讲师';
COMMENT ON COLUMN "public"."courses"."category_id" IS '课程类别ID（外键）';
COMMENT ON COLUMN "public"."courses"."category" IS '课程类别（冗余字段）';
COMMENT ON COLUMN "public"."courses"."level" IS '难度级别';
COMMENT ON COLUMN "public"."courses"."duration" IS '课时（分钟）';
COMMENT ON COLUMN "public"."courses"."status" IS '课程状态';
COMMENT ON COLUMN "public"."courses"."membership_type" IS '会员类型：free/plus/pro';
COMMENT ON COLUMN "public"."courses"."is_trial" IS '是否为试看课程';

-- 4. 访客统计表
CREATE TABLE "public"."visitor_stats" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "visitor_uuid" "uuid" NOT NULL,
    "visit_count" integer DEFAULT 1 NOT NULL,
    "first_visit_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_visit_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON TABLE "public"."visitor_stats" IS '访客统计表';

-- 5. 分类与课程关联视图
CREATE VIEW "public"."v_category_course_mapping" AS
 SELECT "cc"."id" AS "category_id",
    "cc"."name" AS "category_name",
    "cc"."sort_order" AS "category_sort_order",
    "cc"."is_active" AS "category_is_active",
    "c"."id" AS "course_id",
    "c"."title" AS "course_title",
    "c"."membership_type",
    "c"."sort_order" AS "course_sort_order",
    "c"."status" AS "course_status"
   FROM ("public"."course_categories" "cc"
     LEFT JOIN "public"."courses" "c" ON (("cc"."name")::"text" = ("c"."category")::"text"))
  ORDER BY "cc"."sort_order", "c"."sort_order";

COMMENT ON VIEW "public"."v_category_course_mapping" IS '分类与课程关联视图';

-- 6. 索引
CREATE INDEX "idx_course_categories_applicable_audience" ON "public"."course_categories" USING "gin" ("applicable_audience");
CREATE INDEX "idx_course_categories_applicable_scenarios" ON "public"."course_categories" USING "gin" ("applicable_scenarios");
CREATE INDEX "idx_course_categories_content_types" ON "public"."course_categories" USING "gin" ("content_types");
CREATE INDEX "idx_course_categories_is_active" ON "public"."course_categories" USING "btree" ("is_active");
CREATE INDEX "idx_course_categories_name" ON "public"."course_categories" USING "btree" ("name");
CREATE INDEX "idx_course_categories_scenarios" ON "public"."course_categories" USING "gin" ("scenarios");
CREATE INDEX "idx_course_categories_sort_order" ON "public"."course_categories" USING "btree" ("sort_order");
CREATE INDEX "idx_courses_category" ON "public"."courses" USING "btree" ("category");
CREATE INDEX "idx_courses_category_id" ON "public"."courses" USING "btree" ("category_id");
CREATE INDEX "idx_courses_created_at" ON "public"."courses" USING "btree" ("created_at" DESC);
CREATE INDEX "idx_courses_is_trial" ON "public"."courses" USING "btree" ("is_trial");
CREATE INDEX "idx_courses_level" ON "public"."courses" USING "btree" ("level");
CREATE INDEX "idx_courses_membership_type" ON "public"."courses" USING "btree" ("membership_type");
CREATE INDEX "idx_courses_sort_order" ON "public"."courses" USING "btree" ("sort_order");
CREATE INDEX "idx_courses_status" ON "public"."courses" USING "btree" ("status");
CREATE INDEX "idx_courses_title" ON "public"."courses" USING "btree" ("title");
CREATE INDEX "idx_visitor_stats_uuid" ON "public"."visitor_stats" USING "btree" ("visitor_uuid");

-- 7. 函数：记录访客访问
CREATE OR REPLACE FUNCTION "public"."record_visit"("p_visitor_uuid" "uuid")
RETURNS "json"
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_unique_visitors bigint;
    v_total_visits bigint;
BEGIN
    INSERT INTO visitor_stats (visitor_uuid, visit_count, first_visit_at, last_visit_at)
    VALUES (p_visitor_uuid, 1, now(), now())
    ON CONFLICT DO NOTHING;

    UPDATE visitor_stats
    SET visit_count = visit_count + 1,
        last_visit_at = now()
    WHERE visitor_uuid = p_visitor_uuid;

    SELECT COUNT(*) INTO v_unique_visitors FROM visitor_stats;
    SELECT COALESCE(SUM(visit_count), 0) INTO v_total_visits FROM visitor_stats;

    RETURN json_build_object(
        'unique_visitors', v_unique_visitors,
        'total_visits', v_total_visits
    );
END;
$$;

-- 8. 函数：增加课程浏览次数
CREATE OR REPLACE FUNCTION "public"."increment_course_view_count"("course_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql"
AS $$
BEGIN
    UPDATE courses SET view_count = view_count + 1 WHERE id = course_id;
END;
$$;

-- 9. 函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 10. 触发器：自动更新 updated_at
CREATE TRIGGER "update_course_categories_updated_at"
    BEFORE UPDATE ON "public"."course_categories"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_courses_updated_at"
    BEFORE UPDATE ON "public"."courses"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- 11. 开启公开访问（前端用 anon key 访问）
ALTER TABLE "public"."course_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."visitor_stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read course_categories"
    ON "public"."course_categories" FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow public read courses"
    ON "public"."courses" FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow public insert visitor_stats"
    ON "public"."visitor_stats" FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow public read visitor_stats"
    ON "public"."visitor_stats" FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow public update visitor_stats"
    ON "public"."visitor_stats" FOR UPDATE
    TO anon, authenticated
    USING (true);
