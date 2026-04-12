# Language Learning Backend

NestJS + PostgreSQL powered backend for an AI-assisted language learning application.

## Features

- 🔐 Google Sign-In & Firebase authentication
- 🤖 AI-powered quiz generation (Google Gemini)
- 📊 User progress tracking & analytics
- 📚 Topic management with CEFR levels
- 🎯 Vocabulary bank system
- 💳 Subscription & in-app purchase support
- ⚡ Caching with Redis
- 📝 Database migrations with TypeORM

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Auth:** Firebase Admin SDK
- **AI:** Google Gemini Pro API
- **Cache:** Redis
- **Server:** Docker + Railway

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection (Railway auto-provides)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase config
- `GEMINI_API_KEY`: Google Gemini API key
- `JWT_SECRET`: JWT signing secret

## Running the App

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## Database

### Run Migrations

```bash
npm run migration:run
```

### Generate Migration

```bash
npm run migration:generate -- src/infrastructure/database/migrations/DescriptionOfChange
```

### Seed Database

```bash
npm run seed
```

## Deployment

### Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Add PostgreSQL service when prompted

4. Set environment variables:
```bash
railway variables set NODE_ENV production
railway variables set JWT_SECRET "your-secret-key"
# ... set other variables
```

5. Deploy:
```bash
railway up
```

## API Documentation

Swagger documentation available at `/api/docs` after starting the server.

## Project Structure

```
src/
├── domain/              # Core business logic & entities
├── application/         # Use cases & orchestration
├── infrastructure/      # Implementation (DB, external APIs)
└── presentation/        # Controllers & DTOs
```

## License

Proprietary - Language Learning App
