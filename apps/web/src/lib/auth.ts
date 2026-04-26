import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { getRequiredDiagnoseId } from "@/lib/diagnose/eligibility";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * jwt callback runs whenever a JWT is read or written.
     *
     * Triggers we care about for the diagnose-gate flag:
     *  - "signIn"  — user just authenticated; refresh role + requiredDiagnoseId.
     *  - "update"  — client called `update()` (after generating/finalizing a
     *                weekly diagnose); refresh role + requiredDiagnoseId.
     *
     * For other triggers (e.g., regular page navigation), we keep the existing
     * cached values to avoid a DB hit on every request — middleware reads
     * the cached flag.
     */
    jwt: async ({ token, user, trigger }) => {
      if (user?.id) token.id = user.id;

      if (trigger === "signIn" || trigger === "update") {
        const userId = token.id as string | undefined;
        if (userId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          token.role = dbUser?.role ?? "STUDENT";

          if (token.role === "STUDENT") {
            token.requiredDiagnoseId = await getRequiredDiagnoseId(userId);
          } else {
            // Teachers/admins are exempt from the gate.
            token.requiredDiagnoseId = null;
          }
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && typeof token.id === "string") {
        (session.user as { id?: string }).id = token.id;
        (session.user as { role?: string }).role = (
          token as { role?: string }
        ).role;
        (session.user as { requiredDiagnoseId?: string | null }).requiredDiagnoseId = (
          token as { requiredDiagnoseId?: string | null }
        ).requiredDiagnoseId;
      }
      return session;
    },
  },
});
