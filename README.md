# DigitalPylot Backend

A robust Node.js enterprise server boilerplate with Express, TypeScript, Prisma ORM, PostgreSQL, Redis, and professional job queue management.

- **CRM Module**: Full Leads and Tasks management with CRUD, search, and filtering.
- **Reporting & Analytics**: Automated lead performance and task productivity aggregation.
- **Dashboard API**: Real-time statistics for users, leads, tasks, and system counts.
- **Authentication & RBAC**: JWT-based auth with Role-Based Access Control.
- **Prisma ORM**: Type-safe database queries with PostgreSQL.
- **Job Queues**: BullMQ & Redis for high-performance background tasks (Email, Clicks, Postbacks).
- **Audit Logging**: Robust activity tracking for system security.
- **i18n Support**: Internationalization built-in.
- **Security**: Helmet, Rate Limiting, CORS, and XSS protection.
- **Logging**: Detailed logging with Winston and daily rotation.
- **File Storage**: Local, S3, Cloudinary, and R2 support.

## 🛠 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Queue**: [BullMQ](https://docs.bullmq.io/)
- **Cache**: [Redis](https://redis.io/)
- **Auth**: [Passport.js](https://www.passportjs.org/) & [JWT](https://jwt.io/)

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Setup Environment Variables:
   ```bash
   cp .env.example .env
   # Fill in your database and redis credentials
   ```

3. Database Setup:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

### Running the App

- **Development**: `pnpm dev`
- **Build**: `pnpm build`
- **Production**: `pnpm start`

## 📖 Module Generation

Quickly generate new modules using the built-in script:
```bash
npm run generate:module <module-name>
```

## 📜 License

MIT
