# Database Migration Sistemi

Bu dokuman, TypeORM migration sistemi nasıl çalışır ve nasıl kullanılır açıklar.

## Migration Nedir?

Migration, veritabanı şemasını versiyonlayan, geri alınabilir değişikliklerdir.

Örnek:
- Yeni tablo oluşturma
- Kolona yeni alan ekleme
- Index yaratma
- Data dönüştürme

Her migration `up()` ve `down()` methodları vardır:
- **up()**: İleri gitme (değişikliği uygula)
- **down()**: Geri gelme (değişikliği geri al)

## Migration Dosya Yapısı

```
src/infrastructure/database/migrations/
├── 1712000001000-CreateUsers.ts
├── 1712000002000-CreateTopics.ts
├── 1712000003000-AddSubscriptionTable.ts
└── ...
```

Dosya adı: `[timestamp]-[description].ts`

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateUsers1712000001000 implements MigrationInterface {
  // Migration'ın unique adı
  name = 'CreateUsers1712000001000';

  // İleri git (development/production)
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );
  }

  // Geri git (rollback)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

## Migration Komutları

### 1. Migration Oluşturma (Otomatik)

TypeORM entity değişikliğini detect ederek migration oluşturur:

```bash
# Entity'deki değişiklikleri algıla ve migration oluştur
npm run migration:generate -- src/infrastructure/database/migrations/AddEmailToUsers
```

Bunu yaptığında TypeORM:
1. Entity class'ını okur
2. Mevcut DB schema'sını okur
3. Farkları bulur
4. Migration dosyası oluşturur (up/down otomatik)

### 2. Manual Migration Oluşturma

```bash
# Boş migration template oluştur (kendi yazacaksın)
npm run typeorm migration:create src/infrastructure/database/migrations/CustomMigration
```

### 3. Migration Çalıştırma (Up)

Tüm pending migration'ları çalıştır:

```bash
npm run migration:run
```

Örnek output:
```
query: SELECT * FROM "typeorm_metadata" WHERE "type" = $1 AND "database" = $2
Migration CreateUsers1712000001000 has been executed successfully.
Migration CreateTopics1712000002000 has been executed successfully.
Migration AddSubscriptionTable1712000003000 has been executed successfully.
```

DB'de `typeorm_migrations` tablosu oluşturulur ve bütün çalıştırılan migration'lar kaydedilir.

### 4. Migration Geri Alma (Down)

Son migration'ı geri al:

```bash
npm run migration:revert
```

Bu `down()` method'unu çalıştırır ve `typeorm_migrations`'tan kaydı siler.

## Production vs Development

### Development (Local)

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
```

**typeorm.config.ts:**
```typescript
synchronize: true,  // Entity değişiklikleri otomatik sync yap (dev'de hızlı)
logging: true,      // SQL sorgularını logla
```

Ancak production'dan önce mutlaka `migration:generate` ile migration'ları oluştur!

### Production

```env
NODE_ENV=production
```

**typeorm.config.ts:**
```typescript
synchronize: false,  // ASLA otomatik sync yapma (veri kaybı riski!)
logging: false,
```

Production'da sadece migration'lar çalıştırılır:
```bash
npm run migration:run  # CI/CD pipeline'ında deployment sırasında
```

## Best Practices

### 1. Atomic Migration'lar

**Kötü:** Birden fazla tablo değişikliği bir migration'da
```typescript
// Migration'da hem ADD COLUMN hem CREATE TABLE
```

**İyi:** Her mantıksal değişiklik ayrı migration
```typescript
// Migration 1: ADD COLUMN age TO users
// Migration 2: CREATE TABLE comments
```

### 2. Always Write Down()

Production'da rollback gerekebilir:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.addColumn('users', new TableColumn({
    name: 'age',
    type: 'int',
    isNullable: true,
  }));
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.dropColumn('users', 'age');  // ← Her zaman yazılmalı
}
```

### 3. Data Transformation

Eski data'yı yeni format'a dönüştür:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Yeni kolonu ekle
  await queryRunner.addColumn('users', new TableColumn({
    name: 'fullName',
    type: 'varchar',
    isNullable: true,
  }));

  // Eski data'dan yeni kolona migrate et
  await queryRunner.query(`
    UPDATE users
    SET fullName = CONCAT(firstName, ' ', lastName)
    WHERE firstName IS NOT NULL
  `);

  // Eski kolonları sil
  await queryRunner.dropColumn('users', 'firstName');
  await queryRunner.dropColumn('users', 'lastName');
}

public async down(queryRunner: QueryRunner): Promise<void> {
  // Tersi: Eski kolonları geri yükle
  await queryRunner.query(`
    ALTER TABLE users ADD COLUMN firstName varchar
  `);
  await queryRunner.query(`
    ALTER TABLE users ADD COLUMN lastName varchar
  `);
  await queryRunner.query(`
    UPDATE users SET firstName = SUBSTRING_INDEX(fullName, ' ', 1)
  `);
  await queryRunner.dropColumn('users', 'fullName');
}
```

### 4. Naming Convention

Migration adı açıklayıcı olmalı:

```
✅ AddUserAvatarColumn.ts
✅ CreateSubscriptionsTable.ts
✅ AddIndexToUserEmail.ts
✅ RenameTopicLevelToCefrLevel.ts

❌ Migration1.ts
❌ Update.ts
❌ Fix.ts
```

## Common Migration Senaryoları

### Yeni Tablo Oluşturma

```bash
npm run migration:generate -- CreateComments
```

### Kolona Yeni Alan Ekleme

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.addColumn(
    'users',
    new TableColumn({
      name: 'phoneNumber',
      type: 'varchar',
      length: '20',
      isNullable: true,
    }),
  );
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.dropColumn('users', 'phoneNumber');
}
```

### Foreign Key Ekleme

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.createForeignKey(
    'comments',
    new TableForeignKey({
      columnNames: ['userId'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }),
  );
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.dropForeignKey('comments', 'fk_comments_userId');
}
```

### Index Oluşturma

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE INDEX idx_users_email ON users(email)
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP INDEX idx_users_email`);
}
```

## Troubleshooting

### "Migration not found"

```
Error: Migration "xxx" not found!
```

Çözüm:
```bash
# typeorm_migrations tablosundaki kaydı sil (dikkatli ol!)
npm run typeorm migration:revert
npm run migration:run
```

### Entity ve Migration Senkronizasyonunda Sorun

```
Entity'de değişiklik var ama migration'ı unuttun
```

Çözüm:
```bash
# Önce entity'deki değişiklikleri migration'a çevir
npm run migration:generate -- EntityNameUpdate

# Sonra çalıştır
npm run migration:run
```

### Production'da Migration Başarısız Oldu

```
Migration rolled back successfully
```

Çözüm:
1. `npm run migration:revert` ile geri al
2. Migration'ı debug et ve düzelt
3. Yeni migration oluştur
4. Test et
5. Tekrar çalıştır

## Workflow Özeti

```
1. Entity'yi değiştir
   └─ src/domain/entities/user.entity.ts

2. Migration oluştur
   └─ npm run migration:generate -- Description

3. Kontrol et
   └─ src/infrastructure/database/migrations/xxxx-Description.ts

4. Migration çalıştır
   └─ npm run migration:run

5. Test et
   └─ API'ı test et ve DB'yi kontrol et

6. Prod'a push et
   └─ CI/CD sırasında npm run migration:run otomatik çalışır
```

## Kaynaklar

- TypeORM Migrations: https://typeorm.io/migrations
- QueryRunner API: https://typeorm.io/query-runner

---

Yeni modül eklemek için `Adding-New-Module.md` dosyasına bakın.
