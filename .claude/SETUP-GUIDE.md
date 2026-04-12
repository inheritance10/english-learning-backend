# Backend Setup & Başlangıç Rehberi

Adım adım backend'i kurup çalıştırma talimatları.

## Ön Koşullar

- Node.js v22+ (`node --version`)
- PostgreSQL 14+ (`psql --version`)
- npm (`npm --version`)
- Firebase Console hesabı (https://console.firebase.google.com)
- Google Gemini API key (https://makersuite.google.com/app/apikey)

## 1. Repository Klonla

```bash
cd /Users/alicebeci/Desktop/LearningLanguageApp
```

## 2. Backend Dizinine Gir

```bash
cd backend
```

## 3. Dependencies Kur

```bash
npm install --legacy-peer-deps

# Eğer hata varsa:
npm install --legacy-peer-deps --force
```

## 4. Environment Variables Ayarla

`.env.example` dosyasını kopyala ve `.env` oluştur:

```bash
cp .env.example .env
```

**`.env` dosyasını düzelt:**

```env
# Server
NODE_ENV=development
PORT=3000

# PostgreSQL (Local)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=langlearndb

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=30d

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key-here

# Apple IAP (Production values)
APPLE_SHARED_SECRET=your-apple-shared-secret

# Google Play IAP (Production values)
ANDROID_PACKAGE_NAME=com.langlearn.app
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### Firebase Keys Almak

1. https://console.firebase.google.com adresine git
2. Proje seç → "Project Settings"
3. "Service Accounts" tab'ına tıkla
4. "Generate New Private Key" butonuna tıkla
5. İndirilen JSON dosyasından:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

### Gemini API Key Almak

1. https://makersuite.google.com/app/apikey adresine git
2. "Create API Key" tıkla
3. Key'i `.env` dosyasına yapıştır

## 5. PostgreSQL'i Başlat

```bash
# macOS - Homebrew ile kuruluysa
brew services start postgresql

# Veya Docker ile
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=langlearndb \
  -p 5432:5432 \
  postgres:14

# Veya varsayılan PostgreSQL servisini başlat
```

**PostgreSQL'in çalışıp çalışmadığını kontrol et:**

```bash
psql -U postgres -c "SELECT version();"
```

Output örneği:
```
PostgreSQL 14.10 on x86_64-apple-darwin21.6.0, compiled by Apple clang ...
```

## 6. Database Oluştur (İlk Kez)

```bash
psql -U postgres -c "CREATE DATABASE langlearndb;"

# Kontrol et
psql -U postgres -l | grep langlearndb
```

## 7. Migration'ları Çalıştır

```bash
npm run migration:run
```

Beklenen output:
```
Migration CreateUsers1712000001000 has been executed successfully.
Migration CreateTopics1712000002000 has been executed successfully.
...
Migration CreateDailyStreaks1712000005000 has been executed successfully.
```

## 8. Database'i Seed'le (İlk Veri)

```bash
npm run seed
```

Output:
```
✅ Database connected
  → Added: Present Simple
  → Added: Present Continuous
  ...
  → Test user created: test@langlearn.dev
🌱 Seed complete
```

## 9. Development Sunucusunu Başlat

```bash
npm run start:dev
```

Beklenen output:
```
[Nest] 12345  - 04/12/2026, 10:15:30 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 04/12/2026, 10:15:31 AM     LOG [InstanceLoader] ...
...
🚀 Server running on http://localhost:3000/api
📖 Swagger docs: http://localhost:3000/api/docs
```

## 10. API'yi Test Et

### Tarayıcı ile Swagger UI

1. http://localhost:3000/api/docs adresine git
2. `/auth/social` endpoint'ine tıkla
3. Firebase token gir (test için aşağıya bakın)
4. "Try it out" tıkla

### cURL ile Test

```bash
# Şu anda real Firebase token gerekmez, mock mode var
curl -X POST http://localhost:3000/api/v1/auth/social \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseToken": "test-token",
    "language": "en"
  }'
```

Output:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiI...",
  "isNewUser": false,
  "user": {
    "id": "test-user-id",
    "email": "test@langlearn.dev",
    "name": "Test User",
    ...
  }
}
```

### Token ile Authenticated Request

```bash
# Yukarıdan accessToken'ı al
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Development Komutları

```bash
# Server'ı başlat (watch mode)
npm run start:dev

# Server'ı başlat (production mode)
npm run start:prod

# Lint çalıştır
npm run lint

# Test'leri çalıştır
npm test
npm test -- --watch

# Build et
npm run build

# Database
npm run migration:generate -- src/infrastructure/database/migrations/DescriptionName
npm run migration:run
npm run migration:revert
npm run seed

# Swagger docs
# Otomatik olarak 0.0.0/api/docs adresinde available
```

## Production Deployment

### 1. Build Et

```bash
npm run build
```

Çıktı: `dist/` klasörü oluşur

### 2. Environment'ı Production'a Ayarla

```bash
NODE_ENV=production
```

### 3. Migration'ları Çalıştır

```bash
npm run migration:run
```

### 4. Sunucuyu Başlat

```bash
npm start
```

Veya PM2 ile:

```bash
npm install -g pm2
pm2 start dist/main.js --name "langlearn-backend"
pm2 logs
```

## Docker ile Deployment

### Dockerfile (Varsa)

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: langlearndb
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      NODE_ENV: production
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Başlat:
```bash
docker-compose up -d
```

## Troubleshooting

### "database langlearndb does not exist"

```bash
psql -U postgres -c "CREATE DATABASE langlearndb;"
npm run migration:run
```

### "Connection refused" (PostgreSQL)

PostgreSQL çalışıp çalışmadığını kontrol et:

```bash
brew services list  # macOS
ps aux | grep postgres  # Linux/macOS
```

Başlat:
```bash
brew services start postgresql
```

### "EADDRINUSE: address already in use :::3000"

Port 3000 zaten kullanımda. Kapat veya başka port kullan:

```bash
# Kildir
lsof -i :3000
kill -9 <PID>

# Veya başka port kullan
PORT=3001 npm run start:dev
```

### "GEMINI_API_KEY not set"

Gemini özelliği mock mode'da çalışır. Gerçek Gemini istekleri yapmak için `.env`'deki `GEMINI_API_KEY`'i ayarla.

### Firebase Token Doğrulama Başarısız

```
[Reanimated] react-native-worklets library not found
```

Bu frontend hatasıdır, backend'i etkilemez. Ignore et.

## Security Checklist

Before production:

- [ ] JWT_SECRET random ve strong
- [ ] Firebase private key güvenli (git'e commit YAPMA)
- [ ] CORS domain'ler kısıtlandı (sadece frontend)
- [ ] Rate limiting enabled
- [ ] HTTPS enabled (production)
- [ ] Database backup policy
- [ ] Error logs monitored
- [ ] API key rotation policy

## Logs

```bash
# Real-time logs
npm run start:dev

# Docker logs
docker logs -f container_name

# PM2 logs
pm2 logs langlearn-backend

# File logs (Sentry gibi tool'dan)
# (Future implementation)
```

## Monitoring & Health Check

```bash
# Health endpoint (Future)
curl http://localhost:3000/health

# Database connection
npm test -- --testNamePattern="Database"
```

## Next Steps

1. **Swagger UI'i incele:** http://localhost:3000/api/docs
2. **Dokumentasyon oku:** `docs/Adding-New-Module.md`, `docs/Database-Migrations.md`
3. **API test et:** Postman, cURL, vs
4. **Frontend ile entegrasyonu sağla:** React Native `src/api/` layer
5. **Gemini API'yi test et:** `/ai/quiz/generate` endpoint'ini çağır

## Resources

- NestJS Docs: https://docs.nestjs.com/
- TypeORM Docs: https://typeorm.io/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- Google Gemini API: https://ai.google.dev/tutorials/rest_quickstart

---

**Sorular?** `.claude/` klasöründeki rehberleri okuyun.

**Sorun?** Troubleshooting bölümünü kontrol et veya GitHub issue aç.

---

**Setup tamamlandı! Sunucuyu başlatmaya hazırsın.** 🚀
