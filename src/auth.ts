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

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true
          }
        });

        if (!user?.passwordHash) return null;

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole) ?? UserRole.BUYER;
      }
      return session;
    }
  },
  pages: {
    signIn: "/account"
  }
});
