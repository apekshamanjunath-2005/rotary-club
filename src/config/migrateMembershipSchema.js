/**
 * Safe SQLite Migration for Rotary Club Database
 * Inspects existing table schema using PRAGMA table_info and adds only missing columns.
 * Preserves all existing records and constraints.
 */

async function migrateMembershipApplications(execute, query) {
    try {
        const columnsInfo = await query('PRAGMA table_info(membership_applications)');
        const existingColumnNames = columnsInfo.map(col => col.name);

        const columnsToAdd = [
            { name: 'age', definition: 'INTEGER' },
            { name: 'community_interests', definition: 'TEXT' },
            { name: 'skills_experience', definition: 'TEXT' },
            { name: 'time_commitment', definition: 'TEXT' },
            { name: 'task_willingness', definition: 'INTEGER NOT NULL DEFAULT 1' },
            { name: 'service_areas', definition: 'TEXT' }
        ];

        const added = [];
        for (const col of columnsToAdd) {
            if (!existingColumnNames.includes(col.name)) {
                await execute(`ALTER TABLE membership_applications ADD COLUMN ${col.name} ${col.definition}`);
                added.push(col.name);
            }
        }

        return {
            success: true,
            existingColumns: existingColumnNames,
            addedColumns: added
        };
    } catch (error) {
        console.error('Safe migration error on membership_applications:', error);
        throw error;
    }
}

async function migrateServiceRequests(execute, query) {
    try {
        const columnsInfo = await query('PRAGMA table_info(service_requests)');
        const existingColumnNames = columnsInfo.map(col => col.name);

        if (!existingColumnNames.includes('project_id')) {
            await execute('ALTER TABLE service_requests ADD COLUMN project_id TEXT');
            console.log('✅ Added missing project_id column to service_requests table.');
        }

        if (!existingColumnNames.includes('photo_url')) {
            await execute('ALTER TABLE service_requests ADD COLUMN photo_url TEXT');
            console.log('✅ Added missing photo_url column to service_requests table.');
        }

        return { success: true };
    } catch (error) {
        console.error('Safe migration error on service_requests:', error);
        throw error;
    }
}

module.exports = {
    migrateMembershipApplications,
    migrateServiceRequests
};
