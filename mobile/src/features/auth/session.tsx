import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { db, isBackendConfigured, backendLabel, isSqlite } from "@/src/lib/db";

export type AppUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string };
};

export type AppSession = {
  access_token: string;
  user: AppUser;
};

export type Profile = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  ai_consent?: boolean | null;
};

type Ctx = {
  session: AppSession | null;
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  backendLabel: string;
  isSqlite: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id ?? (await db.auth.getUser()).data.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    // Schema uses full_name (web/sqlite); display_name is a soft alias
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email, ai_consent")
      .eq("id", uid)
      .maybeSingle();
    if (data) {
      setProfile({
        ...(data as Profile),
        display_name: (data as Profile).full_name ?? (data as Profile).display_name,
      });
    } else {
      setProfile({ id: uid });
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isBackendConfigured()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    // Don't hang forever on boot if SecureStore / network is slow (was 8s → felt like stuck splash).
    const bootTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("[session] getSession timed out — continuing without session");
        setLoading(false);
      }
    }, 2500);

    db.auth
      .getSession()
      .then(({ data }: { data: { session: AppSession | null } }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
        clearTimeout(bootTimeout);
      })
      .catch((e: unknown) => {
        console.warn("[session] getSession failed:", e);
        if (mounted) {
          setSession(null);
          setLoading(false);
          clearTimeout(bootTimeout);
        }
      });

    const { data: sub } = db.auth.onAuthStateChange(
      (_event: string, next: AppSession | null) => {
        setSession(next);
        if (mounted) setLoading(false);
      },
    );

    return () => {
      mounted = false;
      clearTimeout(bootTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) void refreshProfile();
    else setProfile(null);
  }, [session?.user?.id, refreshProfile]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      configured: isBackendConfigured(),
      backendLabel: backendLabel(),
      isSqlite,
      refreshProfile,
      signIn: async (email, password) => {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message || "Sign in failed");
        const { data } = await db.auth.getSession();
        setSession(data.session);
      },
      signUp: async (email, password, fullName) => {
        const { data: signed, error } = await db.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw new Error(error.message || "Sign up failed");
        // Prefer immediate session from signUp; fall back to getSession
        if (signed?.session) {
          setSession(signed.session as AppSession);
        } else {
          const { data } = await db.auth.getSession();
          setSession(data.session);
        }
      },
      signOut: async () => {
        await db.auth.signOut();
        setSession(null);
        setProfile(null);
      },
    }),
    [session, profile, loading, refreshProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
