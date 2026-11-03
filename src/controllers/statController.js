const { queryOne } = require('../config/db');

/**
 * GET /api/stats (Admin only)
 * Aggregates club KPIs and operational metrics in parallel
 */
exports.getAdminStats = async (req, res) => {
    try {
        const [
            totalProjects,
            ongoingProjects,
            publishedEvents,
            draftEvents,
            pendingApplications,
            activeServiceRequests,
            unreadContacts,
            activeMembers
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM projects'),
            queryOne("SELECT COUNT(*) as count FROM projects WHERE category = 'ongoing'"),
            queryOne('SELECT COUNT(*) as count FROM events WHERE is_published = 1'),
            queryOne('SELECT COUNT(*) as count FROM events WHERE is_published = 0'),
            queryOne("SELECT COUNT(*) as count FROM membership_applications WHERE status = 'PENDING'"),
            queryOne("SELECT COUNT(*) as count FROM service_requests WHERE status IN ('NEW', 'UNDER_REVIEW')"),
            queryOne("SELECT COUNT(*) as count FROM contacts WHERE status = 'NEW'"),
            queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'MEMBER' AND is_active = 1")
        ]);

        res.json({
            success: true,
            stats: {
                projects: {
                    total: totalProjects?.count || 0,
                    ongoing: ongoingProjects?.count || 0,
                    past: (totalProjects?.count || 0) - (ongoingProjects?.count || 0)
                },
                events: {
                    published: publishedEvents?.count || 0,
                    drafts: draftEvents?.count || 0,
                    total: (publishedEvents?.count || 0) + (draftEvents?.count || 0)
                },
                memberships: {
                    pending_review: pendingApplications?.count || 0,
                    active_members: activeMembers?.count || 0
                },
                service_requests: {
                    active_unresolved: activeServiceRequests?.count || 0
                },
                inbox: {
                    unread_messages: unreadContacts?.count || 0
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('getAdminStats error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve administrative statistics.' });
    }
};

