# Language Learning Backend - Proje Rehberi

## Proje Özeti

**AI-destekli İngilizce öğrenme uygulamasının** NestJS backend'i.

### Amaç
- Kullanıcılara kişiselleştirilmiş İngilizce öğrenme deneyimi sağla
- Gemini Pro AI ile dinamik test soruları + Socratic feedback
- Apple/Google IAP ile subscription yönetimi
- Daily streaks ve progress tracking

### Tech Stack
- **Framework:** NestJS (Node.js)
- **Database:** PostgreSQL + TypeORM ORM
- **Cache:** Redis (Zustand için ön tanı)
- **AI:** Google Gemini 2.0 Flash API
- **Auth:** Firebase + JWT
- **Docs:** Swagger/OpenAPI

## Proje Mimarisi

### Clean Architecture Katmanları

```
1. Domain Layer (Business Rules)
   ├── entities/           # Database models
   ├── repositories/       # Interface'ler (dependency inversion)
   └── exceptions/         # Business exceptions

2. Application Layer (Use Cases)
   ├── auth/              # Authentication logic
   ├── topics/            # Topic listing & filtering
   ├── ai/                # Gemini integration
   ├── subscription/      # IAP receipt handling
   ├── progress/          # Streaks & XP tracking
   └── vocabulary/        # Vocabulary bank

3. Infrastructure Layer (Technical Details)
   ├── repositories/      # TypeORM implementations
   ├── gemini/           # Gemini service wrapper
   ├── auth/             # Firebase + JWT strategies
   ├── database/         # Connection, migrations, seeding
   └── cache/            # Redis integration (future)

4. Presentation Layer (HTTP)
   ├── controllers/       # API endpoints
   ├── dtos/             # Request/Response models
   ├── decorators/       # @CurrentUser, @Public
   └── guards/           # JWT auth guard
```

### Modüller

```
auth/              → Firebase OAuth + JWT
├─ Sign in (Google/Apple)
├─ Profile fetch & update
└─ CEFR level + interests personalization

topics/            → Content delivery
├─ List topics by category/level
├─ Get categories
└─ Get CEFR levels (A1-C2)

ai/                → Gemini Pro AI
├─ Generate quiz (personalized questions)
├─ Analyze answer (Socratic feedback)
├─ Lesson chat (streaming SSE)
└─ Learning path generation

subscription/      → In-App Purchase
├─ Verify Apple/Google receipt
├─ Trial period check
└─ Subscription plans API

progress/          → User tracking
├─ Daily streaks (current + longest)
├─ XP earned
├─ Accuracy by topic
└─ Weekly activity

vocabulary/        → Word bank
├─ Save words from quiz mistakes
├─ Review status (new/learning/mastered)
└─ CRUD operations
```

## Database Schema

### Core Tables

```
users
├─ id (uuid primary)
├─ firebaseUid (unique)
├─ email
├─ name, avatarUrl
├─ language (en/tr)
├─ cefrLevel (A1-C2)
├─ interests (array)
├─ isSubscribed, isTestUser
├─ trialStartedAt, trialEndsAt
└─ createdAt, updatedAt

topics
├─ id (uuid primary)
├─ name (string)
├─ category (grammar/vocabulary/business/...)
├─ cefrLevel (A1-C2)
├─ language (en/tr)
├─ description
├─ icon, estimatedMinutes
├─ isActive, isPremium
├─ orderIndex
└─ createdAt

user_progress (daily aggregation)
├─ id (uuid primary)
├─ userId (fk → users)
├─ topicId (fk → topics)
├─ date (YYYY-MM-DD)
├─ xpEarned
├─ questionsAnswered
├─ correctAnswers
├─ successRate (percent)
├─ isCompleted
└─ createdAt, lastActivityAt

daily_streaks
├─ id (uuid primary)
├─ userId (fk → users)
├─ currentStreak (0-999)
├─ longestStreak (0-999)
├─ lastActiveDate (YYYY-MM-DD)
└─ createdAt, updatedAt

subscriptions
├─ id (uuid primary)
├─ userId (fk → users)
├─ plan (free/pro_monthly/pro_yearly/lifetime)
├─ status (active/expired/cancelled)
├─ platform (ios/android)
├─ expiresAt
├─ isActive
├─ productId, receiptData
└─ createdAt, updatedAt

vocabulary_items
├─ id (uuid primary)
├─ userId (fk → users)
├─ word (string)
├─ translation (string)
├─ definition
├─ exampleSentence
├─ status (new/learning/mastered)
├─ reviewCount
├─ lastReviewedAt
├─ topicId (fk → topics)
└─ createdAt
```

## API Endpoints

### Authentication

```
POST   /api/v1/auth/social          # Sign in with Firebase token
GET    /api/v1/auth/me              # Get current user profile
PATCH  /api/v1/auth/me              # Update profile (CEFR level, interests)
```

### Topics

```
GET    /api/v1/topics               # List topics (filterable)
GET    /api/v1/topics/categories    # Get category list
GET    /api/v1/topics/levels        # Get CEFR levels
```

### AI Engine

```
POST   /api/v1/ai/quiz/generate     # Create personalized quiz
POST   /api/v1/ai/quiz/analyze      # Analyze answer + Socratic feedback
POST   /api/v1/ai/lesson/chat       # SSE streaming lesson chat
GET    /api/v1/ai/learning-path     # Get recommended learning path
```

### Subscription

```
POST   /api/v1/subscription/verify  # Verify IAP receipt
GET    /api/v1/subscription/status  # Check trial/subscription status
GET    /api/v1/subscription/plans   # Get pricing plans
```

