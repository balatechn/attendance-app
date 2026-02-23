# National Group India AttendEase

A modern, full-featured **Attendance Management System** built as a Progressive Web App (PWA). Designed for organizations to track employee attendance with GPS verification, manage leaves, handle regularization requests, and generate comprehensive reports.

**Live Demo:** [https://attendance-app-swart-eight.vercel.app](https://attendance-app-swart-eight.vercel.app)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone & Install](#1-clone--install)
  - [2. Database Setup](#2-database-setup)
  - [3. Environment Variables](#3-environment-variables)
  - [4. Initialize Database](#4-initialize-database)
  - [5. Run Development Server](#5-run-development-server)
- [Deployment (Vercel)](#deployment-vercel)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Role-Based Access Control](#role-based-access-control)
- [Features in Detail](#features-in-detail)
  - [Attendance Tracking](#attendance-tracking)
  - [Management Dashboard](#management-dashboard)
  - [Leave Management](#leave-management)
  - [Regularization](#regularization)
  - [Employee Management](#employee-management)
  - [Geofencing](#geofencing)
  - [Reports & Export](#reports--export)
  - [Email Notifications](#email-notifications)
  - [Settings & Master Data](#settings--master-data)
- [Demo Credentials](#demo-credentials)
- [Scripts Reference](#scripts-reference)
- [License](#license)

---

## Features

- **GPS-based Check-in/Check-out** — Verify employee location against geofence zones
- **Real-time Dashboard** — Live working status, timers, and daily statistics
- **Management Dashboard** — Overview cards, attendance donut chart, entity-wise summary, weekly trend, and recent activity feed for managers and above
- **Team Attendance Viewer** — Managers/admins can view any team member's attendance via dropdown on the Attendance page
- **Leave Management** — Apply, approve/reject leaves with balance tracking
- **Attendance Regularization** — Request corrections for missed check-ins/outs
- **Employee Management** — Add, edit employees with temp password generation
- **Password Reset** — Admin can reset passwords; temp password emailed to employee
- **Geofencing** — Define office zones with lat/lng and radius on interactive maps
- **Reports & Export** — Daily/monthly reports exportable to PDF and Excel
- **Admin Reports** — 5-tab admin reporting: Attendance Summary, Daily View, Late Arrivals, Overtime, Leave Summary with Excel export
- **Cross-Device Sync** — Auto-refresh dashboard every 30s, server-authoritative timer prevents stale data
- **Email Notifications** — Automated emails for all workflows with admin BCC
- **Role-Based Access** — 5-tier role hierarchy (Employee → Super Admin)
- **Progressive Web App** — Install on mobile, works offline for check-ins
- **Dark Mode** — Full dark/light theme support
- **Responsive Design** — Mobile-first UI built with Tailwind CSS

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **Language** | TypeScript 5 |
| **UI** | [Tailwind CSS 4](https://tailwindcss.com), Custom component library |
| **State** | [Zustand 5](https://github.com/pmndrs/zustand) (persisted stores) |
| **Database** | PostgreSQL (via [Neon](https://neon.tech) serverless) |
| **ORM** | [Prisma 7](https://prisma.io) with `@prisma/adapter-pg` |
| **Auth** | [NextAuth v5](https://authjs.dev) (JWT strategy, Credentials provider) |
| **Email** | [Nodemailer](https://nodemailer.com) (DB-configurable SMTP) |
| **PDF/Excel** | jsPDF + jspdf-autotable, SheetJS (xlsx) |
| **PWA** | next-pwa, Service Worker, Web App Manifest |
| **Deployment** | [Vercel](https://vercel.com) |
| **React** | React 19 |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (PWA)                      │
│  React 19 · Tailwind CSS 4 · Zustand · Geolocation │
├─────────────────────────────────────────────────────┤
│               Next.js 16 App Router                  │
│  Server Components · API Routes · Middleware (Auth)  │
├─────────────────────────────────────────────────────┤
│                  Service Layer                       │
│  NextAuth v5 · Prisma 7 · Nodemailer · RBAC        │
├─────────────────────────────────────────────────────┤
│              PostgreSQL (Neon Serverless)            │
│  16 Models · 4 Enums · Adapter: @prisma/adapter-pg  │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Node.js** 18.17+ (recommended: 20+)
- **npm** 9+ (or pnpm/yarn)
- **PostgreSQL** database (recommended: [Neon](https://neon.tech) free tier for serverless)
- **SMTP credentials** for email notifications (Gmail App Password, SendGrid, etc.)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/balatechn/attendance-app.git
cd attendance-app
npm install
```

### 2. Database Setup

**Option A: Neon (Recommended for Vercel)**
1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project and copy the connection string
3. The connection string looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

**Option B: Local PostgreSQL**
1. Install PostgreSQL locally
2. Create a database: `createdb attendance_db`
3. Connection string: `postgresql://user:password@localhost:5432/attendance_db`

### 3. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="generate-a-random-32-char-secret"

# Email (SMTP) — Optional, can also configure via Settings page
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="AttendEase <noreply@yourcompany.com>"

# App Config
NEXT_PUBLIC_APP_NAME="National Group India AttendEase"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_DEFAULT_GEOFENCE_RADIUS=200

# Google Maps (optional)
NEXT_PUBLIC_GOOGLE_MAPS_KEY=""
```

> **Generate AUTH_SECRET:** Run `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### 4. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Seed demo data (optional but recommended)
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment (Vercel)

1. Push code to GitHub
2. Import the repository on [vercel.com](https://vercel.com)
3. Add all environment variables from `.env` in the Vercel project settings
   - Set `NEXTAUTH_URL` to your Vercel domain (e.g., `https://your-app.vercel.app`)
   - Set `NEXT_PUBLIC_APP_URL` to the same domain
4. Deploy — the build command automatically runs `prisma generate && next build`
5. After first deploy, seed the database:
   ```bash
   npx prisma db seed
   ```

> **Note:** Vercel uses serverless functions. Neon's serverless PostgreSQL is recommended for compatible connection pooling.

---

## Project Structure

```
attendance-app/
├── prisma/
│   ├── schema.prisma           # Database schema (16 models, 4 enums)
│   └── seed.ts                 # Demo data seeder
├── public/
│   ├── logo.webp               # App logo
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   └── icons/                  # PWA icons (72px to 512px)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (HTML, providers)
│   │   ├── page.tsx            # Landing page (redirects to dashboard)
│   │   ├── login/              # Login page
│   │   ├── change-password/    # Password change (forced + voluntary)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx      # Dashboard shell (sidebar, nav)
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── attendance/     # Check-in/out, daily log, team viewer
│   │   │   ├── management/     # Management dashboard (charts, stats)
│   │   │   ├── leaves/         # Leave application & history
│   │   │   ├── admin-reports/  # Admin reports (5-tab, Excel export)
│   │   │   ├── reports/        # Personal reports with PDF/Excel export
│   │   │   ├── profile/        # User profile
│   │   │   ├── employees/      # Employee management (admin)
│   │   │   ├── approvals/      # Leave & regularization approvals
│   │   │   ├── geofence/       # Geofence zone management
│   │   │   ├── regularization/ # Attendance regularization
│   │   │   └── settings/       # Master data & email config
│   │   └── api/
│   │       ├── auth/           # NextAuth + password change
│   │       ├── attendance/     # Session, summary, sync
│   │       ├── employees/      # CRUD + reset password
│   │       ├── departments/    # Department CRUD
│   │       ├── entities/       # Entity CRUD
│   │       ├── locations/      # Location CRUD
│   │       ├── geofence/       # Geofence CRUD
│   │       ├── regularization/ # Create + review
│   │       ├── leaves/         # Apply, review, types
│   │       ├── management/     # Management dashboard API
│   │       ├── reports/        # Export API
│   │       └── settings/       # Email config
│   ├── components/
│   │   └── ui/                 # Reusable UI components (Button, Card, Input, Badge, etc.)
│   ├── generated/
│   │   └── prisma/             # Auto-generated Prisma client
│   └── lib/
│       ├── auth.ts             # NextAuth server config (Credentials provider)
│       ├── auth.config.ts      # Edge-safe auth config (JWT callbacks, authorized)
│       ├── prisma.ts           # Prisma client singleton
│       ├── email.ts            # Email utility (DB config, BCC admin, templates)
│       ├── rbac.ts             # Role-based access control (permissions matrix)
│       ├── constants.ts        # App constants, navigation items
│       ├── api-utils.ts        # API response helpers
│       ├── datetime.ts         # Date/time formatting & calculations
│       ├── geo.ts              # Geolocation helpers (haversine, geofence check)
│       └── store.ts            # Zustand stores (attendance, UI)
├── middleware.ts               # Route protection & role-based access
├── prisma.config.ts            # Prisma configuration
├── next.config.ts              # Next.js config (security headers, images)
├── tailwind.config.ts          # Tailwind CSS configuration
└── package.json
```

---

## Database Schema

### Models Overview

| Model | Description |
|---|---|
| **User** | Employees with role, department, entity, location, manager relations |
| **Department** | Organizational departments (code + name) |
| **Entity** | Legal/business entities |
| **Location** | Office locations (code, name, address) |
| **EmailConfig** | SMTP configuration stored in database |
| **AttendanceSession** | Individual check-in/check-out with GPS coordinates |
| **DailySummary** | Aggregated daily stats (work mins, break mins, overtime, status) |
| **Regularization** | Attendance correction requests with approval workflow |
| **GeoFence** | Geofence zones (lat, lng, radius in meters) |
| **LeaveType** | Leave categories (annual, sick, etc.) with default days |
| **LeaveBalance** | Per-user, per-year leave balance tracking |
| **LeaveRequest** | Leave applications with date range and approval |
| **Notification** | In-app notifications |
| **AuditLog** | Audit trail for all actions |
| **AppConfig** | Key-value application settings |

### Enums

- **Role:** `SUPER_ADMIN` | `ADMIN` | `HR_ADMIN` | `MANAGER` | `EMPLOYEE`
- **SessionType:** `CHECK_IN` | `CHECK_OUT`
- **RegularizationStatus:** `PENDING` | `APPROVED` | `REJECTED`
- **LeaveStatus:** `PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`

### Key Relationships

```
User ──── Department (many-to-one)
User ──── Entity (many-to-one)
User ──── Location (many-to-one)
User ──── User as Manager (self-referential)
User ──── AttendanceSession (one-to-many)
User ──── DailySummary (one-to-many)
User ──── Regularization (one-to-many, as employee + reviewer)
User ──── LeaveRequest (one-to-many, as applicant + reviewer)
User ──── LeaveBalance (one-to-many)
LeaveType ── LeaveBalance (one-to-many)
LeaveType ── LeaveRequest (one-to-many)
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | NextAuth sign-in/sign-out/session |
| POST | `/api/auth/change-password` | Change or reset password |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/session` | Check-in or check-out with GPS |
| GET | `/api/attendance/summary` | Get daily summary for user |
| POST | `/api/attendance/sync` | Sync offline attendance queue |

### Employees
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/employees` | List employees (filtered by role) |
| POST | `/api/employees` | Create employee (auto-generates temp password + email) |
| PUT | `/api/employees/[id]` | Update employee details |
| POST | `/api/employees/[id]/reset-password` | Reset password (generates temp + email) |

### Leaves
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leaves` | List leave requests |
| POST | `/api/leaves` | Apply for leave |
| POST | `/api/leaves/[id]/review` | Approve/reject leave |
| GET | `/api/leaves/types` | List leave types |
| POST | `/api/leaves/types` | Create leave type |

### Regularization
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/regularization` | List regularization requests |
| POST | `/api/regularization` | Submit regularization request |
| POST | `/api/regularization/[id]/review` | Approve/reject regularization |

### Master Data
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/departments` | List/create departments |
| GET/POST | `/api/entities` | List/create entities |
| GET/POST | `/api/locations` | List/create locations |
| GET/POST | `/api/geofence` | List/create geofence zones |
| GET/POST | `/api/settings/email-config` | Get/save SMTP configuration |
| PUT | `/api/settings/email-config` | Test SMTP connection |

### Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/management` | Management dashboard data (overview, entity stats, trend, activity) |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/export` | Export attendance data (PDF/Excel) |
| GET | `/api/reports/admin` | Admin reports data (summary, daily, late, overtime, leave) |

---

## Role-Based Access Control

### Role Hierarchy

```
SUPER_ADMIN > ADMIN > HR_ADMIN > MANAGER > EMPLOYEE
```

### Permissions Matrix

| Permission | Employee | Manager | HR Admin | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Check in/out | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own attendance | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team attendance | ❌ | ✅ | ✅ | ✅ | ✅ |
| View all attendance | ❌ | ❌ | ✅ | ✅ | ✅ |
| Apply for leave | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve leaves | ❌ | ✅ | ✅ | ✅ | ✅ |
| Request regularization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve regularization | ❌ | ✅ | ✅ | ✅ | ✅ |
| View own reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team reports | ❌ | ✅ | ✅ | ✅ | ✅ |
| View all reports | ❌ | ✅ | ✅ | ✅ | ✅ |
| Management dashboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export reports | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage employees | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage departments | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage geofences | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage settings | ❌ | ❌ | ❌ | ✅ | ✅ |

### Route Protection

| Route | Minimum Role |
|---|---|
| `/dashboard` | Any authenticated user |
| `/dashboard/employees` | HR_ADMIN |
| `/dashboard/geofence` | ADMIN |
| `/dashboard/settings` | ADMIN |
| `/dashboard/management` | MANAGER |
| `/dashboard/approvals` | MANAGER |

---

## Features in Detail

### Attendance Tracking
- **GPS-verified check-in/check-out** with geofence validation
- **Live timer** showing current session duration
- **Team member viewer** — Managers see a dropdown to view any direct report's attendance; admins/HR see all employees
- **Cross-device sync** — Dashboard auto-refreshes every 30 seconds; server-authoritative timer prevents stale localStorage data across devices
- **Offline support** — queue check-ins when offline, auto-sync when back online
- **Auto-checkout** at configurable time (default: 11 PM)
- **Daily summary** — total work minutes, break time, overtime, late status
- **Status tracking** — Present, Absent, Late, Half Day, On Leave

### Management Dashboard
- **Overview cards** — Total employees, present today, on leave, absent, late arrivals, average work hours
- **Attendance donut chart** — Visual breakdown of present/absent/leave/late
- **Entity-wise summary table** — Per-entity totals for present, absent, late, on leave
- **Weekly trend chart** — 7-day bar chart of present vs absent
- **Recent activity feed** — Latest check-in/check-out events across the organization
- **Auto-refresh** — Data refreshes every 60 seconds
- **RBAC protected** — Accessible to Manager role and above

### Leave Management
- **Leave types** — Configurable categories (Annual, Sick, Casual, etc.)
- **Balance tracking** — Per-user, per-year allocated/used/pending days
- **Application workflow** — Apply → Manager approval → Balance deducted
- **Email notifications** — Auto-notify manager on application, notify employee on decision
- **Calendar view** — See leave history and upcoming leaves

### Regularization
- **Request types** — Missed Check-in, Missed Check-out, Wrong Time
- **Approval workflow** — Submit → Manager/HR review → Approve/Reject
- **Email notifications** — Notify reporting manager on submission, notify employee on decision

### Employee Management
- **Add employees** — Auto-generates temporary password, sends welcome email
- **Edit employees** — Update name, email, role, department, entity, location, manager, status
- **Reset password** — Generate new temp password and email it; backup shown to admin
- **Forced password change** — New employees must change temp password on first login
- **Real-time cards** — See who's working, session count, check-in/out times, live timers

### Geofencing
- **Define zones** — Set office locations with latitude, longitude, and radius
- **Interactive map** — Visual geofence management (Google Maps integration)
- **Validation** — Check-in/out only allowed within configured geofence zones
- **Multiple zones** — Support for multiple offices/locations

### Reports & Export
- **Personal reports** — Daily/Monthly calendar view, filter by month
- **Admin Reports (5 tabs):**
  - **Attendance Summary** — Per-employee present/absent/late/half-day/leave counts with total work hours and overtime for any date range
  - **Daily Attendance View** — All employees' status, check-in/out times, work hours for a single date
  - **Late Arrivals** — Employees ranked by late frequency with expandable date details
  - **Overtime Report** — Employees ranked by total OT hours with daily breakdown
  - **Leave Summary** — Allocated/used/pending/balance per leave type per employee
- **Filters** — Date range picker, department filter, quick presets (Today, 7 Days, 30 Days, This Month)
- **PDF export** — Professional formatted attendance reports
- **Excel export** — All admin reports exportable to .xlsx for payroll integration
- **RBAC protected** — Admin reports require `reports:view-all` permission (HR Admin+)

### Email Notifications
- **DB-configurable SMTP** — Set up email via the Settings page (no env vars needed)
- **Auto BCC to admins** — All notification emails BCC'd to admin users (no duplicates)
- **Templates** — Professional branded HTML email templates
- **Triggers:**
  - Welcome email (new employee with temp password)
  - Password reset email
  - Leave application → Manager notification
  - Leave approval/rejection → Employee notification
  - Regularization request → Manager notification
  - Regularization decision → Employee notification

### Settings & Master Data
- **Departments** — Create and manage organizational departments
- **Entities** — Manage legal/business entities
- **Locations** — Manage office locations
- **Leave Types** — Configure leave categories with default days
- **Email Configuration** — Set SMTP server, test connection, configure sender
- **App Settings** — Work hours, late threshold, auto-checkout time, geofence radius

---

## Demo Credentials

After seeding the database (`npm run db:seed`), use these accounts:

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@demo.com` | `password123` |
| Admin | `admin@demo.com` | `password123` |
| HR Admin | `hr@demo.com` | `password123` |
| Manager | `manager@demo.com` | `password123` |
| Employee | `john@demo.com` | `password123` |
| Employee | `jane@demo.com` | `password123` |

---

## Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production (runs Prisma generate first) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Create and apply migration (if using migrations) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Reset database and re-apply migrations |

---

## Configuration

### App Constants (`src/lib/constants.ts`)

| Constant | Default | Description |
|---|---|---|
| `STANDARD_WORK_HOURS` | 8 | Hours for full-day calculation |
| `LATE_THRESHOLD` | "09:30" | Time after which check-in is "late" |
| `AUTO_CHECKOUT_HOUR` | 23 | Auto-checkout hour (24h format) |
| `DEFAULT_GEOFENCE_RADIUS` | 200 | Default geofence radius in meters |

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth encryption secret |
| `NEXTAUTH_URL` | Yes | App URL (for auth callbacks) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (for email links) |
| `NEXT_PUBLIC_APP_NAME` | No | App display name |
| `SMTP_HOST` | No* | SMTP server hostname |
| `SMTP_PORT` | No* | SMTP server port (default: 587) |
| `SMTP_USER` | No* | SMTP username |
| `SMTP_PASS` | No* | SMTP password |
| `EMAIL_FROM` | No | Sender email address |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | No | Google Maps API key |

> *SMTP settings can alternatively be configured through the Settings page in the app (stored in database).

---

## License

Private — National Group India. All rights reserved.
