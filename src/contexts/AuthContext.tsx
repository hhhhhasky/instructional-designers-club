import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import { getProfile, getUserCourseAccessCodes, signInWithIdentifier, signUpWithEmailAndPhone, signOut as doSignOut } from '@/lib/access-control';
import { clearAllLearningDataCaches } from '@/db/api';
import type { CourseAccessCode, Profile, MembershipType } from '@/types/types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  accessLevel: MembershipType;
  courseAccessCodes: CourseAccessCode[];
  signUp: (phone: string, password: string, nickname: string, email: string) => Promise<{ error: string | null; requiresConfirmation?: boolean }>;
  signIn: (phone: string, password: string) => Promise<{ error: string | null; needsEmail?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseAccessCodes, setCourseAccessCodes] = useState<CourseAccessCode[]>([]);
  const profileLoadId = useRef(0);
  // 最新账号身份，供认证事件判断是否只是同一用户的令牌刷新。
  const currentUserRef = useRef<string | null>(null);

  const accessLevel: MembershipType = profile?.access_level ?? 'free';

  const loadProfile = useCallback(async (
    userId: string,
    options: { fresh?: boolean } = {},
  ): Promise<Profile | null> => {
    let retries = 0;
    while (retries < 10) {
      const p = await getProfile(userId, { fresh: options.fresh && retries === 0 });
      if (p) {
        return p;
      }
      retries++;
      // 递增延迟：500ms, 750ms, 1000ms...
      const delay = 500 + retries * 250;
      await new Promise((r) => setTimeout(r, delay));
    }
    console.error('Failed to load profile after retries');
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const requestId = ++profileLoadId.current;
      setLoading(true);
      try {
        const p = await loadProfile(user.id, { fresh: true });
        if (profileLoadId.current === requestId) {
          setProfile(p);
          setCourseAccessCodes(p ? await getUserCourseAccessCodes(p) : []);
        }
      } finally {
        if (profileLoadId.current === requestId) {
          setLoading(false);
        }
      }
    }
  }, [user, loadProfile]);

  // 初始化：获取已有 session
  useEffect(() => {
    let mounted = true;

    const applySession = async (s: Session | null, options: { silent?: boolean } = {}) => {
      const requestId = ++profileLoadId.current;
      // 同一用户的静默刷新不点亮加载门：只有 loading 已被某次请求点亮时，
      // 完成时才允许熄灭，避免半途打断正在进行的登录/启动加载。
      const { silent } = options;
      currentUserRef.current = s?.user?.id ?? null;
      if (!silent) setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setCourseAccessCodes([]);
        if (mounted && profileLoadId.current === requestId) {
          setLoading(false);
        }
        return;
      }

      const p = await loadProfile(s.user.id);
      if (p?.status === 'banned') {
        await doSignOut();
        if (mounted && profileLoadId.current === requestId) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setCourseAccessCodes([]);
          setLoading(false);
        }
        return;
      }
      if (mounted && profileLoadId.current === requestId) {
        setProfile(p);
        setCourseAccessCodes(p ? await getUserCourseAccessCodes(p) : []);
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      await applySession(s);
    });

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (import.meta.env.DEV) {
        console.info("[auth-diagnostics] supabase auth state changed", {
          at: new Date().toISOString(),
          event,
          hasSession: Boolean(s),
          userId: s?.user?.id ?? null,
          expiresAt: s?.expires_at ?? null,
        });
      }
      setTimeout(() => {
        // 切回标签页触发令牌刷新（SIGNED_IN）、定时续期（TOKEN_REFRESHED）与
        // 改资料（USER_UPDATED）都不改变账号身份：静默更新会话并后台复检资料，
        // 不点亮加载门，避免路由页面被卸载、表单状态丢失。
        const silent = Boolean(s?.user && currentUserRef.current === s.user.id);
        void applySession(s, { silent });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = async (phone: string, password: string, nickname: string, email: string) => {
    setLoading(true);
    try {
      const result = await signUpWithEmailAndPhone(email, phone, password, nickname);
      if (!result.error && result.session?.user) {
        const requestId = ++profileLoadId.current;
        setSession(result.session);
        setUser(result.session.user);
        const p = await loadProfile(result.session.user.id, { fresh: true });
        if (p?.status === 'banned') {
          await doSignOut();
          if (profileLoadId.current === requestId) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setCourseAccessCodes([]);
          }
          return { error: '该账号已停用，请联系管理员' };
        }
        if (profileLoadId.current === requestId) {
          setProfile(p);
          setCourseAccessCodes(p ? await getUserCourseAccessCodes(p) : []);
        }
      }
      return { error: result.error, requiresConfirmation: !result.error && !result.session };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (phone: string, password: string) => {
    setLoading(true);
    try {
      const result = await signInWithIdentifier(phone, password);
      if (!result.error && result.session?.user) {
        const requestId = ++profileLoadId.current;
        setSession(result.session);
        setUser(result.session.user);
        const p = await loadProfile(result.session.user.id, { fresh: true });
        if (profileLoadId.current === requestId) {
          setProfile(p);
          setCourseAccessCodes(p ? await getUserCourseAccessCodes(p) : []);
        }
      }
      return { error: result.error, needsEmail: !!result.user?.email?.endsWith('@phone.local') };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    profileLoadId.current++;
    await doSignOut();
    setUser(null);
    setProfile(null);
    setCourseAccessCodes([]);
    setSession(null);
    clearAllLearningDataCaches();
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, accessLevel, courseAccessCodes, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