### Progress

```
GET    /api/v1/progress             # Get dashboard stats
POST   /api/v1/progress/activity    # Record daily activity & update streak
```

### Vocabulary

```
GET    /api/v1/vocabulary           # Get vocabulary bank (filterable by status)
PATCH  /api/v1/vocabulary/:id       # Update word status
DELETE /api/v1/vocabulary/:id       # Remove word
```

## Veri Akışı Örnekleri

### Quiz Flow

```
1. Client: POST /ai/quiz/generate
   ├─ topicId: "uuid"
   ├─ questionCount: 10
   └─ User context: cefrLevel, interests

2. UseCase: GenerateQuizUseCase.execute()
   ├─ Fetch topic
   ├─ Build prompt (user level + topic + interests)
   ├─ Call Gemini API

3. Gemini Response:
   [
     {
       "question": "Choose the correct form...",
       "options": ["...", "...", "...", "..."],
       "correctIndex": 2,
       "explanation": "Because...",
       "hint": "Think about...",
       "grammar_point": "Present Perfect"
     },
     ...
   ]

4. Return: { topicId, topicName, cefrLevel, questions, totalQuestions }
```

### Answer Analysis Flow

```
1. Client: POST /ai/quiz/analyze
   ├─ question: "..."
   ├─ correctAnswer: "option B"
   ├─ userAnswer: "option A"
   ├─ word: "persevere" (if wrong)
   └─ translation: "Azim göstermek"

2. UseCase: AnalyzeAnswerUseCase.execute()
   ├─ Call Gemini for feedback
   ├─ If wrong:
   │   ├─ Save word to vocabulary_items (status: learning)
   │   └─ Add 3 XP
   ├─ If correct:
   │   └─ Add 10 XP
   └─ Update user_progress

3. Gemini Response:
   {
     "isCorrect": false,
     "feedback": "Not quite. Think about the tense...",
     "socraticQuestions": ["What action started and finished in the past?"],
     "rule": "Use past simple for completed actions",
     "example": "I studied English yesterday",
     "xpEarned": 3
   }

4. Return: Same structure + update DB
```

### IAP Receipt Verification Flow

```
1. Client: POST /subscription/verify
   ├─ platform: "ios"
   ├─ receiptData: (base64 receipt)
   └─ productId: "com.langlearn.pro.monthly"

2. UseCase: VerifyReceiptUseCase.execute()
   ├─ If isTestUser: grant access immediately (bypass)
   ├─ Else:
   │   ├─ Call Apple/Google API
   │   └─ Validate receipt signature
   └─ If valid:
       ├─ Create/update subscription in DB
       ├─ Set expiresAt date
       └─ Mark user as isSubscribed: true

3. Return:
   {
     "isActive": true,
     "expiresAt": "2027-01-15T10:00:00Z",
     "plan": "pro_monthly",
     "isTrial": false
   }
```

## Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=langlearndb

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=30d

# Firebase Admin
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Gemini AI
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash

# IAP
APPLE_SHARED_SECRET=...
ANDROID_PACKAGE_NAME=com.langlearn.app
GOOGLE_SERVICE_ACCOUNT_KEY={...}

# i18n
TRIAL_DURATION_DAYS=7
```

## Kurulum & Çalıştırma

```bash
# Dependencies
npm install --legacy-peer-deps

# Database setup
npm run migration:run        # Apply migrations
npm run seed               # Seed initial data (topics + test user)

# Development
npm run start:dev          # Watch mode on port 3000
npm run lint              # ESLint
npm test                  # Jest tests

# Production
npm run build
npm run start:prod        # Compiled Node
```

## Testing Data

### Test User
```
Email: test@langlearn.dev
Firebase UID: test-user-uid
Features: Bypass IAP verification, always has access
```

### Test Topic
```
ID: (seeded UUID)
Name: "Present Simple"
Level: A1
Category: grammar
```

### Test Subscription
```
Type: Lifetime (bypass verification)
Status: Always active
```

## Performance Considerations

1. **Caching (Redis):** Topic listesi, category listesi (low frequency)
2. **Database indexing:** user.email, user.firebaseUid, vocabulary.status
3. **Query optimization:** `relations` sadece gerekli yerde
4. **Gemini API rate limits:** Max 60 requests/minute (free tier)

## Security

1. **JWT:** Bearer token with 30-day expiry
2. **CORS:** Frontend domain'de kısıtlandı
3. **Rate limiting:** `/api/` endpoints'te 100 req/min per IP
4. **Input validation:** class-validator DTO'lar
5. **IAP verification:** Always validate with Apple/Google (not client-side)
6. **Test user bypass:** `is_test_user` flag ile mock verification

## Monitoring & Logging

- Logs: Console (stdout)
- Error tracking: (future: Sentry)
- Performance: (future: DataDog)
- Database: TypeORM query logs (dev mode)

## Deployment

**CI/CD Pipeline:**
```
1. npm install --legacy-peer-deps
2. npm run lint
3. npm test
4. npm run build
5. npm run migration:run (production DB)
6. Deploy dist/ to server
7. npm start
```

## Katkıda Bulunma

1. `docs/Adding-New-Module.md` → Yeni mod eklemek için
2. `docs/Database-Migrations.md` → DB değişiklikleri için
3. `.claude/CLAUDE.md` → Kod standartları

---

**Sorular?** Docs klasöründeki rehberleri okuyun veya `CLAUDE.md`'deki kuralları inceleyin.
