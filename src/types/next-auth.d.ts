import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      departmentId: string | null;
      managerId: string | null;
      mustChangePassword: boolean;
    };
  }
  interface User {
    role: Role;
    departmentId: string | null;
    managerId: string | null;
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    departmentId: string | null;
    managerId: string | null;
    mustChangePassword: boolean;
  }
}
