# National Group India AttendEase

A modern, full-featured **Attendance Management System** built as a Progressive Web App (PWA). Designed for organizations to track employee attendance with GPS verification, manage leaves, handle regularization requests, and generate comprehensive reports.

**Live:** [https://attendease.nationalgroupindia.com](https://attendease.nationalgroupindia.com)

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
  - [Shift Management](#shift-management)
  - [Entity & Location Management](#entity--location-management)
  - [Geofencing](#geofencing)
  - [Reports & Export](#reports--export)
  - [Email Notifications](#email-notifications)
  - [Settings & Master Data](#settings--master-data)
- [Demo Credentials](#demo-credentials)
- [Scripts Reference](#scripts-reference)
- [Configuration](#configuration)
- [License](#license)

---

## Features

- **GPS-based Check-in/Check-out** — Verify employee location against geofence zones
- **Real-time Dashboard** — Live working status, timers, and daily statistics
- **Management Dashboard** — Overview cards, attendance donut chart, location-wise summary, weekly trend, and recent activity feed
- **Management Role** — Dedicated executive/supervisory role (auto-present, no check-in required, view & approve only)
- **Team Attendance Viewer** — Managers/admins can view any team member's attendance via dropdown
- **Shift Management** — Configurable work shifts with start/end times, grace periods, and standard work minutes
- **Entity & Location Management** — Multi-entity organization structure with location assignment and cascading filters
- **Entity-Based Visibility** — Strict data isolation — non-SUPER_ADMIN users only see data within their own entity
- **Leave Management** — Apply, approve/reject leaves with balance tracking (fixed & accrual-based)
- **Attendance Regularization** — Request corrections for missed check-ins/outs with approval workflow
- **Employee Management** — Add, edit, delete employees with temp password generation and email notifications
- **Password Reset** — Admin can reset passwords; temp password emailed to employee
- **Geofencing** — Define office zones with lat/lng and radius; per-user geofence toggle
- **Reports & Export** — 5-tab admin reporting with Excel export; personal reports with PDF export
- **Cross-Device Sync** — Auto-refresh dashboard every 30s, server-authoritative timer
- **Email Notifications** — Automated emails for all workflows with admin BCC
- **Cron Jobs** — Scheduled attendance reminder emails
- **Role-Based Access** — 6-tier role hierarchy (Employee → Super Admin) with granular permissions
- **Progressive Web App** — Installable on mobile, offline check-in queue with auto-sync
- **Dark Mode** — Full dark/light theme support
- **Responsive Design** — Mobile-first UI built with Tailwind CSS

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
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
│  17 Models · 4 Enums · Adapter: @prisma/adapter-pg  │
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
   - Set `NEXTAUTH_URL` to your production domain (e.g., `https://attendease.nationalgroupindia.com`)
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
│   ├── schema.prisma           # Database schema (17 models, 4 enums)
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
│   │   ├── register/           # Registration page
│   │   ├── change-password/    # Password change (forced + voluntary)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx      # Dashboard shell (sidebar, nav)
│   │   │   ├── page.tsx        # Main dashboard (with MANAGEMENT auto-present)
│   │   │   ├── attendance/     # Check-in/out, daily log, team viewer
│   │   │   ├── management/     # Management dashboard (charts, location stats)
│   │   │   ├── leaves/         # Leave application & history
│   │   │   ├── admin-reports/  # Admin reports (5-tab, Excel export)
│   │   │   ├── reports/        # Personal reports with PDF/Excel export
│   │   │   ├── profile/        # User profile
│   │   │   ├── employees/      # Employee management (add/edit/delete)
│   │   │   ├── approvals/      # Leave & regularization approvals
│   │   │   ├── geofence/       # Geofence zone management
│   │   │   ├── regularization/ # Attendance regularization
│   │   │   └── settings/       # Master data & email config
│   │   └── api/
│   │       ├── auth/           # NextAuth + password change + registration
│   │       ├── attendance/     # Session, summary, sync
│   │       ├── employees/      # CRUD + reset password + delete
│   │       ├── departments/    # Department CRUD
│   │       ├── entities/       # Entity CRUD
│   │       ├── locations/      # Location CRUD
│   │       ├── shifts/         # Shift CRUD
│   │       ├── geofence/       # Geofence CRUD
│   │       ├── regularization/ # Create + review
│   │       ├── leaves/         # Apply, review, types
│   │       ├── management/     # Management dashboard API
│   │       ├── notifications/  # In-app notifications
│   │       ├── reports/        # Admin reports + export API
│   │       ├── cron/           # Scheduled attendance reminders
│   │       └── settings/       # App config + email config
│   ├── components/
│   │   └── ui/                 # Reusable UI components (Button, Card, Input, Badge, Select, etc.)
│   ├── generated/
│   │   └── prisma/             # Auto-generated Prisma client
│   └── lib/
│       ├── auth.ts             # NextAuth server config (Credentials provider)
│       ├── auth.config.ts      # Edge-safe auth config (JWT callbacks with entityId)
│       ├── prisma.ts           # Prisma client singleton
│       ├── email.ts            # Email utility (DB config, BCC admin, templates)
│       ├── rbac.ts             # Role-based access control (6-tier permissions matrix)
│       ├── constants.ts        # App constants, navigation items
│       ├── api-utils.ts        # API response helpers
│       ├── datetime.ts         # Date/time formatting & calculations (IST)
│       ├── geo.ts              # Geolocation helpers (haversine, geofence check)
│       ├── utils.ts            # General utility functions
│       └── store.ts            # Zustand stores (attendance, UI)
├── middleware.ts               # Route protection & role-based access
├── prisma.config.ts            # Prisma configuration
├── next.config.ts              # Next.js config (security headers, images)
├── tailwind.config.ts          # Tailwind CSS configuration
├── vercel.json                 # Vercel cron configuration
└── package.json
```

---

## Database Schema

### Models Overview (17 Models)

| Model | Description |
|---|---|
| **User** | Employees with role, department, entity, location, shift, manager relations. Supports `geofenceEnabled` per-user toggle, `mustChangePassword`, `employeeCode`, `phone`, `avatar`. |
| **Department** | Organizational departments (code + name, soft-deletable via `isActive`) |
| **Entity** | Legal/business entities (code + name + address). Has many locations and users. |
| **Location** | Office locations tied to an entity (code + name + address) |
| **Shift** | Work shift definitions with `startTime`/`endTime` (HH:mm), `graceMinutes`, `standardWorkMins`, `isDefault` |
| **AttendanceSession** | Individual check-in/check-out events with GPS coordinates, address, deviceInfo, `isAutoOut` flag |
| **DailySummary** | Aggregated daily stats (work mins, break mins, overtime, status). Unique per user + date. |
| **Regularization** | Attendance correction requests (missed check-in/out, wrong time) with approval workflow |
| **GeoFence** | Geofence zones (lat, lng, radius in meters) |
| **LeaveType** | Leave categories with support for fixed allocation or monthly accrual |
| **LeaveBalance** | Per-user, per-year leave balance tracking (allocated, used, pending) |
| **LeaveRequest** | Leave applications with date range, days count, and approval workflow |
| **Notification** | In-app notifications with read/unread tracking |
| **AuditLog** | Audit trail for all actions with JSON metadata |
| **EmailConfig** | SMTP configuration stored in database (gmail/microsoft365/custom) |
| **AppConfig** | Key-value application settings store |
| **VerificationCode** | Email verification codes with expiry for registration |

### Enums

| Enum | Values |
|---|---|
| **Role** | `SUPER_ADMIN` · `ADMIN` · `MANAGEMENT` · `HR_ADMIN` · `MANAGER` · `EMPLOYEE` |
| **SessionType** | `CHECK_IN` · `CHECK_OUT` |
| **RegularizationStatus** | `PENDING` · `APPROVED` · `REJECTED` |
| **LeaveStatus** | `PENDING` · `APPROVED` · `REJECTED` · `CANCELLED` |

### Key Relationships

```
User ──── Department (many-to-one)
User ──── Entity (many-to-one)
User ──── Location (many-to-one)
User ──── Shift (many-to-one)
User ──── User as Manager (self-referential)
User ──── AttendanceSession (one-to-many)
User ──── DailySummary (one-to-many)
User ──── Regularization (one-to-many, as employee + reviewer)
User ──── LeaveRequest (one-to-many, as applicant + reviewer)
User ──── LeaveBalance (one-to-many)
Entity ── Location (one-to-many)
LeaveType ── LeaveBalance (one-to-many)
LeaveType ── LeaveRequest (one-to-many)
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth sign-in/sign-out/session |
| POST | `/api/auth/register` | User registration with email verification |
| POST | `/api/auth/change-password` | Change or reset password |
| POST | `/api/auth/send-code` | Send email verification code |
| GET | `/api/auth/locations` | Get locations for registration dropdown |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/session` | Check-in or check-out with GPS |
| GET | `/api/attendance/summary` | Get daily summary for user |
| POST | `/api/attendance/sync` | Sync offline attendance queue |

### Employees
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/employees` | List / create employees (auto-generates temp password + email) |
| GET/PUT/DELETE | `/api/employees/[id]` | Get / update / delete employee (cascade deletes all related records) |
| POST | `/api/employees/[id]/reset-password` | Reset password (generates temp + email) |

### Leaves
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/leaves` | List / apply for leave (entity-filtered) |
| PUT | `/api/leaves/[id]/review` | Approve/reject leave request |
| GET/POST | `/api/leaves/types` | List / create leave types |

### Regularization
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/regularization` | List / submit regularization requests |
| PUT | `/api/regularization/[id]/review` | Approve/reject regularization |

### Master Data
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/departments` | List / create departments |
| GET/POST | `/api/entities` | List / create entities |
| GET/POST | `/api/locations` | List / create locations (with entity assignment) |
| GET/POST | `/api/shifts` | List / create work shifts |
| GET/POST | `/api/geofence` | List / create geofence zones |
| GET/PUT/DELETE | `/api/geofence/[id]` | Get / update / delete geofence zone |

### Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/management` | Management dashboard data (overview, location stats, weekly trend, activity) |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/admin` | Admin reports (summary, daily, late, overtime, leave) with Excel export |
| GET | `/api/reports/export` | Export attendance data (PDF/Excel) |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/api/notifications` | List / mark-read in-app notifications |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/api/settings/app-config` | Application configuration (key-value) |
| GET/PUT | `/api/settings/email-config` | SMTP email configuration + connection test |

### Cron
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cron/attendance-reminders` | Scheduled daily attendance reminder emails |

---

## Role-Based Access Control

### Role Hierarchy (6 Tiers)

```
SUPER_ADMIN > ADMIN > MANAGEMENT > HR_ADMIN > MANAGER > EMPLOYEE
```

> **MANAGEMENT** is a special executive/supervisory role. Users with this role are automatically marked present (no check-in required), cannot apply for leave, and cannot create regularizations. They can view all attendance, approve requests, and access reports.

> **Entity Isolation:** All roles except SUPER_ADMIN are restricted to viewing data within their own entity. SUPER_ADMIN sees all entities.

### Permissions Matrix

| Permission | Employee | Manager | HR Admin | Management | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Check in/out | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| View own attendance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team attendance | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all attendance | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Apply for leave | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Approve leaves | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all leaves | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Request regularization | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Approve regularization | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team reports | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all reports | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export reports | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Management dashboard | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage employees | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage departments | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage geofences | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage settings | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

> **—** means not applicable (MANAGEMENT role doesn't check in, apply for leave, or create regularizations by design).

### Route Protection

| Route | Minimum Role |
|---|---|
| `/dashboard` | Any authenticated user |
| `/dashboard/attendance` | Any authenticated user |
| `/dashboard/leaves` | Any authenticated user |
| `/dashboard/reports` | Any authenticated user |
| `/dashboard/regularization` | Any authenticated user |
| `/dashboard/profile` | Any authenticated user |
| `/dashboard/management` | MANAGER |
| `/dashboard/approvals` | MANAGER |
| `/dashboard/admin-reports` | HR_ADMIN |
| `/dashboard/employees` | HR_ADMIN (view) / ADMIN (manage) |
| `/dashboard/geofence` | ADMIN |
| `/dashboard/settings` | ADMIN |

---

## Features in Detail

### Attendance Tracking
- **GPS-verified check-in/check-out** with geofence validation
- **Live timer** showing current session duration with server-authoritative sync
- **Shift-aware late detection** — late threshold based on assigned shift + grace minutes
- **Shift-aware overtime** — overtime calculated against shift's standard work minutes
- **Team member viewer** — Managers see a dropdown to view any direct report's attendance; admins/HR see all employees (entity-filtered)
- **Cross-device sync** — Dashboard auto-refreshes every 30 seconds
- **Offline support** — Queue check-ins when offline, auto-sync when back online
- **Daily summary** — Total work minutes, break time, overtime, late status
- **Status tracking** — Present, Absent, Late, Half Day, On Leave

### Management Dashboard
- **Overview cards** — Total employees, present today (includes MANAGEMENT role), on leave, absent, late arrivals, pending approvals
- **Attendance donut chart** — Visual breakdown of present/absent/leave/late
- **Location-wise summary table** — Per-location totals for present, absent, late, on leave (MANAGEMENT users counted as present)
- **Weekly trend chart** — 7-day bar chart of present employees
- **Recent activity feed** — Latest check-in/check-out events across the organization
- **Auto-refresh** — Data refreshes every 60 seconds
- **Entity-filtered** — Non-SUPER_ADMIN users see only their entity's data

### Leave Management
- **Leave types** — Configurable categories (Annual, Sick, Casual, etc.) with fixed or accrual-based allocation
- **Balance tracking** — Per-user, per-year allocated/used/pending days
- **Application workflow** — Apply → Manager approval → Balance deducted
- **Email notifications** — Auto-notify manager on application, notify employee on decision
- **Entity-filtered** — Leave requests scoped by entity

### Regularization
- **Request types** — Missed Check-in, Missed Check-out, Wrong Time
- **Approval workflow** — Submit → Manager/HR review → Approve/Reject
- **Email notifications** — Notify reporting manager on submission, notify employee on decision
- **Entity-filtered** — Approvals scoped by entity

### Employee Management
- **Add employees** — Auto-generates temporary password, sends welcome email
- **Edit employees** — Update name, email, phone, role, department, entity, location, shift, manager, geofence toggle, status
- **Delete employees** — Cascade deletes all related records (sessions, summaries, leaves, regularizations, notifications, audit logs). Nullifies manager references on subordinates.
- **Reset password** — Generate new temp password and email it; backup shown to admin
- **Forced password change** — New employees must change temp password on first login
- **Per-user geofence toggle** — Enable/disable geofence enforcement per employee
- **Real-time cards** — See who's working, session count, check-in/out times, live timers
- **Filters** — Search, role, department, entity, location, working status filters
- **MANAGEMENT role display** — Shows "Present / Management" badge instead of timer
- **RBAC restricted** — Only ADMIN and SUPER_ADMIN can add/edit/delete employees

### Shift Management
- **Named shifts** — Define shifts with custom names (e.g., "Morning Shift", "Night Shift")
- **Time configuration** — Start time, end time (HH:mm format)
- **Grace period** — Configurable grace minutes before marking as late
- **Standard work minutes** — Define expected work duration per shift
- **Default shift** — Mark one shift as default for new employees
- **User assignment** — Assign employees to specific shifts

### Entity & Location Management
- **Multi-entity support** — Manage multiple legal/business entities within one system
- **Location hierarchy** — Locations belong to entities with cascading dropdown filters
- **Entity-based data isolation** — Non-SUPER_ADMIN users are restricted to their own entity across all pages
- **Cascading filters** — Entity → Location dropdowns throughout the app (employees, reports, etc.)

### Geofencing
- **Define zones** — Set office locations with latitude, longitude, and radius
- **Interactive map** — Visual geofence management (Google Maps integration)
- **Validation** — Check-in/out validated against configured geofence zones
- **Multiple zones** — Support for multiple offices/locations
- **Per-user toggle** — Geofence enforcement can be disabled per employee via the `geofenceEnabled` flag
- **Global toggle** — App-wide geofence enforcement via `GEOFENCE_ENFORCE` config

### Reports & Export
- **Personal reports** — Daily/Monthly calendar view, filter by month
- **Admin Reports (5 tabs):**
  - **Attendance Summary** — Per-employee present/absent/late/half-day/leave counts with total work hours and overtime (MANAGEMENT users show all working days as present)
  - **Daily Attendance View** — All employees' status, check-in/out times, work hours for a single date (MANAGEMENT users show as "Present")
  - **Late Arrivals** — Employees ranked by late frequency with expandable date details
  - **Overtime Report** — Employees ranked by total OT hours with daily breakdown
  - **Leave Summary** — Allocated/used/pending/balance per leave type per employee
- **Filters** — Date range picker, department, entity, location filters, quick presets (Today, 7 Days, 30 Days, This Month)
- **PDF export** — Professional formatted attendance reports
- **Excel export** — All admin reports exportable to .xlsx for payroll integration
- **Entity-filtered** — Non-SUPER_ADMIN users see only their entity's data in all reports

### Email Notifications
- **DB-configurable SMTP** — Set up email via the Settings page (supports Gmail, Microsoft 365, custom SMTP)
- **Auto BCC to admins** — All notification emails BCC'd to admin users (no duplicates)
- **Templates** — Professional branded HTML email templates
- **Triggers:**
  - Welcome email (new employee with temp password)
  - Password reset email
  - Email verification code (registration)
  - Leave application → Manager notification
  - Leave approval/rejection → Employee notification
  - Regularization request → Manager notification
  - Regularization decision → Employee notification
  - Daily attendance reminders (via cron)

### Settings & Master Data
- **Departments** — Create and manage organizational departments
- **Entities** — Manage legal/business entities
- **Locations** — Manage office locations (with entity assignment)
- **Shifts** — Configure work shifts with times and grace periods
- **Leave Types** — Configure leave categories with fixed or accrual-based allocation
- **Email Configuration** — Set SMTP server, test connection, configure sender
- **App Settings** — Work hours, late threshold, auto-checkout time, geofence enforcement

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
| `npm run db:migrate` | Create and apply migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Reset database and re-apply migrations |

---

## Configuration

### App Constants (`src/lib/constants.ts`)

| Constant | Default | Description |
|---|---|---|
| `APP_NAME` | "National Group India AttendEase" | Application display name |
| `APP_SHORT_NAME` | "NGI AttendEase" | Short name for PWA |
| `STANDARD_WORK_HOURS` | 8 | Hours for full-day calculation |
| `LATE_THRESHOLD` | "09:30" | Fallback time after which check-in is "late" |
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
| `NEXT_PUBLIC_DEFAULT_GEOFENCE_RADIUS` | No | Default geofence radius (meters) |

> *SMTP settings can alternatively be configured through the Settings page in the app (stored in database).

---

## License

Private — National Group India. All rights reserved.
