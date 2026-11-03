-- =======================================================
-- Rotary Club of Honavar - SQLite Database Schema
-- Compatible with local SQLite and Turso cloud database
-- =======================================================

-- 1. USERS TABLE (Club Admins, Approved Members, and Pending Applicants)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'PENDING' CHECK(role IN ('ADMIN', 'MEMBER', 'PENDING')),
    phone TEXT,
    membership_end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. EVENTS TABLE (Ongoing & Past Events with status and publish control)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date TEXT NOT NULL,
    location TEXT,
    category TEXT NOT NULL DEFAULT 'ongoing' CHECK(category IN ('ongoing', 'past')),
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'completed', 'cancelled')),
    is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- 3. EVENT PHOTOS TABLE (Gallery photos storing Vercel Blob URLs)
CREATE TABLE IF NOT EXISTS event_photos (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    order_num INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id);

-- 4. PROJECTS TABLE (Club Service Initiatives like Pink Rickshaw, Tree Plantation)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ongoing' CHECK(category IN ('ongoing', 'past')),
    cover_image TEXT,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    created_by_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);

-- 5. LEADERSHIP ROSTER TABLE (Board of Directors & Past Presidents)
CREATE TABLE IF NOT EXISTS leaders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    rotary_year TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leaders_order ON leaders(order_num);

-- 6. CIVIC SERVICE REQUESTS TABLE ("Report a Need" Portal)
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    tracking_code TEXT UNIQUE NOT NULL, -- e.g. "HON-SR-2026-0001"
    submitter_name TEXT NOT NULL,
    submitter_email TEXT NOT NULL,
    submitter_phone TEXT,
    location TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'UNDER_REVIEW', 'ACTION_TAKEN', 'COMPLETED', 'REJECTED')),
    admin_notes TEXT,
    assigned_member_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_member_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sr_tracking ON service_requests(tracking_code);
CREATE INDEX IF NOT EXISTS idx_sr_status ON service_requests(status);

-- 7. MEMBERSHIP APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS membership_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    profession TEXT NOT NULL,
    motivation_message TEXT,
    community_interests TEXT,
    skills_experience TEXT,
    time_commitment TEXT,
    task_willingness INTEGER NOT NULL DEFAULT 1,
    service_areas TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    review_notes TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. MEMBER TASKS TABLE (Tasks assigned to active Rotarians)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    project_title TEXT,
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- 9. CONTACT INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'READ', 'REPLIED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

