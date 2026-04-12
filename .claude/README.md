# Backend Documentation Index

Welcome! This is the central documentation hub for the Language Learning Backend.

## Quick Navigation

### 🚀 Getting Started

**New to the project?** Start here:

1. **[SETUP-GUIDE.md](SETUP-GUIDE.md)** — Installation, PostgreSQL setup, running the server
2. **[PROJECT-GUIDE.md](PROJECT-GUIDE.md)** — Architecture, modules, data flow overview

### 📚 Development Guides

**Adding new features?** Follow these:

- **[../docs/Adding-New-Module.md](../docs/Adding-New-Module.md)** — Step-by-step: Entity → Controller → Module
- **[../docs/Database-Migrations.md](../docs/Database-Migrations.md)** — Migration system, versioning, rollbacks

### 📖 Reference

**Looking for specifics?**

- **[CLAUDE.md](CLAUDE.md)** — Coding standards, architecture rules, checklist
- **[API-SPEC.md](API-SPEC.md)** — Complete REST API documentation with examples
- **[PROJECT-GUIDE.md](PROJECT-GUIDE.md#modules)** — Module breakdown and responsibilities

## File Structure

```
.claude/
├── README.md                 ← You are here
├── CLAUDE.md               # Coding rules & standards
├── PROJECT-GUIDE.md        # Project overview & architecture
├── SETUP-GUIDE.md          # Installation & deployment
└── API-SPEC.md             # API endpoint reference

../docs/
├── Adding-New-Module.md    # How to add features
└── Database-Migrations.md  # Database versioning
```

## For Claude (AI Assistant)

**Important:** When Claude works on this backend, follow these files in order:

1. **CLAUDE.md** — Understand the rules and patterns
2. **PROJECT-GUIDE.md** — Learn the architecture and module structure
3. **API-SPEC.md** — Understand the API contracts
4. **SETUP-GUIDE.md** — Know how to run and test locally
5. **../docs/Adding-New-Module.md** — Reference when implementing

**Example Flow:**
- Adding a new API endpoint? → CLAUDE.md (rules) → Adding-New-Module.md (steps) → implement
- Debugging a database issue? → Database-Migrations.md → understand the schema
- Adding a feature? → PROJECT-GUIDE.md (find the module) → CLAUDE.md (follow rules) → implement

## Common Tasks

### Adding a New API Endpoint

```
1. Read: CLAUDE.md → Clean Architecture section
2. Read: ../docs/Adding-New-Module.md → Full step-by-step
3. Create: Entity, Repository, UseCase, Controller, Module
4. Update: app.module.ts
5. Run: npm run migration:generate
6. Test: Swagger UI at /api/docs
```

### Fixing a Database Issue

```
1. Read: ../docs/Database-Migrations.md
2. Analyze: typeorm_migrations table
3. Create: Migration if schema changed
4. Run: npm run migration:run
5. Seed: npm run seed (if needed)
```

### Debugging & Troubleshooting

```
1. Read: SETUP-GUIDE.md → Troubleshooting section
2. Check: npm logs, database connections
3. Read: CLAUDE.md → Error handling section
4. Fix: Apply the solution
5. Test: Swagger endpoints
```

## Technology Stack at a Glance

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | NestJS | Server framework |
| Language | TypeScript | Type safety |
| Database | PostgreSQL | Data persistence |
| ORM | TypeORM | Database abstraction |
| AI | Gemini 2.0 Flash | Quiz generation & feedback |
| Auth | Firebase + JWT | Authentication |
| Docs | Swagger/OpenAPI | API documentation |

## Key Concepts

### Clean Architecture
Code is organized into 4 layers: domain, application, infrastructure, presentation.
Always maintain these boundaries. See CLAUDE.md for rules.

### Use Cases
Business logic lives in UseCase classes with `execute()` method.
See Adding-New-Module.md for the pattern.

### Repositories
Database interactions go through Repository pattern.
See Adding-New-Module.md for implementation.

### Modules
Features are self-contained NestJS modules.
Each module imports into app.module.ts.

## Development Workflow

```
1. Create Entity in domain/entities/
2. Create Repository interface in domain/repositories/
3. Implement Repository in infrastructure/repositories/
4. Create UseCase in application/<module>/use-cases/
5. Create Controller in presentation/controllers/
6. Create Module in application/<module>/
7. Import Module into app.module.ts
8. Generate Migration: npm run migration:generate
9. Run Migration: npm run migration:run
10. Test in Swagger: http://localhost:3000/api/docs
```

See `../docs/Adding-New-Module.md` for full details with code examples.

## Commands Cheat Sheet

```bash
# Development
npm run start:dev              # Watch mode server
npm run lint                   # Code linting
npm test                       # Run tests

# Database
npm run migration:generate -- <name>  # Create migration
npm run migration:run          # Apply migrations
npm run migration:revert       # Revert last migration
npm run seed                   # Seed initial data

# Production
npm run build                  # Compile to dist/
npm start                      # Start compiled server
```

## Important Notes for Claude

- **Never modify CLAUDE.md rules without consensus** — These are standards for the codebase
- **Always check ..//docs/ first** when adding features — They have detailed step-by-step instructions
- **Never write code without reading the relevant guide** — Saves time and prevents rework
- **Test locally before submitting** — Use Swagger UI at /api/docs
- **Keep layering strict** — No shortcuts between layers (see CLAUDE.md)
- **Always write migrations** — Never rely on `synchronize: true` in production

## Quick Links

- **Swagger API Docs:** http://localhost:3000/api/docs (when running)
- **Firebase Console:** https://console.firebase.google.com
- **Gemini API Keys:** https://makersuite.google.com/app/apikey
- **NestJS Docs:** https://docs.nestjs.com/
- **TypeORM Docs:** https://typeorm.io/

## Getting Help

1. **"How do I add a new feature?"** → `../docs/Adding-New-Module.md`
2. **"What's the database schema?"** → `PROJECT-GUIDE.md` → Database Schema section
3. **"Why is my API call failing?"** → `API-SPEC.md` → Error Codes section
4. **"How do migrations work?"** → `../docs/Database-Migrations.md`
5. **"What code standards must I follow?"** → `CLAUDE.md`

## Latest Updates

- ✅ Clean Architecture setup complete
- ✅ All 6 main modules (auth, topics, ai, subscription, progress, vocabulary)
- ✅ Gemini AI integration with streaming support
- ✅ Apple/Google IAP verification with test user bypass
- ✅ Database migrations system with seeding
- ✅ Swagger API documentation
- ✅ Complete documentation suite

---

**Last Updated:** 2026-04-12
**Status:** Ready for development ✅

**Next Steps:** Read SETUP-GUIDE.md to get the server running!
