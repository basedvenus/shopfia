import { UserRole } from "@prisma/client";

export type AppRole = UserRole;

export function hasRole(userRole: AppRole | undefined | null, allowed: AppRole[]) {
  return !!userRole && allowed.includes(userRole);
}
