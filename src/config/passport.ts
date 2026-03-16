import prisma from '@config/db';
import env from '@config/env';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET,
};

export const jwtStrategy = new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (user && !user.deletedAt && user.status === 'ACTIVE') {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
});

export const facebookStrategy = new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID || 'dummy',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'dummy',
    callbackURL: `${env.API_URL}/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Basic implementation - search by Facebook ID or email
      const email = profile.emails?.[0]?.value;
      const facebookId = profile.id;

      let user = await prisma.user.findFirst({
        where: {
          OR: [{ facebookId }, email ? { email } : {}].filter(Boolean) as any,
        },
      });

      if (!user && email) {
        // In a real multi-tenant app, we'd need to know which tenant to register them to
        // If not found, we might need to redirect to a "complete registration" page or handle it via a default tenant
        // For now, let's just return false or handle logic if needed
        return done(null, false, { message: 'User not found. Please register first.' });
      }

      if (user && !user.facebookId) {
        // Link account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { facebookId },
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  },
);
