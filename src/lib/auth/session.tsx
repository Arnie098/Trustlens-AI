import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, db } from "@/lib/db";

/** Minimal session shape shared by Supabase and local SQLite auth. */
export interface AppUser {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string };
  app_metadata?: { roles?: string[]; is_admin?: boolean };
  role?: string;
}

export interface AppSession {
  access_token: string;
  user: AppUser;
}

interface SessionCtx {
  session: AppSession | null;
  user: AppUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  roles: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  preferred_language: string;
  avatar_url: string | null;
  ai_consent: boolean;
  ai_consent_at: string | null;
  notification_email: boolean;
}

const Ctx = createContext<SessionCtx>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  roles: [],
  loading: true,
  refresh: async () => {},
});

function rolesFromUser(user: AppUser | null | undefined): string[] {
  if (!user) return [];
  const fromMeta = user.app_metadata?.roles;
  if (Array.isArray(fromMeta) && fromMeta.length) return fromMeta;
  return [];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (userId: string | undefined, sessionUser?: AppUser | null) => {
    if (!userId) {
      setProfile(null);
      setIsAdmin(false);
      setRoles([]);
      return;
    }

    // Prefer roles from session (DB-backed auth embeds them); fall back to table
    let nextRoles = rolesFromUser(sessionUser);
    if (!nextRoles.length) {
      const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", userId);
      nextRoles = (roleRows ?? []).map((r: { role: string }) => r.role);
    }

    const { data: p } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(p ?? null);
    setRoles(nextRoles);
    setIsAdmin(
      nextRoles.includes("admin") ||
        sessionUser?.app_metadata?.is_admin === true ||
        sessionUser?.role === "admin",
    );
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }: { data: { session: AppSession | null } }) => {
      if (!mounted) return;
      setSession(data.session);
      await load(data.session?.user.id, data.session?.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, sess: AppSession | null) => {
        setSession(sess);
        setTimeout(() => load(sess?.user.id, sess?.user), 0);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    await load(session?.user.id, session?.user);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        roles,
        loading,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
