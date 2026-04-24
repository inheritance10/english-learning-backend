import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

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
   * Preferred over sendToTopic for per-user word notifications.
   */
  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
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
        },
      };

      const result = await admin.messaging().send(message);
      this.logger.log(`FCM sent to device: ${result}`);
      return result;
    } catch (error: any) {
      this.logger.warn(`FCM send to device failed: ${error.message}`);
      return null;
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
