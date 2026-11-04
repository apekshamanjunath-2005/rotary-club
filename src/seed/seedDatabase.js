const bcrypt = require('bcryptjs');
const { initDatabase, execute, query } = require('../config/db');

async function seed() {
    console.log('🌱 Starting database seeding for Rotary Club of Honavar...');

    // 1. Ensure all tables exist
    await initDatabase();

    // 2. Clear existing sample data to prevent duplicate seeds
    await execute('DELETE FROM event_photos');
    await execute('DELETE FROM events');
    await execute('DELETE FROM projects');
    await execute('DELETE FROM leaders');
    await execute('DELETE FROM tasks');
    await execute('DELETE FROM users');

    // 3. Create Default Administrator
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminId = 'usr_admin_01';
    await execute(
        `INSERT INTO users (id, name, email, password, role, phone)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, 'Club Administrator', 'admin@rotaryhonavar.org', hashedPassword, 'ADMIN', '+91 98765 43210']
    );
    console.log('✅ Admin user created: admin@rotaryhonavar.org / admin123');

    // 4. Create Signature Community Projects
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

    for (const p of projects) {
        await execute(
            `INSERT INTO projects (id, title, description, category, cover_image, created_by_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [p.id, p.title, p.description, p.category, p.cover_image, adminId]
        );
    }
    console.log(`✅ ${projects.length} Community projects seeded.`);

    // 5. Create Events & Multi-Photo Galleries
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
                '/images/pink-rickshaw.jpg',
                'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=800&q=80'
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

    for (const e of events) {
        await execute(
            `INSERT INTO events (id, title, description, event_date, location, category, status, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [e.id, e.title, e.description, e.event_date, e.location, e.category, e.status, e.is_published]
        );

        // Insert gallery photos linked by foreign key
        for (let i = 0; i < e.photos.length; i++) {
            await execute(
                `INSERT INTO event_photos (id, event_id, image_url, order_num)
                 VALUES (?, ?, ?, ?)`,
                [`photo_${e.id}_${i}`, e.id, e.photos[i], i]
            );
        }
    }
    console.log(`✅ ${events.length} Events seeded with gallery photos.`);

    // 6. Create Club Leadership Team (2025-2026)
    const leaders = [
        { id: 'ldr_01', name: 'Rtn. Rajesh Kumar', position: 'President', rotary_year: '2025-2026', order_num: 1, image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_02', name: 'Rtn. Priya Shetty', position: 'Secretary', rotary_year: '2025-2026', order_num: 2, image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_03', name: 'Rtn. Suresh Nayak', position: 'Treasurer', rotary_year: '2025-2026', order_num: 3, image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80' },
        { id: 'ldr_04', name: 'Rtn. Anjali Rao', position: 'Club Service Director', rotary_year: '2025-2026', order_num: 4, image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80' }
    ];

    for (const l of leaders) {
        await execute(
            `INSERT INTO leaders (id, name, position, rotary_year, order_num, image)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [l.id, l.name, l.position, l.rotary_year, l.order_num, l.image]
        );
    }
    console.log(`✅ ${leaders.length} Leadership team members seeded.`);

    console.log('\n🎉 Seeding completed successfully!');
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});

