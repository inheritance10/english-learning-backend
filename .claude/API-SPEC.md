# API Specification

Complete API documentation for Language Learning Backend.

**Base URL:** `http://localhost:3000/api/v1` (development)

**Authentication:** Bearer JWT token (all endpoints except `/auth/social`)

**Content-Type:** `application/json`

---

## Auth Endpoints

### Sign In with Firebase

```http
POST /auth/social
```

**Body:**
```json
{
  "firebaseToken": "eyJhbGciOiJSUzI1NiIs...",
  "language": "en"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "isNewUser": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "language": "en",
    "cefrLevel": null,
    "isSubscribed": false,
    "isTestUser": false,
    "trialEndsAt": "2026-04-18T10:00:00Z"
  }
}
```

**Error:** `401 Unauthorized`
```json
{
  "message": "Invalid Firebase token",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

### Get Current User Profile

```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "language": "en",
  "cefrLevel": "B1",
  "interests": ["technology", "business", "cooking"],
  "isSubscribed": true,
  "isTestUser": false,
  "trialEndsAt": "2026-04-18T10:00:00Z",
  "createdAt": "2026-04-11T10:00:00Z"
}
```

---

### Update User Profile

```http
PATCH /auth/me
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Jane Doe",
  "cefrLevel": "B2",
  "language": "tr",
  "interests": ["technology", "travel"]
}
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "cefrLevel": "B2",
  "language": "tr",
  "interests": ["technology", "travel"]
}
```

---

## Topics Endpoints

### List Topics

```http
GET /topics?category=grammar&level=B1&language=en
Authorization: Bearer <token>
```

**Query Parameters:**
- `category` (optional): grammar, vocabulary, business, conversation, writing
- `level` (optional): A1, A2, B1, B2, C1, C2
- `language` (optional): en, tr

**Response:** `200 OK`
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Present Simple",
    "category": "grammar",
    "cefrLevel": "A1",
    "language": "en",
    "description": "Habits, routines, and general truths",
    "estimatedMinutes": 15,
    "icon": "📖",
    "orderIndex": 1,
    "isActive": true,
    "isPremium": false
  },
  ...
]
```

---

### Get Categories

```http
GET /topics/categories
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "key": "grammar",
    "label": "Grammar",
    "icon": "BookOpen",
    "count": 12
  },
  {
    "key": "vocabulary",
    "label": "Vocabulary",
    "icon": "Type",
    "count": 5
  },
  ...
]
```

---

### Get CEFR Levels

```http
GET /topics/levels
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "key": "A1",
    "label": "A1",
    "description": "Beginner"
  },
  {
    "key": "A2",
    "label": "A2",
    "description": "Elementary"
  },
  ...
]
```

---

## AI Endpoints

### Generate Quiz

```http
POST /ai/quiz/generate
Authorization: Bearer <token>
```

**Body:**
```json
{
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "questionCount": 10
}
```

**Response:** `200 OK`
```json
{
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "topicName": "Present Simple",
  "cefrLevel": "A1",
  "questions": [
    {
      "question": "Choose the correct form: 'I ___ English every day'",
      "options": [
        "am studying",
        "study",
        "studies",
        "studied"
      ],
      "correctIndex": 1,
      "explanation": "We use present simple for habitual actions",
      "hint": "Think about daily routines",
      "grammar_point": "Present Simple"
    },
    ...
  ],
  "totalQuestions": 10
}
```

**Error:** `400 Bad Request`
```json
{
  "message": "Topic not found",
  "statusCode": 404
}
```

---

### Analyze Answer

```http
POST /ai/quiz/analyze
Authorization: Bearer <token>
```

**Body:**
```json
{
  "question": "Choose the correct form...",
  "correctAnswer": "option B",
  "userAnswer": "option A",
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "word": "persevere",
  "translation": "Azim göstermek"
}
```

**Response:** `200 OK`
```json
{
  "isCorrect": false,
  "feedback": "Not quite. Consider the grammar rule for...",
  "socraticQuestions": [
    "What type of action is this?",
    "When did it happen?"
  ],
  "rule": "Use past simple for completed actions",
  "example": "I studied English yesterday",
  "xpEarned": 3
}
```

---

### Stream Lesson Chat

```http
POST /ai/lesson/chat
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "messages": [
    {
      "role": "user",
      "content": "How do I use the present perfect tense?"
    },
    {
      "role": "model",
      "content": "Great question! The present perfect connects the past and present..."
    },
    {
      "role": "user",
      "content": "Can you give me an example?"
    }
  ]
}
```

**Response:** `200 OK` (Server-Sent Events)
```
data: {"text":"The present perfect is used for..."}

data: {"text":" actions that started in the past"}

data: {"text":" and continue to the present."}

data: [DONE]
```

---

### Get Learning Path

```http
GET /ai/learning-path
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "learningPath": [
    {
      "topicName": "Present Simple",
      "category": "grammar",
      "reason": "You haven't started grammar topics yet",
      "estimatedMinutes": 15,
      "difficulty": "easy"
    },
    {
      "topicName": "Present Continuous",
      "category": "grammar",
      "reason": "Natural progression after Present Simple",
      "estimatedMinutes": 15,
      "difficulty": "easy"
    },
    ...
  ],
  "completedCount": 2
}
```

---

