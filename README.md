# Perpustakaan Digital

> Sistem Manajemen Perpustakaan Digital Lintas Platform untuk Sekolah di Indonesia

## 🏗️ Architecture

```
perpustakaandigital/
├── backend/          # Express.js + TypeScript API (65+ files)
├── frontend/         # Next.js + Tailwind CSS (25+ files)
├── mobile/           # React Native Expo (14+ files)
├── nginx/            # Reverse proxy config
├── docker-compose.yml
└── .github/workflows/ci-cd.yml
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8.0
- Redis 7+
- Docker & Docker Compose (for production)

### Development

```bash
# Backend
cd backend
cp .env.example .env       # Configure your database
npm install
npm run migrate
npm run seed
npm run dev                 # http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:3000

# Mobile
cd mobile
npm install
npx expo start              # Scan QR with Expo Go
```

### Production (Docker)

```bash
cp .env.production.example .env
# Edit .env with production values

docker compose up -d --build
# Access at http://localhost (nginx)
```

## 📋 Features

| Feature | Description |
|---------|-------------|
| 5-Level RBAC | Super Admin → Regency → District → School → Student |
| QR Code System | Unique QR per physical book copy |
| Transaction-safe Borrowing | Row-level locking, stock validation |
| Regional Hierarchy | Multi-regency, multi-district, multi-school |
| Immutable Audit Logs | Full action tracking, no deletes |
| Native QR Scanner | Camera + GPS on mobile |
| Dark Mode UI | Consistent design across web & mobile |
| Real-time Notifications | Type-based with unread tracking |
| Redis Caching | Dashboard analytics, book data |

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express.js, TypeScript, Sequelize, MySQL, Redis |
| Frontend | Next.js 16, Tailwind CSS 4, Zustand |
| Mobile | React Native Expo 54, expo-camera, expo-secure-store |
| DevOps | Docker, Nginx, GitHub Actions |

## 📄 API Documentation

All endpoints are under `/api/v1/`:

- `POST /auth/login` — Login with email/password
- `GET /books` — List books with filters
- `POST /borrowings` — Create borrowing
- `POST /qr/scan` — Scan QR with GPS
- See backend routes for complete list (60+ endpoints)

## 📜 License

ISC
