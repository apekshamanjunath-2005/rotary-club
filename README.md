# Rotary Club of Honavar - Website & Management System

> **Rotary International District 3170 • Chartered 1982 • Motto: *"Service Above Self"***

A full-stack, enterprise-grade club management portal and community website engineered for the **Rotary Club of Honavar** (Uttara Kannada, Karnataka, India). Designed from scratch to empower citizen reporting, showcase community initiatives, facilitate public membership applications with configurable eligibility rules, provide active Rotarians with an operational task workspace, and equip club leadership with a real-time administrative command center.

---

## 🏛️ Architectural Overview & Constraints

The system adheres strictly to lightweight, high-performance architectural boundaries:

- **Frontend:** Pure **HTML5**, **Tailwind CSS** (via CDN utility classes), and **Vanilla JavaScript (ES6+)**. Built with **zero bundlers, zero React, and zero build steps**.
- **Backend:** **Node.js** and **Express.js** REST API engine.
- **Database:** **SQLite** as the sole database engine via **`@libsql/client`** (supporting both Turso cloud-hosted databases and local file-based fallbacks at `file:./data/rotary.db`).
- **Media Storage:** **Vercel Blob** (`@vercel/blob` and `@vercel/blob/client`) for direct-to-cloud photo uploads, completely bypassing server disk storage.
- **Security & RBAC:** Cryptographic **JWT authentication**, **bcrypt** password hashing, parameterized SQL queries, object-level authorization (IDOR protection), and atomic transactions via `batch()`.

---

## 📁 Project Directory Structure

```
c:\rotary-club\
├── data/
│   └── rotary.db                   # Local SQLite database file (fallback)
├── public/                         # Static web assets served by Express
│   ├── css/
│   │   └── style.css               # Official Rotary palette & custom animations
│   ├── js/
│   │   ├── api.js                  # Unified API client & AuthStorage
│   │   ├── blobUpload.js           # Browser-to-Vercel-Blob client uploader
│   │   ├── main.js                 # Public website dynamic logic
│   │   ├── member.js               # Member Portal dynamic logic
│   │   └── admin.js                # Admin Command Center dynamic logic
│   ├── index.html                  # Public community website & lightbox
│   ├── member.html                 # Active Rotarian member portal
│   └── admin.html                  # Administrator command center
├── src/
│   ├── config/
│   │   ├── db.js                   # LibSQL client & batch transaction helper
│   │   ├── eligibilityConfig.js    # Configurable membership eligibility criteria
│   │   └── migrateMembershipSchema.js # Idempotent SQLite schema migration
│   ├── controllers/
│   │   ├── authController.js       # Login, registration & JWT issuance
│   │   ├── eventController.js      # Events & multi-photo gallery
│   │   ├── projectController.js    # Community service initiatives
│   │   ├── leaderController.js     # Club leadership roster
│   │   ├── serviceController.js    # Civic service requests & tracking
│   │   ├── contactController.js    # General inquiries inbox
│   │   ├── memberController.js     # Applications, eligibility & approval
│   │   ├── taskController.js       # Member tasks & completion toggling
│   │   └── statController.js       # Consolidated operational KPI metrics
│   ├── middleware/
│   │   └── authMiddleware.js       # JWT validation, Admin & Member guards
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth
│   │   ├── eventRoutes.js          # /api/events
│   │   ├── projectRoutes.js        # /api/projects
│   │   ├── leaderRoutes.js         # /api/leaders
│   │   ├── serviceRoutes.js        # /api/service-requests
│   │   ├── contactRoutes.js        # /api/contacts
│   │   ├── memberRoutes.js         # /api/memberships
│   │   ├── taskRoutes.js           # /api/tasks
│   │   └── statRoutes.js           # /api/stats
│   ├── seed/
│   │   └── seedDatabase.js         # Schema executor & seed data loader
│   └── schema.sql                  # Canonical 9-table SQLite schema
├── .env.example                    # Environment variable template
├── .gitignore                      # Security exclusions (tokens, DBs, logs)
├── package.json                    # Project dependencies and scripts
├── server.js                       # Express application server entrypoint
└── README.md                       # Comprehensive documentation
```

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

### 2. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:

```env
PORT=5000
TURSO_DATABASE_URL=libsql://your-turso-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here
JWT_SECRET=your_jwt_secret_key_change_in_production
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database & Seed Sample Data
Execute the database initialization and seed script to create all 9 SQLite tables and populate initial projects, events, gallery photos, leaders, and the default administrator:
```bash
npm run seed
```

### 5. Launch the Server
```bash
# Start production server
npm start

