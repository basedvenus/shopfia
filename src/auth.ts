import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Adapter } from "@auth/core/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  secret: authProviderConfig.authSecret,
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    ...(authProviderConfig.googleEnabled
      ? [
          Google({
            clientId: authProviderConfig.googleClientId!,
            clientSecret: authProviderConfig.googleClientSecret!
          })
        ]
      : []),
    ...(authProviderConfig.emailEnabled
      ? [
          Nodemailer({
            server: {
              host: authProviderConfig.email.host,
              port: Number(authProviderConfig.email.port),
              auth: {
                user: authProviderConfig.email.user,
                pass: authProviderConfig.email.password
              }
            },
            from: authProviderConfig.email.from
          })
        ]
      : [])
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user.role as UserRole) ?? "BUYER";
      }
      return session;
    }
  },
  pages: {
    signIn: "/account"
  }
});
