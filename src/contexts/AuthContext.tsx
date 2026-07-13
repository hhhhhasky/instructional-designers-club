import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import { getProfile, signInWithPhone, signUpWithPhone, signOut as doSignOut } from '@/lib/access-control';
import { clearAllLearningDataCaches } from '@/db/api';
import type { Profile, MembershipType } from '@/types/types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  accessLevel: MembershipType;
  signUp: (phone: string, password: string, nickname: string) => Promise<{ error: string | null }>;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const profileLoadId = useRef(0);

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

    const applySession = async (s: Session | null) => {
      const requestId = ++profileLoadId.current;
      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
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
          setLoading(false);
        }
        return;
      }
      if (mounted && profileLoadId.current === requestId) {
        setProfile(p);
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
        void applySession(s);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = async (phone: string, password: string, nickname: string) => {
    setLoading(true);
    try {
      const result = await signUpWithPhone(phone, password, nickname);
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
          }
          return { error: '该账号已停用，请联系管理员' };
        }
        if (profileLoadId.current === requestId) {
          setProfile(p);
        }
      }
      return { error: result.error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (phone: string, password: string) => {
    setLoading(true);
    try {
      const result = await signInWithPhone(phone, password);
      if (!result.error && result.session?.user) {
        const requestId = ++profileLoadId.current;
        setSession(result.session);
        setUser(result.session.user);
        const p = await loadProfile(result.session.user.id, { fresh: true });
        if (profileLoadId.current === requestId) {
          setProfile(p);
        }
      }
      return { error: result.error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    profileLoadId.current++;
    await doSignOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    clearAllLearningDataCaches();
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, accessLevel, signUp, signIn, signOut, refreshProfile }}
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
