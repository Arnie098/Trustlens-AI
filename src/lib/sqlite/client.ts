/**
 * Browser/client Supabase-compatible facade for local SQLite mode.
 * Routes talk to /api/local/* which uses data/trustlens.db on the server.
 */

const SESSION_KEY = "trustlens.local.session";

type AuthListener = (event: string, session: LocalSession | null) => void;

export interface LocalUser {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
  app_metadata: { roles?: string[]; is_admin?: boolean };
  aud: string;
  role: string;
  created_at: string;
}

export interface LocalSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: LocalUser;
}

interface Filter {
  op: "eq" | "in";
  column: string;
  value: unknown;
}

interface QueryPayload {
  action: "select" | "insert" | "update" | "delete" | "upsert";
  table: string;
  select?: string;
  values?: unknown;
  filters?: Filter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  count?: "exact" | null;
  head?: boolean;
  single?: boolean;
  maybeSingle?: boolean;
  onConflict?: string;
  returning?: boolean;
}

async function postQuery(body: QueryPayload) {
  const res = await fetch("/api/local/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    data: unknown;
    error: { message: string } | null;
    count: number | null;
  };
  return json;
}

async function postAuth(body: Record<string, unknown>) {
  const res = await fetch("/api/local/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    data: { session?: LocalSession | null; user?: LocalUser | null };
    error: { message: string } | null;
  };
}

function loadSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as LocalSession;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(session: LocalSession | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

const authListeners = new Set<AuthListener>();

function notifyAuth(event: string, session: LocalSession | null) {
  for (const fn of authListeners) {
    try {
      fn(event, session);
    } catch {
      /* ignore */
    }
  }
}

class QueryBuilder implements PromiseLike<{
  data: unknown;
  error: { message: string } | null;
  count: number | null;
}> {
  private table: string;
  private state: {
    action: QueryPayload["action"];
    select?: string;
    values?: unknown;
    filters: Filter[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
    count?: "exact" | null;
    head?: boolean;
    single?: boolean;
    maybeSingle?: boolean;
    onConflict?: string;
    returning?: boolean;
  };

  constructor(table: string) {
    this.table = table;
    this.state = { action: "select", filters: [] };
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.state.action === "insert" || this.state.action === "update" || this.state.action === "upsert") {
      this.state.returning = true;
      this.state.select = columns;
    } else {
      this.state.action = "select";
      this.state.select = columns;
    }
    if (opts?.count) this.state.count = opts.count;
    if (opts?.head) this.state.head = true;
    return this;
  }

  insert(values: unknown) {
    this.state.action = "insert";
    this.state.values = values;
    return this;
  }

  update(values: unknown) {
    this.state.action = "update";
    this.state.values = values;
    return this;
  }

  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.state.action = "upsert";
    this.state.values = values;
    if (opts?.onConflict) this.state.onConflict = opts.onConflict;
    return this;
  }

  delete() {
    this.state.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.state.filters.push({ op: "in", column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.state.order = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.state.limit = n;
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }

  private payload(): QueryPayload {
    return {
      action: this.state.action,
      table: this.table,
      select: this.state.select,
      values: this.state.values as QueryPayload["values"],
      filters: this.state.filters,
      order: this.state.order,
      limit: this.state.limit,
      count: this.state.count,
      head: this.state.head,
      single: this.state.single,
      maybeSingle: this.state.maybeSingle,
      onConflict: this.state.onConflict,
      returning: this.state.returning,
    };
  }

  then<TResult1 = { data: unknown; error: { message: string } | null; count: number | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: { message: string } | null; count: number | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return postQuery(this.payload()).then(onfulfilled, onrejected);
  }
}

class StorageBucket {
  constructor(private bucket: string) {}

  async upload(path: string, file: File | Blob) {
    const form = new FormData();
    form.set("path", `${this.bucket}/${path}`);
    form.set("file", file);
    const res = await fetch("/api/local/storage/upload", { method: "POST", body: form });
    const json = (await res.json()) as { data: { path: string } | null; error: { message: string } | null };
    if (json.error) return { data: null, error: json.error };
    return { data: { path: path }, error: null };
  }

  getPublicUrl(path: string) {
    return {
      data: {
        publicUrl: `/api/local/storage/object/${encodeURIComponent(`${this.bucket}/${path}`)}`,
      },
    };
  }
}

export const localClient = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  auth: {
    async getSession() {
      const local = loadSession();
      if (!local?.access_token) return { data: { session: null }, error: null };

      // Revalidate against DB-backed sessions when possible
      try {
        const res = await postAuth({
          action: "getSession",
          access_token: local.access_token,
        });
        if (res.error || !res.data.session) {
          saveSession(null);
          return { data: { session: null }, error: null };
        }
        saveSession(res.data.session as LocalSession);
        return { data: { session: res.data.session as LocalSession }, error: null };
      } catch {
        // Offline / API down — use cached session until proven invalid
        return { data: { session: local }, error: null };
      }
    },

    async getUser() {
      const { data } = await localClient.auth.getSession();
      return { data: { user: data.session?.user ?? null }, error: null };
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const res = await postAuth({ action: "signInWithPassword", email, password });
      if (res.error || !res.data.session) {
        return { data: { session: null, user: null }, error: res.error ?? { message: "Login failed" } };
      }
      saveSession(res.data.session as LocalSession);
      notifyAuth("SIGNED_IN", res.data.session as LocalSession);
      return {
        data: {
          session: res.data.session as LocalSession,
          user: (res.data.session as LocalSession).user,
        },
        error: null,
      };
    },

    async signUp(args: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string }; emailRedirectTo?: string };
    }) {
      const res = await postAuth({
        action: "signUp",
        email: args.email,
        password: args.password,
        full_name: args.options?.data?.full_name,
      });
      if (res.error) {
        return { data: { session: null, user: null }, error: res.error };
      }
      if (res.data.session) {
        saveSession(res.data.session as LocalSession);
        notifyAuth("SIGNED_IN", res.data.session as LocalSession);
      }
      return {
        data: {
          session: (res.data.session as LocalSession) ?? null,
          user: (res.data.user as LocalUser) ?? null,
        },
        error: null,
      };
    },

    async signOut() {
      const local = loadSession();
      try {
        await postAuth({ action: "signOut", access_token: local?.access_token });
      } catch {
        /* ignore */
      }
      saveSession(null);
      notifyAuth("SIGNED_OUT", null);
      return { error: null };
    },

    async resetPasswordForEmail(email: string, _opts?: { redirectTo?: string }) {
      const res = await postAuth({ action: "resetPasswordForEmail", email });
      return { data: res.data, error: res.error };
    },

    async updateUser(attrs: { password?: string }) {
      const res = await postAuth({ action: "updateUser", ...attrs });
      return { data: res.data, error: res.error };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      // Initial emit (async, like Supabase)
      queueMicrotask(() => {
        callback("INITIAL_SESSION", loadSession());
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  storage: {
    from(bucket: string) {
      return new StorageBucket(bucket);
    },
  },
};

export type LocalClient = typeof localClient;
