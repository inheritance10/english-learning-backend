import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import axios from 'axios';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length === 0) {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      const isPlaceholder = (v?: string) =>
        !v || v.startsWith('your-') || v === '';

      if (isPlaceholder(projectId) || isPlaceholder(clientEmail) || isPlaceholder(privateKey)) {
        this.logger.warn('Firebase credentials not set — running in MOCK mode');
        return;
      }

      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey!.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin initialized');
      } catch (e) {
        this.logger.warn(`Firebase init failed (${e}) — falling back to MOCK mode`);
      }
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    // Google ID Token (from GoogleSignin.signIn()) — verify via Google tokeninfo API
    if (this.isGoogleIdToken(idToken)) {
      return this.verifyGoogleIdToken(idToken);
    }

    // Firebase ID Token
    if (admin.apps.length === 0) {
      this.logger.warn('Firebase not initialized — using mock token verification');
      return { uid: 'mock-uid', email: 'dev@test.com', name: 'Dev User' } as any;
    }
    return admin.auth().verifyIdToken(idToken);
  }

  private isGoogleIdToken(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      // Google ID tokens have 'accounts.google.com' or 'https://accounts.google.com' as issuer
      return payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
    } catch {
      return false;
    }
  }

  private async verifyGoogleIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    const response = await axios.get<any>(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    const info = response.data;

    if (!info.sub) {
      throw new Error('Invalid Google ID token');
    }

    // Map Google tokeninfo fields to Firebase DecodedIdToken shape
    return {
      uid: info.sub,
      email: info.email,
      name: info.name,
      picture: info.picture,
      email_verified: info.email_verified === 'true',
      sub: info.sub,
      aud: info.aud,
      iss: info.iss,
      iat: Number(info.iat),
      exp: Number(info.exp),
      firebase: { identities: {}, sign_in_provider: 'google.com' },
    } as any;
  }
}
