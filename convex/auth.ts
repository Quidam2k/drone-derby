import { convexAuth } from '@convex-dev/auth/server';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';

// Anonymous ("play as guest") is live now so multiplayer is testable without
// third-party credentials. Magic link (Resend) + Google OAuth slot in here
// once their env keys exist — add the providers and a sign-in UI; the rest of
// the app only ever sees a userId, so nothing else changes.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
});
