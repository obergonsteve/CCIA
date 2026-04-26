import bcrypt from "bcryptjs";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * Convex Auth: password sign-in via existing `users.passwordHash` (bcrypt).
 * Client calls `signIn` with `provider: "password"`, `params: { email, password }`.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "password",
      authorize: async (credentials, ctx) => {
        const emailRaw = credentials.email;
        const password = credentials.password;
        const email =
          typeof emailRaw === "string"
            ? emailRaw.toLowerCase().trim()
            : undefined;
        if (!email || typeof password !== "string") {
          return null;
        }
        const user = await ctx.runQuery(internal.users.getByEmailInternal, {
          email,
        });
        if (!user) {
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          return null;
        }
        return { userId: user._id };
      },
    }),
  ],
});