# Or start with automatic reloading
npm run dev
```
Navigate to `http://localhost:5000` in your web browser.

---

## 🔑 Default Credentials & Roles

| Account Type | Email | Password | Role | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Club Administrator** | `admin@rotaryhonavar.org` | `admin123` | `ADMIN` | Full control: events, multi-photo uploads, approvals, member task assignment, triage |
| **Candidate Applicant** | *(Registered via Join Us)* | *(Set by applicant)* | `PENDING` | View application status; restricted from member tasks |
| **Active Member** | *(Approved by Board)* | *(Original password)* | `MEMBER` | Access `/member.html`, 1-year term countdown, task checklist |

---

## 📡 REST API Reference & Postman Collection

All endpoints are mounted under `/api`. Protected routes require `Authorization: Bearer <JWT_TOKEN>`.

### 1. Authentication Module (`/api/auth`)

#### `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "admin@rotaryhonavar.org",
    "password": "admin123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "usr_admin_01",
      "name": "Dr. Ramesh Bhandari",
      "email": "admin@rotaryhonavar.org",
      "role": "ADMIN",
      "membership_end_date": "2027-11-01"
    }
  }
  ```

#### `GET /api/auth/me`
- **Access:** Authenticated (Admin / Member / Pending)
- **Response (200 OK):** Returns current user record from database.

---

### 2. Events & Multi-Photo Gallery Module (`/api/events`)

#### `GET /api/events`
- **Access:** Public
- **Description:** Returns only published events (`is_published = 1`) with their nested gallery photos.

#### `GET /api/events/admin/all`
- **Access:** Admin only
- **Description:** Returns all events including unpublished drafts.

#### `POST /api/events`
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "title": "Honavar Coastal Cleanup 2026",
    "description": "Mangrove zone marine waste clearing initiative.",
    "event_date": "2026-12-10",
    "location": "Kasarkod Beach",
    "category": "upcoming",
    "status": "upcoming",
    "is_published": 1,
    "photos": [
      "https://example.public.blob.vercel-storage.com/events/cleanup1.jpg"
    ]
  }
  ```

#### `POST /api/events/upload`
- **Access:** Admin (Token Request) / Vercel (Signed Webhook)
- **Description:** Handles browser client token generation for direct Vercel Blob file uploads.

#### `DELETE /api/events/blob`
- **Access:** Admin only
- **Description:** Securely removes an unused blob from Vercel storage if not referenced in any project or event.

---

### 3. Community Projects Module (`/api/projects`)

#### `GET /api/projects?category=ongoing`
- **Access:** Public
- **Query Params:** `category` (`ongoing` or `past`)

