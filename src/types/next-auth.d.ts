import "next-auth";
import "next-auth/jwt";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
    };
  }

  interface User {
    role: UserRole;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    username?: string | null;
  }
}
