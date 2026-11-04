const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
const { migrateMembershipApplications, migrateServiceRequests, migrateTasks } = require('./migrateMembershipSchema');
require('dotenv').config();

// Load database connection URL and Auth Token from .env
const dbUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (!dbUrl) {
    throw new Error('❌ Configuration Error: TURSO_DATABASE_URL is not configured in .env.');
}

const isTursoCloud = dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://');

// If configured for Turso Cloud, ensure the authentication token is present
if (isTursoCloud && (!authToken || authToken.trim() === '')) {
    throw new Error(`❌ Configuration Error: TURSO_DATABASE_URL is configured for Turso Cloud (${dbUrl}), but TURSO_AUTH_TOKEN is missing or empty in .env.`);
}

// If explicitly using a local file fallback, ensure the directory exists
if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.replace('file:', '');
    const resolvedPath = path.resolve(process.cwd(), rawPath);
    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Initialize the LibSQL client (Turso / SQLite)
const db = createClient({
    url: dbUrl,
    authToken: authToken
});

/**
 * Returns safe metadata about the active database connection (never exposes credentials)
 */
function getDatabaseInfo() {
    let host = 'local-file';
    if (isTursoCloud) {
        try {
            host = new URL(dbUrl).hostname;
        } catch {
            host = 'turso-cloud';
        }
    }
    return {
        isCloud: isTursoCloud,
        type: isTursoCloud ? 'Turso Cloud (Primary)' : 'Local SQLite',
        host: isTursoCloud ? host : dbUrl
    };
}

/**
 * Initializes the database tables by executing src/schema.sql
 */
async function initDatabase() {
    try {
        // 1. Verify connection
        await db.execute('SELECT 1 as ping');
        const dbInfo = getDatabaseInfo();
        if (dbInfo.isCloud) {
            console.log(`☁️ Connected to Turso Cloud Database: ${dbInfo.host}`);
        } else {
            console.log(`📁 Connected to Local SQLite Database: ${dbInfo.host}`);
        }

        // Run safe incremental migrations for existing tables first
        await migrateMembershipApplications(execute, query);
        await migrateServiceRequests(execute, query);
        await migrateTasks(execute, query);

        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            
            // Strip single-line comments (-- ...) and split statements by semicolon
            const cleanSql = schemaSql.replace(/--.*$/gm, '');
            const statements = cleanSql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const statement of statements) {
                await db.execute(statement);
            }
            console.log(`✅ Database schema verified and active on ${dbInfo.type}.`);
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        throw error;
    }
}

/**
 * Helper: Query multiple rows
 * Usage: const events = await query('SELECT * FROM events WHERE is_published = ?', [1]);
 */
const query = async (sql, args = []) => {
    const result = await db.execute({ sql, args });
    return result.rows;
};

/**
 * Helper: Query a single row
 * Usage: const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
 */
const queryOne = async (sql, args = []) => {
    const result = await db.execute({ sql, args });
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Helper: Execute INSERT, UPDATE, DELETE
 * Usage: await execute('INSERT INTO contacts (id, name, email, message) VALUES (?, ?, ?, ?)', [id, name, email, message]);
 */
const execute = async (sql, args = []) => {
    return await db.execute({ sql, args });
};

/**
 * Helper: Execute multiple SQL statements atomically in a single transaction.
 * If any statement fails, the entire transaction is rolled back automatically.
 */
const batch = async (statements) => {
    return await db.batch(statements, 'write');
};

module.exports = {
    db,
    initDatabase,
    getDatabaseInfo,
    query,
    queryOne,
    execute,
    batch,
    migrateMembershipApplications
};