#### `POST /api/projects`
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "title": "Pink Rickshaw Livelihood Scheme",
    "description": "Providing subsidized electric rickshaws to rural women drivers.",
    "category": "ongoing",
    "cover_image": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09"
  }
  ```

---

### 4. Leadership Roster Module (`/api/leaders`)

#### `GET /api/leaders`
- **Access:** Public
- **Description:** Returns board officers sorted by `order_num ASC`.

---

### 5. Civic Service Requests ("Report a Need") Module (`/api/service-requests`)

#### `POST /api/service-requests`
- **Access:** Public
- **Description:** Submits a civic need and returns a tracking code.
- **Request Body:**
  ```json
  {
    "submitter_name": "Ramesh Hegde",
    "submitter_email": "ramesh@example.com",
    "submitter_phone": "+91 98765 43210",
    "location": "Aversa Port Road, Honavar",
    "issue_description": "Drinking water pipeline leak."
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Your service request has been submitted successfully.",
    "tracking_code": "HON-SR-2026-A8F2",
    "status": "NEW"
  }
  ```

#### `GET /api/service-requests/track/:code`
- **Access:** Public
- **Privacy Guarantee:** Returns status, location, and resolution notes while strictly omitting citizen phone and email.

#### `PATCH /api/service-requests/:id/status`
- **Access:** Admin only
- **Request Body:** `{ "status": "ACTION_TAKEN", "admin_notes": "Plumbing crew dispatched." }`

---

### 6. Membership Applications Module (`/api/memberships`)

#### `POST /api/memberships/apply`
- **Access:** Public (with password) OR Authenticated
- **Validation:** Minimum age 18, explicit task willingness agreement (`true`, `1`, `'yes'`), non-empty membership questions, duplicate email rejection.
- **Request Body:**
  ```json
  {
    "name": "Dr. Ananya Rao",
    "email": "ananya.rao@example.com",
    "phone": "+91 98765 11223",
    "age": 29,
    "profession": "Dentist",
    "motivation_message": "Eager to lead oral hygiene camps in rural schools.",
    "community_interests": "Child health and rural outreach.",
    "skills_experience": "6 years dental clinical practice.",
    "time_commitment": "5 hours weekly on weekends.",
    "task_willingness": "Yes",
    "service_areas": "Healthcare, Youth",
    "password": "SecurePassword2026!"
  }
  ```

#### `PATCH /api/memberships/:id/review`
- **Access:** Admin only
- **Atomic Promotion:** Approving sets application to `APPROVED`, changes user role to `MEMBER`, and grants an active 1-year term (`membership_end_date = date('now', '+1 year')`) inside a single `batch()` transaction.

---

### 7. Member Tasks Module (`/api/tasks`)

#### `GET /api/tasks/my-tasks`
- **Access:** Active Member / Admin
- **Description:** Returns tasks assigned to the logged-in user.

#### `PATCH /api/tasks/:id/toggle`
- **Access:** Active Member / Admin
- **IDOR Protection:** Members can only toggle tasks assigned to their user ID.

---

### 8. Admin Operational Metrics (`/api/stats`)

#### `GET /api/stats`
- **Access:** Admin only
- **Description:** Returns parallel-aggregated KPI summary data.

---

## 🔒 Security Safeguards & Architectural Patterns

1. **Route Precedence & Parameter Collisions:**
   - Literal paths (`/admin/all`, `/track/:code`, `/my-tasks`) are declared strictly before parameterized paths (`/:id`) across all routers to eliminate route masking.
2. **Direct Browser-to-Cloud Uploads:**
   - High-resolution gallery images are streamed directly from the browser to Vercel Blob CDN using `@vercel/blob/client` and a cryptographically signed upload token. No binary data passes through the Node.js process memory.
3. **URL Domain Sanitization:**
   - Image URLs are strictly validated to prevent SSRF and hotlink abuse: only `*.public.blob.vercel-storage.com` and trusted seed paths (`images.unsplash.com/photo-`) are permitted.
4. **Draft Privacy:**
   - Unauthenticated visitors querying `/api/events` or `/api/events/:id` are restricted to `is_published = 1`. Draft events return `404 Not Found` to public requests and are only viewable by admins via `/api/events/admin/all`.
5. **Database Transaction Guarantees (`batch()`):**
   - Multi-row insertions (Events + Photos, User Creation + Membership Application, Candidate Review + Role Elevation) are wrapped in atomic `batch()` calls. If any step fails, the entire transaction rolls back automatically.
6. **Object-Level Authorization (IDOR):**
   - In `taskController.toggleTask`, the backend validates that `task.user_id === req.user.id || req.user.role === 'ADMIN'`, preventing members from altering peers' checklists.

---

## 🧪 Testing & Verification

A suite of automated verification scripts is provided in the repository:

```bash
# Run Master End-to-End Smoke Test (All 11 Modules)
node scratch/master_e2e_test.js

# Run Membership Eligibility & Application Test Suite
node scratch/test_membership_enhancement.js

# Run Admin KPI Stats Test Suite
node scratch/test_step18.js

# Run Public Website Static Assets Integrity Test
node scratch/test_step20_static.js

# Run Member Portal Integrity Test
node scratch/test_step21_member.js

# Run Admin Command Center Integrity Test
node scratch/test_step22_admin.js
```

---

## 👥 User Journeys Supported

1. **Public Citizen:** Visits the site, learns about club history and the 4-Way Test, views ongoing initiatives, browses event photo galleries via the interactive lightbox, reports a civic need, and tracks resolution progress.
2. **Prospective Member:** Applies through the "Join Us" modal with age verification ($\ge 18$), fills out the 6-question dossier, commits to community tasks, and automatically receives an applicant account.
3. **Active Member:** Logs into the Member Portal (`/member.html`), views their 1-year active membership countdown, reviews assigned civic inspections, and marks community tasks as completed.
4. **Club Administrator:** Logs into the Command Center (`/admin.html`), tracks 5 real-time KPIs, uploads multi-photo galleries to Vercel Blob, triages civic requests, assigns members, reviews candidate applications, and manages leadership and project records.

---

## 📄 License & Attribution

Developed for the **Rotary Club of Honavar (RI District 3170)**. Built with pride under the Rotary motto: *"Service Above Self"*.

