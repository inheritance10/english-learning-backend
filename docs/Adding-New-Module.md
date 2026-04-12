# Backend'e Yeni Bir Modül Ekleme Rehberi

Bu dokuman, Language Learning Backend'e yeni bir feature (modül) eklemek için adım adım talimatlar verir.

## Modül Yapısı

Backend Clean Architecture'a uygun olarak bu katmanları içerir:

```
src/
├── domain/
│   ├── entities/          # Database tabloları (TypeORM)
│   └── repositories/      # Interface'ler (dependency injection)
├── application/
│   └── <module>/
│       ├── use-cases/     # Business logic (Use Case pattern)
│       └── <module>.module.ts
├── infrastructure/
│   ├── repositories/      # Interface implementasyonları
│   ├── gemini/           # Dış servisler
│   └── auth/
└── presentation/
    ├── controllers/      # HTTP request handlers
    ├── dtos/            # Request/Response models
    └── decorators/      # Custom decorators
```

## Adım Adım Yeni Modül Ekleme

### 1. Domain Entity Oluştur

**Dosya:** `src/domain/entities/<feature>.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('features')
export class FeatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity)
  user: UserEntity;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### 2. Repository Interface Oluştur

**Dosya:** `src/domain/repositories/<feature>.repository.interface.ts`

```typescript
import { FeatureEntity } from '../entities/feature.entity';

export interface IFeatureRepository {
  findAll(userId: string): Promise<FeatureEntity[]>;
  findById(id: string): Promise<FeatureEntity | null>;
  save(entity: FeatureEntity): Promise<FeatureEntity>;
  delete(id: string): Promise<void>;
}

export const FEATURE_REPOSITORY = 'FEATURE_REPOSITORY';
```

### 3. Use Case Oluştur

**Dosya:** `src/application/<module>/use-cases/get-features.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureEntity } from '../../../domain/entities/feature.entity';

export interface GetFeaturesDto {
  userId: string;
}

@Injectable()
export class GetFeaturesUseCase {
  constructor(
    @InjectRepository(FeatureEntity)
    private readonly repo: Repository<FeatureEntity>,
  ) {}

  async execute(dto: GetFeaturesDto) {
    return this.repo.find({ where: { userId: dto.userId } });
  }
}
```

### 4. Repository Implementation Oluştur

**Dosya:** `src/infrastructure/repositories/feature.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureEntity } from '../../domain/entities/feature.entity';

@Injectable()
export class FeatureRepository {
  constructor(
    @InjectRepository(FeatureEntity)
    private readonly repo: Repository<FeatureEntity>,
  ) {}

  async findAll(userId: string) {
    return this.repo.find({ where: { userId } });
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async save(entity: FeatureEntity) {
    return this.repo.save(entity);
  }

  async delete(id: string) {
    await this.repo.delete(id);
  }
}
```

### 5. Controller Oluştur

**Dosya:** `src/presentation/controllers/feature.controller.ts`

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetFeaturesUseCase } from '../../application/feature/use-cases/get-features.use-case';

class CreateFeatureDto {
  @IsString()
  name: string;
}

@ApiTags('features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('features')
export class FeatureController {
  constructor(private readonly getFeatures: GetFeaturesUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Get all features for user' })
  async findAll(@CurrentUser() user: UserEntity) {
    return this.getFeatures.execute({ userId: user.id });
  }

  @Post()
  @ApiOperation({ summary: 'Create new feature' })
  async create(@Body() dto: CreateFeatureDto, @CurrentUser() user: UserEntity) {
    // Implementation
  }
}
```

### 6. Module Oluştur

**Dosya:** `src/application/feature/feature.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureEntity } from '../../domain/entities/feature.entity';
import { GetFeaturesUseCase } from './use-cases/get-features.use-case';
import { FeatureController } from '../../presentation/controllers/feature.controller';
import { FeatureRepository } from '../../infrastructure/repositories/feature.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureEntity]), AuthModule],
  controllers: [FeatureController],
  providers: [GetFeaturesUseCase, FeatureRepository],
  exports: [GetFeaturesUseCase],
})
export class FeatureModule {}
```

### 7. App Module'e Ekle

**Dosya:** `src/app.module.ts`

```typescript
// İmports bölümüne ekle:
import { FeatureModule } from './application/feature/feature.module';
import { FeatureEntity } from './domain/entities/feature.entity';

@Module({
  imports: [
    // ... diğer moduller
    FeatureModule,  // ← YENİ
  ],
})
export class AppModule {}
```

Entity'i de TypeOrmModule.forRootAsync() içinde entities array'ine ekle:
```typescript
entities: [
  // ... diğer entities
  FeatureEntity,  // ← YENİ
],
```

### 8. Migration Oluştur

```bash
npm run migration:generate -- src/infrastructure/database/migrations/CreateFeature
```

Bu TypeORM'un otomatik olarak migration dosyasını oluşturmasını sağlar:

**Dosya:** `src/infrastructure/database/migrations/1xxxxx-CreateFeature.ts`

```typescript
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFeature1xxxxx implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'features',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('features');
  }
}
```

### 9. Migration Çalıştır

```bash
npm run migration:run
```

## Checklist

- [ ] Entity oluşturuldu
- [ ] Repository interface oluşturuldu
- [ ] Use case oluşturuldu
- [ ] Repository implementation oluşturuldu
- [ ] Controller oluşturuldu
- [ ] Module oluşturuldu
- [ ] App.module.ts'e eklendu
- [ ] Migration oluşturuldu
- [ ] Migration çalıştırıldı
- [ ] Swagger docs test edildi (`GET /api/docs`)
- [ ] Endpoint test edildi (Postman/cURL)

## Örnek: Comment Modülü Ekleme

Feature = User'lar derslere yorum yapabilir

```
src/
├── domain/entities/comment.entity.ts
├── domain/repositories/comment.repository.interface.ts
├── application/comment/
│   ├── use-cases/
│   │   ├── create-comment.use-case.ts
│   │   ├── get-lesson-comments.use-case.ts
│   │   └── delete-comment.use-case.ts
│   └── comment.module.ts
├── infrastructure/repositories/comment.repository.ts
└── presentation/controllers/comment.controller.ts
```

## API Endpoint Örneği

```
POST   /api/v1/comments            # Yorum ekle
GET    /api/v1/comments?lessonId=  # Ders yorumlarını getir
DELETE /api/v1/comments/:id        # Yorum sil
```

---

Daha fazla bilgi için `Database-Migrations.md` dosyasına bakın.
