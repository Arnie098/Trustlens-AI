/**
 * Stub for `node:sqlite` when building/running with VITE_DB_PROVIDER=supabase.
 * Render (and other hosts without Node's experimental SQLite) never touch the real DB.
 * Local SQLite mode must NOT alias to this file — it needs the real node:sqlite builtin.
 */
export class DatabaseSync {
  constructor(_path?: string) {
    throw new Error(
      "SQLite is disabled in this build (VITE_DB_PROVIDER=supabase). Use Supabase env vars.",
    );
  }
  exec(_sql: string): void {
    throw new Error("SQLite is disabled in this build.");
  }
  prepare(_sql: string): never {
    throw new Error("SQLite is disabled in this build.");
  }
  close(): void {}
}

export class StatementSync {
  run(..._args: unknown[]): unknown {
    throw new Error("SQLite is disabled in this build.");
  }
  get(..._args: unknown[]): unknown {
    throw new Error("SQLite is disabled in this build.");
  }
  all(..._args: unknown[]): unknown[] {
    throw new Error("SQLite is disabled in this build.");
  }
}

export const constants = {};
export default { DatabaseSync, StatementSync, constants };