## Subscription Endpoints

### Verify Receipt

```http
POST /subscription/verify
Authorization: Bearer <token>
```

**Body:**
```json
{
  "platform": "ios",
  "receiptData": "base64-encoded-receipt",
  "productId": "com.langlearn.pro.monthly"
}
```

**Response:** `200 OK`
```json
{
  "isActive": true,
  "expiresAt": "2027-01-15T10:00:00Z",
  "plan": "pro_monthly",
  "isTrial": false
}
```

**Error:** `400 Bad Request`
```json
{
  "message": "Receipt verification failed",
  "statusCode": 400
}
```

---

### Check Subscription Status

```http
GET /subscription/status
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "hasAccess": true,
  "reason": "subscribed",
  "plan": "pro_yearly",
  "daysRemaining": 240
}
```

Or for trial:
```json
{
  "hasAccess": true,
  "reason": "trial",
  "daysRemaining": 5
}
```

Or no access:
```json
{
  "hasAccess": false,
  "reason": "no_subscription",
  "daysRemaining": 0
}
```

---

### Get Plans

```http
GET /subscription/plans
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "plans": [
    {
      "id": "basic",
      "name": "Basic",
      "price": 0,
      "currency": "USD",
      "interval": null,
      "features": [
        "5 lessons/day",
        "Basic AI feedback",
        "Progress tracking"
      ],
      "isFree": true
    },
    {
      "id": "pro_monthly",
      "productId": "com.langlearn.pro.monthly",
      "name": "Pro Monthly",
      "price": 9.99,
      "currency": "USD",
      "interval": "month",
      "features": [
        "Unlimited lessons",
        "Advanced AI tutor",
        "Vocabulary bank",
        "Streaming chat",
        "Priority support"
      ],
      "isFree": false
    },
    {
      "id": "pro_yearly",
      "productId": "com.langlearn.pro.yearly",
      "name": "Pro Yearly",
      "price": 59.99,
      "currency": "USD",
      "interval": "year",
      "features": [
        "Everything in Pro Monthly",
        "50% savings",
        "Offline mode",
        "Custom learning path"
      ],
      "isFree": false,
      "badge": "Best Value"
    },
    {
      "id": "lifetime",
      "productId": "com.langlearn.pro.lifetime",
      "name": "Lifetime",
      "price": 149.99,
      "currency": "USD",
      "interval": null,
      "features": [
        "Everything forever",
        "All future features",
        "One-time payment"
      ],
      "isFree": false,
      "badge": "Limited Offer"
    }
  ]
}
```

---

## Progress Endpoints

### Get Dashboard

```http
GET /progress
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "summary": {
    "totalXp": 2450,
    "accuracy": 87,
    "currentStreak": 5,
    "longestStreak": 12,
    "totalDaysActive": 23,
    "totalQuestionsAnswered": 156
  },
  "weeklyActivity": [
    { "date": "2026-04-05", "xpEarned": 120, "questionsAnswered": 8, "active": true },
    { "date": "2026-04-06", "xpEarned": 0, "questionsAnswered": 0, "active": false },
    { "date": "2026-04-07", "xpEarned": 180, "questionsAnswered": 12, "active": true },
    ...
  ],
  "dailyProgress": [
    { "date": "2026-04-11", "xpEarned": 150, "questionsAnswered": 10, "correctAnswers": 9 },
    { "date": "2026-04-10", "xpEarned": 90, "questionsAnswered": 6, "correctAnswers": 5 },
    ...
  ]
}
```

---

### Record Activity

```http
POST /progress/activity
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "currentStreak": 5,
  "isNewDay": true
}
```

---

## Vocabulary Endpoints

### Get Vocabulary Bank

```http
GET /vocabulary?status=learning
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): new, learning, mastered

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "word": "Persevere",
      "translation": "Azim göstermek",
      "definition": "To continue despite difficulties",
      "exampleSentence": "You must persevere to achieve your goals.",
      "status": "learning",
      "reviewCount": 3,
      "lastReviewedAt": "2026-04-11T10:00:00Z",
      "createdAt": "2026-04-10T15:30:00Z"
    },
    ...
  ],
  "stats": {
    "total": 24,
    "new": 8,
    "learning": 12,
    "mastered": 4
  }
}
```

---

### Update Word Status

```http
PATCH /vocabulary/:id
Authorization: Bearer <token>
```

**Body:**
```json
{
  "status": "mastered"
}
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "mastered",
  "reviewCount": 4,
  "lastReviewedAt": "2026-04-11T11:00:00Z"
}
```

---

### Delete Word

```http
DELETE /vocabulary/:id
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Invalid DTO |
| 401 | Unauthorized | Missing token, invalid token |
| 403 | Forbidden | Not subscribed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate email |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Database error, Gemini API error |

---

## Authentication

All endpoints except `/auth/social` require JWT Bearer token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token expires after 30 days. To get a new token, call `/auth/social` again.

---

## Rate Limiting

- Default: 100 requests per minute per IP
- Auth endpoints: 5 requests per minute per IP (brute force protection)
- AI endpoints: 60 requests per minute (Gemini API limit)

---

## Pagination

Currently not implemented. All list endpoints return all results.

**Future:** Will support `?limit=10&offset=20` parameters.

---

**Last updated:** 2026-04-12
