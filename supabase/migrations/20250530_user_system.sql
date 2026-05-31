-- ============================================================
-- 教学设计师俱乐部 - 用户系统迁移
-- 创建时间: 2025-05-30
-- 说明: 用户资料表、学习记录表、头像存储桶、RLS 策略
-- ============================================================

-- ==================== 枚举类型 ====================

CREATE TYPE "public"."access_level" AS ENUM ('free', 'plus', 'pro');
CREATE TYPE "public"."user_status" AS ENUM ('active', 'banned');
CREATE TYPE "public"."learning_status" AS ENUM ('not_started', 'in_progress', 'completed');

-- ==================== 用户资料表 ====================

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "phone" character varying(20) NOT NULL UNIQUE,
    "nickname" character varying(50) NOT NULL,
    "avatar_url" "text",
    "access_level" "public"."access_level" DEFAULT 'free'::"public"."access_level" NOT NULL,
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

COMMENT ON TABLE "public"."profiles" IS '用户资料表';
COMMENT ON COLUMN "public"."profiles"."id" IS '用户ID，关联 auth.users';
COMMENT ON COLUMN "public"."profiles"."phone" IS '手机号（登录账号）';
COMMENT ON COLUMN "public"."profiles"."nickname" IS '昵称（网站内显示）';
COMMENT ON COLUMN "public"."profiles"."avatar_url" IS '头像URL';
COMMENT ON COLUMN "public"."profiles"."access_level" IS '访问等级：free/plus/pro';
COMMENT ON COLUMN "public"."profiles"."status" IS '账号状态：active/banned';

-- ==================== 学习记录表 ====================

CREATE TABLE "public"."learning_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "course_id" "uuid" NOT NULL REFERENCES "public"."courses"("id") ON DELETE CASCADE,
    "status" "public"."learning_status" DEFAULT 'not_started'::"public"."learning_status" NOT NULL,
    "watch_count" integer DEFAULT 0 NOT NULL,
    "progress" numeric(5,2) DEFAULT 0 NOT NULL,
    "last_watched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    UNIQUE ("user_id", "course_id")
);

COMMENT ON TABLE "public"."learning_records" IS '学习记录表';
COMMENT ON COLUMN "public"."learning_records"."status" IS '学习状态：not_started/in_progress/completed';
COMMENT ON COLUMN "public"."learning_records"."watch_count" IS '观看次数';
COMMENT ON COLUMN "public"."learning_records"."progress" IS '学习进度百分比(0-100)';
COMMENT ON COLUMN "public"."learning_records"."last_watched_at" IS '最后观看时间';

-- ==================== 索引 ====================

CREATE INDEX "idx_profiles_phone" ON "public"."profiles" USING "btree" ("phone");
CREATE INDEX "idx_profiles_access_level" ON "public"."profiles" USING "btree" ("access_level");
CREATE INDEX "idx_learning_records_user_id" ON "public"."learning_records" USING "btree" ("user_id");
CREATE INDEX "idx_learning_records_course_id" ON "public"."learning_records" USING "btree" ("course_id");

-- ==================== 触发器：新用户注册时自动创建资料 ====================

CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO "public"."profiles" ("id", "phone", "nickname")
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'nickname', '学员')
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."handle_new_user"() IS '新用户注册时自动创建 profiles 记录';

CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."handle_new_user"();

-- ==================== 触发器：自动更新 updated_at ====================

CREATE TRIGGER "update_profiles_updated_at"
    BEFORE UPDATE ON "public"."profiles"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TRIGGER "update_learning_records_updated_at"
    BEFORE UPDATE ON "public"."learning_records"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ==================== RLS 策略 ====================

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."learning_records" ENABLE ROW LEVEL SECURITY;

-- profiles: 用户可查看自己的资料
CREATE POLICY "Users can view own profile"
    ON "public"."profiles" FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- profiles: 用户可更新自己的资料
CREATE POLICY "Users can update own profile"
    ON "public"."profiles" FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- 管理员检查函数（绕过 RLS 避免递归）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND access_level = 'pro'
  );
$$;

-- profiles: 管理员可管理所有资料
CREATE POLICY "Admin full access profiles"
    ON "public"."profiles" FOR ALL
    TO authenticated
    USING (public.is_admin());

-- learning_records: 用户可查看自己的记录
CREATE POLICY "Users can view own records"
    ON "public"."learning_records" FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- learning_records: 用户可插入自己的记录
CREATE POLICY "Users can insert own records"
    ON "public"."learning_records" FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- learning_records: 用户可更新自己的记录
CREATE POLICY "Users can update own records"
    ON "public"."learning_records" FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- ==================== 头像存储桶 ====================

INSERT INTO "storage"."buckets" ("id", "name", "public")
VALUES ('avatars', 'avatars', true)
ON CONFLICT ("id") DO NOTHING;

-- 头像存储策略：用户只能上传到自己的目录
CREATE POLICY "Users can upload own avatar"
    ON "storage"."objects" FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
    ON "storage"."objects" FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 头像存储策略：公开读取
CREATE POLICY "Avatar bucket is publicly readable"
    ON "storage"."objects" FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
