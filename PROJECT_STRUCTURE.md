# 📁 Cấu Trúc Project Chuẩn

## Cấu Trúc Hiện Tại vs Chuẩn

```
zalo-permission/
├── backend/                          # Next.js API Backend
│   ├── src/
│   │   ├── app/                      # Next.js 14 App Router
│   │   │   ├── api/
│   │   │   │   ├── agent/            # Public agent endpoints
│   │   │   │   │   └── resolve-context/
│   │   │   │   ├── admin/            # Admin endpoints (protected)
│   │   │   │   │   ├── workspaces/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── users/
│   │   │   │   │   └── audit-logs/
│   │   │   │   └── health/
│   │   │   ├── admin/                # Admin UI pages (future)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   │
│   │   ├── lib/                      # Shared utilities
│   │   │   ├── db/                   # Database connections
│   │   │   │   ├── neo4j.ts          # Neo4j driver
│   │   │   │   ├── postgres.ts       # PostgreSQL driver
│   │   │   │   └── index.ts
│   │   │   ├── middleware/           # Auth, logging, etc.
│   │   │   │   ├── auth.ts
│   │   │   │   └── validation.ts
│   │   │   ├── utils/                # Utility functions
│   │   │   │   ├── response.ts
│   │   │   │   └── errors.ts
│   │   │   └── constants.ts          # Constants
│   │   │
│   │   ├── services/                 # Business logic
│   │   │   ├── workspace.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── policy.service.ts
│   │   │   ├── agent.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── index.ts             # Export all services
│   │   │
│   │   ├── types/                    # TypeScript interfaces
│   │   │   ├── index.ts
│   │   │   ├── workspace.ts
│   │   │   ├── user.ts
│   │   │   └── api.ts
│   │   │
│   │   └── config/                   # Configuration
│   │       ├── env.ts               # Environment validation
│   │       └── database.ts
│   │
│   ├── public/                       # Static assets
│   ├── scripts/                      # Database scripts
│   │   ├── init-db.sh
│   │   ├── init-neo4j.sh
│   │   ├── neo4j-init.cypher
│   │   └── seed-data.sql
│   ├── .env.docker                  # Docker environment
│   ├── .env.example                 # Example environment
│   ├── Dockerfile                   # Docker build
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── docker-compose.yml               # Docker services
├── README.md
├── SYSTEM_OVERVIEW.md
├── API.md
├── AUTH.md
└── structure-design.md
```

## Các Cải Thiện Cần Làm

### ✅ 1. Organize Services
```
src/services/
├── workspace.service.ts
├── user.service.ts
├── policy.service.ts
├── agent.service.ts
├── audit.service.ts
└── index.ts  ← Export all
```

### ✅ 2. Database Folder
```
src/lib/db/
├── neo4j.ts          (connection & queries)
├── postgres.ts       (connection & queries)
└── index.ts          (exports)
```

### ✅ 3. Remove Duplicate Inits
```
❌ neo4j-init-v3.ts  (xóa - dùng neo4j-init.cypher)
❌ init-db.ts        (move → scripts/init-db.sh)
❌ seed.ts           (move → scripts/seed-data.sql)
```

### ✅ 4. Add Middleware & Utils
```
src/lib/middleware/
├── auth.ts
├── validation.ts
└── error-handler.ts

src/lib/utils/
├── response.ts       (API responses)
└── errors.ts         (Error classes)
```

### ✅ 5. Config Folder
```
src/config/
├── env.ts            (validate & export env vars)
└── database.ts       (DB connection configs)
```

---

## Action Items

### Phase 1: Cleanup
```bash
# 1. Tạo folder mới
mkdir -p backend/src/lib/db
mkdir -p backend/src/lib/middleware
mkdir -p backend/src/lib/utils
mkdir -p backend/src/config
mkdir -p backend/scripts

# 2. Move files
mv backend/src/lib/neo4j.ts → backend/src/lib/db/neo4j.ts
mv backend/src/lib/db.ts → backend/src/lib/db/postgres.ts
mv neo4j-init.cypher → backend/scripts/neo4j-init.cypher
mv init-db.sh → backend/scripts/init-db.sh
mv init-neo4j.sh → backend/scripts/init-neo4j.sh

# 3. Delete files
rm -f backend/src/lib/neo4j-init-v3.ts
rm -f backend/src/lib/init-db.ts
rm -f backend/src/lib/seed.ts
rm -f backend/src/lib/neo4j-schema.ts
```

### Phase 2: Create Index Files
```typescript
// src/lib/db/index.ts
export { getNeo4jDriver } from './neo4j';
export { getPostgresPool } from './postgres';

// src/services/index.ts
export * from './workspace.service';
export * from './user.service';
export * from './policy.service';
export * from './agent.service';
export * from './audit.service';
```

### Phase 3: Create Config
```typescript
// src/config/env.ts
export const config = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  db: {
    neo4j_uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j_user: process.env.NEO4J_USER || 'neo4j',
    neo4j_password: process.env.NEO4J_PASSWORD,
    postgres_url: process.env.DATABASE_URL,
  },
};
```

---

## Benefits

| Lợi ích | Mô tả |
|---------|-------|
| **Maintainability** | Dễ tìm & sửa code |
| **Scalability** | Thêm services/routes dễ dàng |
| **Testability** | Mock services dễ hơn |
| **Clarity** | Team members hiểu structure nhanh |
| **CI/CD** | Deploy & test tự động dễ hơn |

---

## Timeline

- **Phase 1 (Cleanup):** 15 phút
- **Phase 2 (Index Files):** 10 phút  
- **Phase 3 (Config):** 10 phút
- **Testing:** 20 phút

**Total:** ~1 giờ
