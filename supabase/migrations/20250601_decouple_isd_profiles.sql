-- ============================================================
-- 教学设计师俱乐部 - 解耦 isd_profiles 表
-- 创建时间: 2025-06-01
-- 说明: 移除 profiles ↔ isd_profiles 之间的数据同步触发器，
--       确保本项目注册用户信息只写入 profiles 表，
--       不再影响 isd_profiles（另一项目的用户数据表）。
-- ============================================================

-- 1. 查找并删除 profiles 表上同步到 isd_profiles 的触发器
--    如果 handle_new_user 本身被修改过，则重建为只写 profiles 的版本
DO $$
DECLARE
    trig_record RECORD;
    func_record RECORD;
    is_handle_new_user_tainted BOOLEAN := FALSE;
BEGIN
    -- 检查 handle_new_user 是否被修改为也写入 isd_profiles
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.proname = 'handle_new_user'
          AND p.pronamespace = 'public'::regnamespace
          AND (p.prosrc ILIKE '%isd_profiles%' OR p.prosrc ILIKE '%isd.%profiles%')
    ) INTO is_handle_new_user_tainted;

    -- 查找引用 isd_profiles 的触发器函数并删除对应触发器
    FOR trig_record IN
        SELECT DISTINCT
            t.tgname AS trigger_name,
            t.tgrelid::regclass AS table_name,
            p.proname AS function_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE p.prosrc ILIKE '%isd_profiles%'
           OR p.prosrc ILIKE '%isd.%profiles%'
    LOOP
        -- handle_new_user 的触发器 on_auth_user_created 需要保留，只重建函数
        IF trig_record.function_name = 'handle_new_user' THEN
            RAISE NOTICE '跳过删除 on_auth_user_created 触发器（将重建函数）';
        ELSE
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s',
                trig_record.trigger_name, trig_record.table_name);
            RAISE NOTICE '已删除触发器: % ON %', trig_record.trigger_name, trig_record.table_name;
        END IF;
    END LOOP;

    -- 删除引用 isd_profiles 的触发器函数（handle_new_user 除外，后面重建）
    FOR func_record IN
        SELECT p.proname, p.pronamespace::regnamespace AS schema_name
        FROM pg_proc p
        WHERE (p.prosrc ILIKE '%isd_profiles%'
               OR p.prosrc ILIKE '%isd.%profiles%')
          AND p.proname != 'handle_new_user'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I() CASCADE',
            func_record.schema_name, func_record.proname);
        RAISE NOTICE '已删除函数: %.%', func_record.schema_name, func_record.proname;
    END LOOP;

    -- 如果 handle_new_user 被污染，重建为只写入 profiles 的版本
    IF is_handle_new_user_tainted THEN
        -- 先删除旧版本（CASCADE 会保留触发器 on_auth_user_created）
        -- 注意：DROP FUNCTION CASCADE 会删除依赖的触发器，所以需要重建触发器
        EXECUTE 'DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE';
        RAISE NOTICE '已删除被污染的 handle_new_user 函数';

        -- 重建 handle_new_user：只写入 profiles
        EXECUTE $recreate$
            CREATE OR REPLACE FUNCTION public.handle_new_user()
            RETURNS trigger
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $fn$
            BEGIN
                INSERT INTO public.profiles (id, phone, nickname)
                VALUES (
                    NEW.id,
                    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
                    COALESCE(NEW.raw_user_meta_data->>'nickname', '学员')
                );
                RETURN NEW;
            END;
            $fn$;
        $recreate$;
        RAISE NOTICE '已重建 handle_new_user 函数（只写入 profiles）';

        -- 重建 on_auth_user_created 触发器
        EXECUTE $recreate_trigger$
            CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW
                EXECUTE FUNCTION public.handle_new_user();
        $recreate_trigger$;
        RAISE NOTICE '已重建 on_auth_user_created 触发器';
    END IF;
END $$;

-- 2. 删除 auth.users 上可能存在的第二个触发器（也往 isd_profiles 写数据）
--    常见命名: on_auth_user_created_isd, trg_auth_isd_profiles 等
DO $$
DECLARE
    trig_record RECORD;
BEGIN
    FOR trig_record IN
        SELECT t.tgname AS trigger_name, p.proname AS function_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid = 'auth.users'::regclass
          AND t.tgname != 'on_auth_user_created'     -- 保留本项目自己的触发器
          AND p.proname != 'handle_new_user'           -- 排除本项目的核心函数
          AND (
              p.prosrc ILIKE '%isd_profiles%'
              OR p.prosrc ILIKE '%isd.%profiles%'
              OR p.proname ILIKE '%isd%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users',
            trig_record.trigger_name);
        RAISE NOTICE '已删除 auth.users 上的触发器: %', trig_record.trigger_name;
    END LOOP;

    -- 清理残留的 isd 相关触发器函数（已无触发器引用的）
    FOR trig_record IN
        SELECT p.proname, p.pronamespace::regnamespace AS schema_name
        FROM pg_proc p
        WHERE (p.prosrc ILIKE '%isd_profiles%' OR p.proname ILIKE '%_isd_%')
          AND p.proname NOT IN ('handle_new_user')
          AND NOT EXISTS (
              SELECT 1 FROM pg_trigger t WHERE t.tgfoid = p.oid
          )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I() CASCADE',
            trig_record.schema_name, trig_record.proname);
        RAISE NOTICE '已删除无引用的 isd 函数: %.%', trig_record.schema_name, trig_record.proname;
    END LOOP;
END $$;

-- 3. 删除 profiles 表上除本项目外的其他触发器（保守清理）
DO $$
DECLARE
    trig_record RECORD;
BEGIN
    FOR trig_record IN
        SELECT t.tgname AS trigger_name, p.proname AS function_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid = 'profiles'::regclass
          AND t.tgname NOT IN (
              'update_profiles_updated_at',  -- 本项目的 updated_at 触发器
              'on_auth_user_created'          -- 不应在这里，但以防万一
          )
          AND (
              p.prosrc ILIKE '%isd_profiles%'
              OR p.prosrc ILIKE '%isd.%profiles%'
              OR p.proname ILIKE '%isd%'
              OR p.proname ILIKE '%sync%profile%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON profiles',
            trig_record.trigger_name);
        RAISE NOTICE '已删除 profiles 上的同步触发器: %', trig_record.trigger_name;
    END LOOP;
END $$;
