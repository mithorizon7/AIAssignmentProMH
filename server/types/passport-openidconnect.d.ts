declare module 'passport-openidconnect' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export interface StrategyOptions {
    issuer: string;
    authorizationURL: string;
    tokenURL: string;
    userInfoURL: string;
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string | string[];
    passReqToCallback?: boolean;
    skipUserProfile?: boolean;
    [key: string]: any;
  }
  
  export interface VerifyCallback {
    (
      issuer: string,
      profile: any,
      idProfile: any,
      context: any,
      idToken: string,
      accessToken: string,
      refreshToken: string,
      params: any,
      done: (error: any, user?: any, info?: any) => void
    ): void;
  }
  
  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
    name: string;
  }
}