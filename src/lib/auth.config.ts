import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

// Edge-compatible auth config (no Node.js dependencies like Prisma)
export const authConfig = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [], // Providers added in auth.ts (server-only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.managerId = user.managerId;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.departmentId = token.departmentId as string | null;
      session.user.managerId = token.managerId as string | null;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      const isOnChangePassword = request.nextUrl.pathname.startsWith("/change-password");

      if (isOnLogin) {
        if (isLoggedIn)
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;

      // Force password change redirect
      if (auth?.user?.mustChangePassword && !isOnChangePassword) {
        return Response.redirect(new URL("/change-password", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
