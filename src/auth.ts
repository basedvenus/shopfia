import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Adapter } from "@auth/core/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const emailServerHost = process.env.EMAIL_SERVER_HOST;
const emailServerPort = process.env.EMAIL_SERVER_PORT;
const emailServerUser = process.env.EMAIL_SERVER_USER;
const emailServerPassword = process.env.EMAIL_SERVER_PASSWORD;
const emailFrom = process.env.EMAIL_FROM;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret
          })
        ]
      : []),
    ...(emailServerHost &&
    emailServerPort &&
    emailServerUser &&
    emailServerPassword &&
    emailFrom
      ? [
          Nodemailer({
            server: {
              host: emailServerHost,
              port: Number(emailServerPort),
              auth: {
                user: emailServerUser,
                pass: emailServerPassword
              }
            },
            from: emailFrom
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
