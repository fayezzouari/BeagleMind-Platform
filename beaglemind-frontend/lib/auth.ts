import Google from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';

type GoogleProfileLite = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // Required in production; provide a safe fallback for build-time (override via env at runtime)
  secret: process.env.NEXTAUTH_SECRET || 'dev_only_secret_do_not_use_in_prod',
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile) {
        const p = profile as unknown as GoogleProfileLite;
        // next-auth JWT is a Record<string, unknown>, use index notation to avoid unsafe any
        token.email = (p.email ?? token.email) as unknown as string;
        token.name = (p.name ?? token.name) as unknown as string;
        (token as Record<string, unknown>)["picture"] = p.picture ?? (token as Record<string, unknown>)["picture"];
        (token as Record<string, unknown>)["sub"] = p.sub ?? (token as Record<string, unknown>)["sub"];
      }
      return token;
    },
    async session({ session, token }) {
      // Ensure default structure
      if (!session.user) {
        session.user = { name: null, email: null, image: null };
      }
      session.user.email = (token.email as string | undefined) ?? session.user.email ?? null;
      session.user.name = (token.name as string | undefined) ?? session.user.name ?? null;
      session.user.image = ((token as Record<string, unknown>)["picture"] as string | undefined) ?? session.user.image ?? null;
      // Expose sub in a custom field on session for consumers without widening types
      (session as unknown as Record<string, unknown>)["user_sub"] = (token as Record<string, unknown>)["sub"] as string | undefined;
      return session;
    },
  },
};
