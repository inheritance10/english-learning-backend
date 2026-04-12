# Claude Kuralları - Backend Projesi

Bu dokuman, Claude'un bu backend projesinde nasıl çalışması gerektiğini tanımlar.

## Proje Bilgisi

**Proje:** Language Learning Backend (NestJS + Clean Architecture)
**Dil:** TypeScript
**Database:** PostgreSQL
**ORM:** TypeORM
**AI:** Google Gemini Pro

## Claude İçin Kurallar

### 1. Clean Architecture'ı Koru

**Katmanlar:**
```
domain/          → Entities, Interfaces (Pure business logic)
application/     → Use Cases (Orchestration)
infrastructure/  → Implementation details (DB, APIs)
presentation/    → Controllers, DTOs, HTTP layer
```

**Kural:** Katmanlar arası sadece dependency injection şekilde bağımlılık olmalı, hiçbir zaman `presentation` → `domain` doğru import YAPMA.

✅ Doğru:
```typescript
// application/use-case.ts
constructor(
  @InjectRepository(Entity)
  private repo: Repository<Entity>
) {}
```

❌ Yanlış:
```typescript
// application/use-case.ts
import FeatureController from 'presentation/controllers';  // YAPMACAK
```

### 2. Use Case Pattern

Her business logic `UseCase` class'ı içinde olmalı:

**Şablon:**
```typescript
export interface InputDto {
  // request parametreleri
}

@Injectable()
export class SomeUseCase {
  async execute(dto: InputDto): Promise<OutputType> {
    // logic
  }
}
```

### 3. Entity Adlandırması

- Entity sınıfları `...Entity` ile bitmeli: `UserEntity`, `TopicEntity`
- TypeORM `@Entity()` decorator'unda küçük harfli, çoğul: `@Entity('users')`

❌ Yanlış:
```typescript
@Entity('user')  // singular
export class User { }  // ...Siz, Entity yazma
```

✅ Doğru:
```typescript
@Entity('users')  // plural
export class UserEntity { }
```

### 4. Repository Pattern

Her Entity için `Repository` oluştur:

**Dosya konumu:**
- Interface: `domain/repositories/...interface.ts`
- Implementation: `infrastructure/repositories/...ts`

### 5. Module Organizing

Her feature kendi modülünde:

```
src/application/auth/
  ├── use-cases/
  │   ├── login.use-case.ts
  │   └── signup.use-case.ts
  └── auth.module.ts
```

### 6. Controller Endpoint Adlandırması

REST conventions'ı takip et:

```typescript
@Get()                    // GET /api/v1/users
@Get(':id')               // GET /api/v1/users/:id
@Post()                   // POST /api/v1/users
@Patch(':id')             // PATCH /api/v1/users/:id
@Delete(':id')            // DELETE /api/v1/users/:id
```

### 7. DTO Validation

Tüm request DTO'ları validation decorators'ı kullanmalı:

```typescript
import { IsString, IsEmail, IsOptional, Min, Max } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Min(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
```

### 8. Error Handling

NestJS exception'ları kullan:

```typescript
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

// ✅ Doğru
if (!user) throw new NotFoundException('User not found');

// ❌ Yanlış
if (!user) throw new Error('User not found');
```

### 9. Database Migration'ları

Entity değişikliği → Migration oluştur → Çalıştır:

```bash
# 1. Entity'yi değiştir
# 2. Migration oluştur
npm run migration:generate -- src/infrastructure/database/migrations/Description

# 3. Kontrol et ve çalıştır
npm run migration:run
```

**Kural:** Development'ta `synchronize: true` olsa bile, production'a commit'lemeden önce migration'ları `migration:generate` ile oluştur.

### 10. API Documentation

Her endpoint'e Swagger decorator'ları ekle:

```typescript
@Get()
@ApiOperation({ summary: 'Get all items' })
@ApiResponse({ status: 200, type: [ItemDto] })
async findAll() { }
```

### 11. TypeScript Strict Mode

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Kural:** Type'siz kod yazma. Her zaman açık types tanımla.

### 12. Kod Organizasyonu

**Bir dosya = Bir sınıf/interface:**

✅ Doğru:
```
use-cases/
  ├── create-user.use-case.ts
  ├── get-user.use-case.ts
  └── delete-user.use-case.ts
```

❌ Yanlış:
```
use-cases/
  └── user.use-case.ts  // CreateUser + GetUser + DeleteUser = 500 lines
```

### 13. Dependency Injection

NestJS providers'ı kullan:

```typescript
// ✅ Doğru
@Module({
  providers: [GetUserUseCase, UserRepository],
})
export class UserModule {}

// ❌ Yanlış
export class Service {
  private repo = new Repository();  // new keyword kullanma
}
```

### 14. Environment Variables

`.env` dosyasında konfigürasyon, `ConfigService` ile oku:

```typescript
constructor(private configService: ConfigService) {}

const dbHost = this.configService.get<string>('DB_HOST');
```

### 15. Logging

`Logger` service'i kullan:

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private logger = new Logger(MyService.name);

  async doSomething() {
    this.logger.log('Action started');
    this.logger.error('Error occurred', error);
  }
}
```

### 16. Testing

- Unit tests: `*.spec.ts`
- Integration tests: `*.integration.spec.ts`
- Mock'lar: Test file içinde veya `__mocks__` klasöründe

```bash
npm test                    # Tüm test'leri çalıştır
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage raporu
```

## Yeni Modül Eklerken Checklist

- [ ] Entity oluşturuldu (`domain/entities/`)
- [ ] Repository interface oluşturuldu (`domain/repositories/`)
- [ ] Repository implementation oluşturuldu (`infrastructure/repositories/`)
- [ ] Use case(s) oluşturuldu (`application/<module>/use-cases/`)
- [ ] Controller oluşturuldu (`presentation/controllers/`)
- [ ] DTOs oluşturuldu (`presentation/dtos/`)
- [ ] Module oluşturuldu (`application/<module>/<module>.module.ts`)
- [ ] `app.module.ts`'e import edildi
- [ ] Migration oluşturuldu ve çalıştırıldı
- [ ] Swagger decorators'ları eklendi
- [ ] Test'ler yazıldı
- [ ] Linting geçti: `npm run lint`

## Dosya Yapısı Örneği

Yeni `Comment` modülü eklemek:

```
src/
├── domain/
│   ├── entities/comment.entity.ts
│   └── repositories/comment.repository.interface.ts
├── application/comment/
│   ├── use-cases/
│   │   ├── create-comment.use-case.ts
│   │   ├── get-comments.use-case.ts
│   │   └── delete-comment.use-case.ts
│   └── comment.module.ts
├── infrastructure/
│   ├── repositories/comment.repository.ts
│   └── database/migrations/xxxx-CreateCommentsTable.ts
└── presentation/
    ├── controllers/comment.controller.ts
    └── dtos/comment.dto.ts
```

## Komandlar

```bash
npm run start:dev         # Development modunda başlat
npm run build            # Production build
npm run lint             # ESLint çalıştır
npm run migration:generate -- <name>  # Migration oluştur
npm run migration:run    # Migration'ları çalıştır
npm run migration:revert # Son migration'ı geri al
npm test                 # Test'leri çalıştır
```

## Kaynaklar

- `docs/Adding-New-Module.md` - Yeni modül ekleme rehberi
- `docs/Database-Migrations.md` - Migration sistemi
- NestJS: https://docs.nestjs.com/
- TypeORM: https://typeorm.io/
- Clean Architecture: https://blog.cleancoder.com/

---

**Son güncellenme:** 2026-04-12
