import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

/** Token artık geçerli değil (uygulama silindi, token yenilendi vb.). Yeniden denemenin anlamı yok. */
export class InvalidFcmTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFcmTokenError';
  }
}

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

@Injectable()
export class FcmNotificationService {
  private readonly logger = new Logger(FcmNotificationService.name);

  /**
   * Send a rich push notification to a Firebase topic.
   * All users subscribed to that topic will receive the message.
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
    try {
      const message: admin.messaging.Message = {
        topic,
        notification: { title, body },
        data,
        android: {
          priority: 'normal',
          notification: {
            channelId: 'word_booster',
            sound: 'default',
            icon: 'ic_notification',
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      };

      const result = await admin.messaging().send(message);
      this.logger.log(`FCM sent to topic "${topic}": ${result}`);
      return result;
    } catch (error: any) {
      this.logger.warn(`FCM send to "${topic}" failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Send a push notification directly to a single device token.
   * Throws InvalidFcmTokenError when the token is dead; other errors are rethrown for retry.
   */
  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: { title, body },
        data,
        android: {
          priority: 'normal',
          notification: {
            channelId: 'word_booster',
            sound: 'default',
            icon: 'ic_notification',
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
          headers: {
            'apns-push-type': 'alert',
            'apns-priority': '10',
          },
        },
      };

      const result = await admin.messaging().send(message);
      this.logger.log(`FCM sent to device: ${result}`);
      return result;
    } catch (error: any) {
      if (INVALID_TOKEN_CODES.includes(error?.code)) {
        throw new InvalidFcmTokenError(error.message);
      }
      // Geçici veya yapılandırma hataları (APNs, ağ vb.) yukarı iletilir; BullMQ yeniden dener
      this.logger.warn(`FCM send to device failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe a device token to a topic (server-side).
   * Alternative: the mobile SDK can subscribe directly.
   */
  async subscribeToTopic(fcmToken: string, topic: string): Promise<void> {
    try {
      await admin.messaging().subscribeToTopic([fcmToken], topic);
      this.logger.log(`Token subscribed to topic "${topic}"`);
    } catch (error: any) {
      this.logger.warn(`Subscribe to topic failed: ${error.message}`);
    }
  }

  async unsubscribeFromTopic(fcmToken: string, topic: string): Promise<void> {
    try {
      await admin.messaging().unsubscribeFromTopic([fcmToken], topic);
      this.logger.log(`Token unsubscribed from topic "${topic}"`);
    } catch (error: any) {
      this.logger.warn(`Unsubscribe from topic failed: ${error.message}`);
    }
  }
}
