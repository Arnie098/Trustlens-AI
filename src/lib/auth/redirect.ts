/**
 * Role-based post-auth navigation targets.
 * Admins land in the separate admin console; everyone else in the user app.
 */
export function homePathForUser(user: {
  app_metadata?: { is_admin?: boolean; roles?: string[] };
  role?: string;
} | null | undefined): "/admin" | "/dashboard" {
  if (!user) return "/dashboard";
  const roles = user.app_metadata?.roles ?? [];
  const isAdmin =
    user.app_metadata?.is_admin === true ||
    roles.includes("admin") ||
    user.role === "admin";
  return isAdmin ? "/admin" : "/dashboard";
}
