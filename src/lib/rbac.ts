import type { Role } from "@/generated/prisma/enums";

// Role hierarchy: higher index = higher privilege
const ROLE_HIERARCHY: Role[] = [
  "EMPLOYEE",
  "MANAGER",
  "HR_ADMIN",
  "ADMIN",
  "SUPER_ADMIN",
];

export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

export function isAdmin(role: Role): boolean {
  return hasMinRole(role, "ADMIN");
}

export function isHROrAbove(role: Role): boolean {
  return hasMinRole(role, "HR_ADMIN");
}

export function isManagerOrAbove(role: Role): boolean {
  return hasMinRole(role, "MANAGER");
}

// Permission definitions
export type Permission =
  | "attendance:check-in"
  | "attendance:view-own"
  | "attendance:view-team"
  | "attendance:view-all"
  | "regularization:create"
  | "regularization:approve"
  | "regularization:view-all"
  | "reports:view-own"
  | "reports:view-team"
  | "reports:view-all"
  | "reports:export"
  | "users:manage"
  | "settings:manage"
  | "departments:manage"
  | "geofence:manage"
  | "leave:apply"
  | "leave:approve"
  | "leave:view-all";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: [
    "attendance:check-in",
    "attendance:view-own",
    "regularization:create",
    "reports:view-own",
    "leave:apply",
  ],
  MANAGER: [
    "attendance:check-in",
    "attendance:view-own",
    "attendance:view-team",
    "regularization:create",
    "regularization:approve",
    "reports:view-own",
    "reports:view-team",
    "reports:export",
    "leave:apply",
    "leave:approve",
  ],
  HR_ADMIN: [
    "attendance:check-in",
    "attendance:view-own",
    "attendance:view-team",
    "attendance:view-all",
    "regularization:create",
    "regularization:approve",
    "regularization:view-all",
    "reports:view-own",
    "reports:view-team",
    "reports:view-all",
    "reports:export",
    "users:manage",
    "departments:manage",
    "leave:apply",
    "leave:approve",
    "leave:view-all",
  ],
  ADMIN: [
    "attendance:check-in",
    "attendance:view-own",
    "attendance:view-team",
    "attendance:view-all",
    "regularization:create",
    "regularization:approve",
    "regularization:view-all",
    "reports:view-own",
    "reports:view-team",
    "reports:view-all",
    "reports:export",
    "users:manage",
    "departments:manage",
    "geofence:manage",
    "settings:manage",
    "leave:apply",
    "leave:approve",
    "leave:view-all",
  ],
  SUPER_ADMIN: [
    "attendance:check-in",
    "attendance:view-own",
    "attendance:view-team",
    "attendance:view-all",
    "regularization:create",
    "regularization:approve",
    "regularization:view-all",
    "reports:view-own",
    "reports:view-team",
    "reports:view-all",
    "reports:export",
    "users:manage",
    "departments:manage",
    "geofence:manage",
    "settings:manage",
    "leave:apply",
    "leave:approve",
    "leave:view-all",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
