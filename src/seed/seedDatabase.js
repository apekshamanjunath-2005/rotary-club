const bcrypt = require('bcryptjs');
const { initDatabase, execute, query, queryOne } = require('../config/db');

/**
 * Safe, Non-Destructive, and Idempotent Database Seeder
 * - Verifies database tables and runs non-destructive schema migrations.
 * - Seeds default initial records ONLY if they do not already exist.
 * - NEVER deletes or overwrites existing users, membership applications, tasks, or community submissions.
 */
async function seed() {
    console.log('🌱 Starting non-destructive database seeding for Rotary Club of Honavar...');

    // 1. Ensure all tables exist and safe migrations have completed
    await initDatabase();

    // 2. Ensure Default Administrator exists (non-destructive check)
    let admin = await queryOne('SELECT id FROM users WHERE email = ?', ['admin@rotaryhonavar.org']);
    let adminId = admin ? admin.id : 'usr_admin_01';

    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await execute(
            `INSERT INTO users (id, name, email, password, role, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, 'Club Administrator', 'admin@rotaryhonavar.org', hashedPassword, 'ADMIN', '+91 98765 43210']
        );
        console.log('✅ Default admin user created: admin@rotaryhonavar.org / admin123');
    } else {
        console.log('ℹ️ Admin user already exists. Preserving existing record.');
    }

    // 3. Ensure Signature Community Projects exist
    const projects = [
        {
            id: 'proj_01',
            title: 'Pink Rickshaw Livelihood Project',
            description: 'Empowering women in Honavar by donating pink auto-rickshaws as a sustainable source of independent livelihood and safe local transit.',
            category: 'past',
            cover_image: '/images/pink-rickshaw.jpg'
        },
        {
            id: 'proj_02',
            title: 'Sharavathi Riverbank Tree Plantation',
            description: 'Environmental conservation drive planting over 500 indigenous saplings along the Sharavathi riverbank to protect against erosion.',
            category: 'ongoing',
            cover_image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80'
        },
        {
            id: 'proj_03',
            title: 'Youth Higher Education Scholarships',
            description: 'Annual scholarship program providing tuition assistance and learning materials to 25 deserving high school students across Uttara Kannada.',
            category: 'ongoing',
            cover_image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80'
        },
        {
            id: 'proj_04',
            title: 'Town Hall Free Health & Eye Checkup Camp',
            description: 'Free comprehensive medical screening, vision testing, and eyeglasses distribution for senior citizens and low-income community members.',
            category: 'ongoing',
            cover_image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80'
        }
    ];

    let projectsInserted = 0;
    for (const p of projects) {
        const existing = await queryOne('SELECT id FROM projects WHERE id = ?', [p.id]);
        if (!existing) {
            await execute(
                `INSERT INTO projects (id, title, description, category, cover_image, created_by_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [p.id, p.title, p.description, p.category, p.cover_image, adminId]
            );
            projectsInserted++;
        }
    }
    console.log(`✅ Projects checked (${projectsInserted} inserted, ${projects.length - projectsInserted} already present).`);

    // 4. Ensure Signature Events & Multi-Photo Galleries exist
    const events = [
        {
            id: 'evt_01',
            title: 'Annual Blood Donation Drive 2026',
            description: 'Join us at the Town Hall to save lives. Blood collected supports the government hospital blood bank.',
            event_date: '2026-11-15',
            location: 'Town Hall, Honavar',
            category: 'ongoing',
            status: 'upcoming',
            is_published: 1,
            photos: [
                'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80'
            ]
        },
        {
            id: 'evt_02',
            title: 'Pink Rickshaw Key Handover Ceremony',
            description: 'Celebratory gathering handing over vehicle keys and permits to the women beneficiaries of the Pink Rickshaw initiative.',
            event_date: '2026-08-20',
            location: 'Rotary Club Hall, Honavar',
            category: 'past',
            status: 'completed',
            is_published: 1,
            photos: [
                '/images/pink-rickshaw.jpg'
            ]
        },
        {
            id: 'evt_03',
            title: 'Sharavathi Green Drive - 500 Saplings Planted',
            description: 'Volunteers, students, and club members joined hands along the riverbank for a greener tomorrow.',
            event_date: '2026-07-12',
            location: 'Sharavathi River Bank',
            category: 'past',
            status: 'completed',
            is_published: 1,
            photos: [
                'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=800&q=80'
            ]
        }
    ];

    let eventsInserted = 0;
    for (const e of events) {
        const existingEvent = await queryOne('SELECT id FROM events WHERE id = ?', [e.id]);
        if (!existingEvent) {
            await execute(
                `INSERT INTO events (id, title, description, event_date, location, category, status, is_published)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [e.id, e.title, e.description, e.event_date, e.location, e.category, e.status, e.is_published]
            );
            eventsInserted++;

            for (let i = 0; i < e.photos.length; i++) {
                const photoId = `photo_${e.id}_${i}`;
                const existingPhoto = await queryOne('SELECT id FROM event_photos WHERE id = ?', [photoId]);
                if (!existingPhoto) {
                    await execute(
                        `INSERT INTO event_photos (id, event_id, image_url, order_num)
                         VALUES (?, ?, ?, ?)`,
                        [photoId, e.id, e.photos[i], i]
                    );
                }
            }
        }
    }
    console.log(`✅ Events checked (${eventsInserted} inserted, ${events.length - eventsInserted} already present).`);

    // 5. Ensure Club Leadership Team exists
    const leaders = [
        { id: 'ldr_01', name: 'Rtn. Rajesh Kumar', position: 'President', rotary_year: '2025-2026', order_num: 1, image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_02', name: 'Rtn. Priya Shetty', position: 'Secretary', rotary_year: '2025-2026', order_num: 2, image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_03', name: 'Rtn. Suresh Nayak', position: 'Treasurer', rotary_year: '2025-2026', order_num: 3, image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_04', name: 'Rtn. Anjali Rao', position: 'Club Service Director', rotary_year: '2025-2026', order_num: 4, image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80' }
    ];

    let leadersInserted = 0;
    for (const l of leaders) {
        const existingLeader = await queryOne('SELECT id FROM leaders WHERE id = ?', [l.id]);
        if (!existingLeader) {
            await execute(
                `INSERT INTO leaders (id, name, position, rotary_year, order_num, image)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [l.id, l.name, l.position, l.rotary_year, l.order_num, l.image]
            );
            leadersInserted++;
        }
    }
    console.log(`✅ Leadership team checked (${leadersInserted} inserted, ${leaders.length - leadersInserted} already present).`);

    console.log('\n🎉 Non-destructive seeding completed successfully. All user accounts, applications, and tasks preserved.');
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
