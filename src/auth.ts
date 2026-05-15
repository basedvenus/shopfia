import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Adapter } from "@auth/core/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { securityLog } from "@/lib/security/audit-log";
import { getSafeProfileImage } from "@/lib/profile-image";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  secret: authProviderConfig.authSecret,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const rate = checkRateLimit(`login:email:${email}`, 5, 60_000);
        if (!rate.ok) {
          securityLog("login_rate_limited", { email });
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            username: true,
            role: true,
            passwordHash: true
          }
        });

        if (!user?.passwordHash) {
          securityLog("login_failed_unknown_or_oauth_only", { email });
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) {
          securityLog("login_failed_bad_password", { email, userId: user.id });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: getSafeProfileImage(user.image),
          username: user.username,
          role: user.role
        };
      }
    }),
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
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? UserRole.BUYER;
        token.username = user.username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const freshUser = token.sub
          ? await db.user.findUnique({
              where: { id: token.sub },
              select: {
                email: true,
                image: true,
                name: true,
                role: true,
                username: true
              }
            })
          : null;

        session.user.id = token.sub ?? "";
        session.user.role = freshUser?.role ?? ((token.role as UserRole) ?? UserRole.BUYER);
        session.user.name = freshUser?.name ?? session.user.name ?? null;
        session.user.email = freshUser?.email ?? session.user.email ?? null;
        session.user.image = getSafeProfileImage(freshUser?.image ?? session.user.image);
        session.user.username = freshUser?.username ?? token.username ?? null;
      }
      return session;
    }
  },
  pages: {
    signIn: "/account"
  }
});
