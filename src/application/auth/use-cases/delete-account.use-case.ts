import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import { FirebaseAdminService } from '../../../infrastructure/auth/firebase-admin.service';

/** Tables whose user FK has no ON DELETE CASCADE; everything else cascades from users. */
const NON_CASCADING_TABLES: Array<{ table: string; column: string }> = [
  { table: 'daily_streaks', column: '"userId"' },
  { table: 'subscriptions', column: '"userId"' },
  { table: 'user_completed_topics', column: '"userId"' },
  { table: 'user_progress', column: '"userId"' },
  { table: 'vocabulary_items', column: '"userId"' },
];

/**
 * Permanently deletes a user and all their data (App Store / Play Store account deletion requirement).
 * Store subscriptions can't be cancelled server-side; the app tells the user to cancel in the store.
 */
@Injectable()
export class DeleteAccountUseCase {
  private readonly logger = new Logger(DeleteAccountUseCase.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async execute(user: UserEntity): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const { table, column } of NON_CASCADING_TABLES) {
        await tx.query(`DELETE FROM ${table} WHERE ${column} = $1`, [user.id]);
      }
      await tx.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    });

    // Data is gone at this point; a Firebase failure must not undo that, only be visible in logs
    try {
      await this.firebase.deleteUser(user.firebaseUid);
    } catch (err: any) {
      this.logger.error(`Account ${user.id} deleted but Firebase user removal failed: ${err?.message}`);
    }
    this.logger.log(`Account deleted: ${user.id}`);
  }
}
