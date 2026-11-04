/**
 * Rotary Club of Honavar - Admin Command Center Logic
 * Pure ES6+ JavaScript
 */

import {
    AuthStorage,
    showToast,
    AuthAPI,
    StatsAPI,
    EventsAPI,
    ProjectsAPI,
    LeadersAPI,
    ServicesAPI,
    MembershipAPI
} from './api.js';

import { uploadEventPhoto, uploadProjectPhoto, formatBytes } from './blobUpload.js';

// State management
let currentEventPhotos = []; // Array of photo URLs or objects for the active event modal
let cachedMembers = []; // List of club members for task/service assignment

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard check: Admin authorization
    if (!AuthStorage.isAuthenticated() || !AuthStorage.isAdmin()) {
        showToast('Administrator privileges required.', 'error');
        setTimeout(() => {
            window.location.href = '/index.html?error=admin_required';
        }, 300);
        return;
    }

    initNavbar();
    initTabs();
    initModals();
    initFilters();

    // Load initial dashboard metrics & active tab (Events)
    await loadAdminStats();
    await loadAdminEvents();
    loadActiveMembers(); // Prefetch active members for assignment modals
    populateTaskProjectDropdown(); // Prefetch projects for task assignment modal
});

// ==================== NAVIGATION & HEADER ====================
function initNavbar() {
    const user = AuthStorage.getUser();
    const nameDisplay = document.getElementById('admin-name-display');
    if (nameDisplay && user) nameDisplay.textContent = user.name;

    document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
        AuthStorage.clear();
        showToast('Signed out of Admin Center.', 'info');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 300);
    });

    document.getElementById('refresh-stats-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('refresh-stats-btn');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Refreshing...`;
        await loadAdminStats();
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate mr-1"></i> Refresh Data`;
        showToast('Operational statistics refreshed.', 'info');
    });
}

// ==================== TAB SWITCHING ====================
function initTabs() {
    window.switchTab = (tabName) => {
        const targetTab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.click();
        }
    };

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.admin-tab').forEach(t => {
                t.className = 'admin-tab py-3 px-4 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center space-x-2';
            });
            tab.className = 'admin-tab active py-3 px-4 border-b-2 border-rotary-blue text-rotary-blue transition flex items-center space-x-2 font-bold';

            // Hide all tab panels
            document.querySelectorAll('[id^="tab-panel-"]').forEach(panel => panel.classList.add('hidden'));

            // Show active tab panel
            const tabName = tab.dataset.tab;
            const activePanel = document.getElementById(`tab-panel-${tabName}`);
            if (activePanel) activePanel.classList.remove('hidden');

            // Trigger specific data loader
            if (tabName === 'events') await loadAdminEvents();
            if (tabName === 'service-requests') await loadAdminServiceRequests();
            if (tabName === 'memberships') await loadAdminMemberships();
            if (tabName === 'tasks') await Promise.all([loadAdminTasks(), populateTaskProjectDropdown()]);
            if (tabName === 'projects') await loadAdminProjects();
            if (tabName === 'leaders') await loadAdminLeaders();
            if (tabName === 'contacts') await loadAdminContacts();
        });
    });
}

// ==================== FILTER BUTTONS INITIALIZATION ====================
function initFilters() {
    // 1. Civic Service Request filter buttons
    document.querySelectorAll('.sr-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sr-filter').forEach(b => {
                b.className = 'sr-filter px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
            });
            btn.className = 'sr-filter active px-3 py-1 rounded-full bg-slate-900 text-white font-bold';
            loadAdminServiceRequests(btn.dataset.status);
        });
    });

    // 2. Membership Applications filter buttons
    document.querySelectorAll('.m-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.m-filter').forEach(b => {
                b.className = 'm-filter px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
            });
            btn.className = 'm-filter active px-3 py-1 rounded-full bg-amber-500 text-white font-bold';
            loadAdminMemberships(btn.dataset.status);
        });
    });

    // 3. Member Tasks filter buttons
    document.querySelectorAll('.task-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.task-filter').forEach(b => {
                b.className = 'task-filter px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
            });
            btn.className = 'task-filter active px-3 py-1 rounded-full bg-slate-900 text-white font-bold';
            loadAdminTasks(btn.dataset.status);
        });
    });

    // 4. Contact Inbox filter buttons
    document.querySelectorAll('.cnt-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cnt-filter').forEach(b => {
                b.className = 'cnt-filter px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
            });
            btn.className = 'cnt-filter active px-3 py-1 rounded-full bg-slate-900 text-white font-bold';
            loadAdminContacts(btn.dataset.status);
        });
    });
}

// ==================== DASHBOARD KPI STATS ====================
async function loadAdminStats() {
    try {
        const data = await StatsAPI.getAdminStats();
        const s = data.stats;

        // Projects
        setText('stat-projects-total', s.projects.total);
        setText('stat-projects-ongoing', s.projects.ongoing);
        setText('stat-projects-past', s.projects.past);

        // Events
        setText('stat-events-total', s.events.total);
        setText('stat-events-published', s.events.published);
        setText('stat-events-drafts', s.events.drafts);

        // Memberships
        setText('stat-memberships-pending', s.memberships.pending_review);
        setText('stat-members-active', s.memberships.active_members);

        // Civic Requests
        setText('stat-service-unresolved', s.service_requests.active_unresolved);

        // Inbox
        setText('stat-inbox-unread', s.inbox.unread_messages);

    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ==================== TAB 1: EVENTS & MULTI-PHOTO GALLERY ====================
async function loadAdminEvents() {
    const container = document.getElementById('admin-events-list');
    if (!container) return;

    try {
        const data = await EventsAPI.adminGetAll();
        const events = data.events || [];

        if (events.length === 0) {
            container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">No events registered yet.</div>`;
            return;
        }

        container.innerHTML = events.map(event => {
            const isPub = event.is_published === 1;
            const photoCount = event.photos ? event.photos.length : 0;

            return `
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="space-y-1.5 flex-1">
                        <div class="flex items-center space-x-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isPub ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                ${isPub ? 'Published' : 'Draft'}
                            </span>
                            <span class="text-xs font-semibold text-slate-400">${event.category || 'General'}</span>
                            <span class="text-xs text-slate-300">•</span>
                            <span class="text-xs font-semibold text-slate-500">${formatDate(event.event_date)}</span>
                        </div>
                        <h4 class="font-bold text-slate-900 text-base font-heading">${escapeHtml(event.title)}</h4>
                        <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(event.description || '')}</p>
                        <div class="flex items-center space-x-3 text-xs text-slate-400 pt-1">
                            <span><i class="fa-solid fa-location-dot mr-1 text-rotary-azure"></i>${escapeHtml(event.location || 'Honavar')}</span>
                            <span><i class="fa-solid fa-camera mr-1 text-rotary-azure"></i>${photoCount} Photos</span>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2 shrink-0">
                        <button onclick="window.editAdminEvent('${event.id}')" class="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:border-rotary-blue hover:text-rotary-blue text-xs font-bold transition">
                            <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                        </button>
                        <button onclick="window.deleteAdminEvent('${event.id}')" class="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition">
                            <i class="fa-solid fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        window._adminEventsCache = events;

    } catch (err) {
        console.error('Failed to load admin events:', err);
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">Failed to load events.</div>`;
    }
}

window.editAdminEvent = (id) => {
    const events = window._adminEventsCache || [];
    const event = events.find(e => e.id === id);
    if (!event) return;

    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-date').value = event.event_date;
    document.getElementById('event-location').value = event.location;
    document.getElementById('event-category').value = event.category || 'ongoing';
    document.getElementById('event-status').value = event.status || 'upcoming';
    document.getElementById('event-desc').value = event.description || '';
    document.getElementById('event-published').checked = event.is_published === 1;

    // Existing photos
    currentEventPhotos = (event.photos || []).map(p => ({
        id: p.id,
        image_url: p.image_url,
        caption: p.caption || ''
    }));
    renderEventPhotoPreviews();

    document.getElementById('event-modal-title').textContent = 'Edit Event & Gallery';
    openModal('event-modal');
};

window.deleteAdminEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event and all its gallery photos?')) return;
    try {
        await EventsAPI.delete(id);
        showToast('Event deleted successfully.', 'success');
        await loadAdminEvents();
        await loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

function renderEventPhotoPreviews() {
    const container = document.getElementById('event-photo-previews');
    if (!container) return;

    if (currentEventPhotos.length === 0) {
        container.innerHTML = `<span class="col-span-full text-slate-400 text-xs">No photos attached yet.</span>`;
        return;
    }

    container.innerHTML = currentEventPhotos.map((photo, idx) => `
        <div class="relative h-20 rounded-xl overflow-hidden border border-slate-200 group">
            <img src="${escapeHtml(photo.image_url)}" class="w-full h-full object-cover">
            <button type="button" onclick="window.removeEventPhoto(${idx})"
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition shadow">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

window.removeEventPhoto = (index) => {
    currentEventPhotos.splice(index, 1);
    renderEventPhotoPreviews();
};

// ==================== TAB 2: CIVIC SERVICE REQUESTS TRIAGE ====================
let allAdminServiceRequests = [];

async function loadAdminServiceRequests(status = '') {
    const container = document.getElementById('admin-sr-list');
    if (!container) return;

    try {
        const data = await ServicesAPI.getAllRequests(status);
        const requests = data.requests || [];
        allAdminServiceRequests = requests;

        if (requests.length === 0) {
            container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">No service requests matching filter.</div>`;
            return;
        }

        container.innerHTML = requests.map(req => {
            const statusStyles = {
                'NEW': 'bg-sky-100 text-sky-800',
                'UNDER_REVIEW': 'bg-amber-100 text-amber-800',
                'ACTION_TAKEN': 'bg-blue-100 text-blue-800',
                'COMPLETED': 'bg-emerald-100 text-emerald-800',
                'REJECTED': 'bg-rose-100 text-rose-800'
            };

            return `
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div class="flex items-center space-x-3">
                            <span class="font-mono font-bold text-sm text-rotary-blue">${escapeHtml(req.tracking_code)}</span>
                            <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${statusStyles[req.status] || 'bg-slate-100 text-slate-800'}">
                                ${req.status}
                            </span>
                        </div>
                        <span class="text-xs text-slate-400">${formatDate(req.created_at)}</span>
                    </div>

                    <div class="space-y-1">
                        <p class="text-xs font-semibold text-slate-900">${escapeHtml(req.issue_description)}</p>
                        <div class="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                            <span><strong>Location:</strong> ${escapeHtml(req.location)}</span>
                            <span><strong>Citizen:</strong> ${escapeHtml(req.submitter_name)} (${escapeHtml(req.submitter_email)})</span>
                            ${req.submitter_phone ? `<span><strong>Phone:</strong> ${escapeHtml(req.submitter_phone)}</span>` : ''}
                        </div>
                    </div>

                    ${req.photo_url ? `
                        <div class="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <img src="${escapeHtml(req.photo_url)}" alt="Issue photo evidence" class="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition" onclick="window.open('${escapeHtml(req.photo_url)}', '_blank')">
                            <div class="text-xs space-y-1">
                                <span class="font-bold text-slate-800 flex items-center space-x-1.5">
                                    <i class="fa-solid fa-camera text-rotary-blue"></i>
                                    <span>Citizen Photo Evidence</span>
                                </span>
                                <a href="${escapeHtml(req.photo_url)}" target="_blank" class="text-rotary-blue underline text-[11px] font-semibold hover:text-blue-800 inline-block">
                                    Open Full Resolution Image <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
                                </a>
                            </div>
                        </div>
                    ` : ''}

                    ${req.admin_notes ? `
                        <div class="p-3 bg-amber-50/70 rounded-xl text-xs text-amber-950 border border-amber-200">
                            <strong class="text-amber-900"><i class="fa-solid fa-clipboard-check mr-1 text-amber-700"></i>Internal / Public Note:</strong>
                            <p class="mt-1 text-slate-800 whitespace-pre-line">${escapeHtml(req.admin_notes)}</p>
                        </div>
                    ` : ''}

                    ${req.linked_project_id ? `
                        <div class="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center space-x-2">
                                <i class="fa-solid fa-handshake-angle text-emerald-600 text-sm"></i>
                                <div>
                                    <span class="font-bold">Linked Community Project:</span>
                                    <span class="font-semibold text-slate-800 ml-1">${escapeHtml(req.linked_project_title || 'Rotary Project')}</span>
                                    <span class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">${escapeHtml(req.linked_project_category || 'ongoing')}</span>
                                </div>
                            </div>
                            <button onclick="window.switchTab('projects')" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition">
                                View in Projects <i class="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                        </div>
                    ` : ''}

                    <!-- Triage Actions -->
                    <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                        <select onchange="window.updateSrStatus('${req.id}', this.value)" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold">
                            <option value="">Update Status...</option>
                            <option value="NEW">Set NEW</option>
                            <option value="UNDER_REVIEW">Set UNDER REVIEW</option>
                            <option value="ACTION_TAKEN">Set ACTION TAKEN</option>
                            <option value="COMPLETED">Set COMPLETED</option>
                            <option value="REJECTED">Set REJECTED</option>
                        </select>

                        <button onclick="window.addSrNotesPrompt('${req.id}')" class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50">
                            <i class="fa-solid fa-comment-dots mr-1"></i> Edit Notes
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load service requests:', err);
    }
}

window.updateSrStatus = async (id, status) => {
    if (!status) return;
    try {
        const res = await ServicesAPI.updateRequestStatus(id, status);
        if (res.created_project) {
            showToast(`Status updated to ${status}. Linked project "${res.created_project.title}" created automatically!`, 'success');
        } else {
            showToast(`Status updated to ${status}.`, 'success');
        }
        await loadAdminServiceRequests();
        await loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.addSrNotesPrompt = async (id) => {
    const target = allAdminServiceRequests.find(r => r.id === id);
    const existingNotes = target?.admin_notes || '';
    const notes = prompt('Enter administrative triage note / update for this request:', existingNotes);
    if (notes === null) return;
    try {
        await ServicesAPI.updateRequestStatus(id, undefined, notes.trim());
        showToast('Administrative note saved.', 'success');
        await loadAdminServiceRequests();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ==================== TAB 3: MEMBERSHIP APPLICATIONS REVIEW ====================
async function loadAdminMemberships(status = 'PENDING') {
    const container = document.getElementById('admin-memberships-list');
    if (!container) return;

    try {
        const data = await MembershipAPI.getApplications(status);
        const apps = data.applications || [];

        if (apps.length === 0) {
            container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">No applications under this filter.</div>`;
            return;
        }

        container.innerHTML = apps.map(app => {
            const isPending = app.status === 'PENDING';
            const statusBadge = {
                'PENDING': 'bg-amber-100 text-amber-800',
                'APPROVED': 'bg-emerald-100 text-emerald-800',
                'REJECTED': 'bg-rose-100 text-rose-800'
            }[app.status] || 'bg-slate-100 text-slate-800';

            return `
                <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div class="space-y-0.5">
                            <div class="flex items-center space-x-2">
                                <h4 class="text-base font-bold font-heading text-slate-900">${escapeHtml(app.name)}</h4>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge}">
                                    ${app.status}
                                </span>
                            </div>
                            <span class="text-xs text-slate-500">${escapeHtml(app.profession || 'Applicant')} • ${app.age || '--'} yrs old</span>
                        </div>
                        <span class="text-xs text-slate-400">Applied: ${formatDate(app.created_at)}</span>
                    </div>

                    <!-- Complete 6-Field Dossier Accordion -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Reason for Joining Rotary:</span>
                            <p class="text-slate-800 font-medium">${escapeHtml(app.motivation_message || 'N/A')}</p>
                        </div>
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Community Service Interests:</span>
                            <p class="text-slate-800 font-medium">${escapeHtml(app.community_interests || 'N/A')}</p>
                        </div>
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Skills & Experience to Contribute:</span>
                            <p class="text-slate-800 font-medium">${escapeHtml(app.skills_experience || 'N/A')}</p>
                        </div>
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Weekly Time Dedication:</span>
                            <p class="text-slate-800 font-medium">${escapeHtml(app.time_commitment || 'N/A')}</p>
                        </div>
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Preferred Service Areas:</span>
                            <p class="text-slate-800 font-medium">${escapeHtml(app.service_areas || 'N/A')}</p>
                        </div>
                        <div>
                            <span class="text-slate-400 font-bold block mb-1">Task Responsibility Commitment:</span>
                            <span class="inline-flex items-center space-x-1 text-emerald-700 font-bold">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>Agreed to Complete Assigned Club Tasks</span>
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs text-slate-500">
                        <div>
                            <i class="fa-solid fa-envelope mr-1 text-rotary-azure"></i>${escapeHtml(app.email)}
                            <span class="mx-2">•</span>
                            <i class="fa-solid fa-phone mr-1 text-rotary-azure"></i>${escapeHtml(app.phone || 'N/A')}
                        </div>

                        ${isPending ? `
                            <div class="flex space-x-2">
                                <button onclick="window.openReviewModal('${app.id}', '${escapeHtml(app.name)}', 'APPROVED')"
                                        class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm">
                                    <i class="fa-solid fa-check mr-1"></i> Approve Member
                                </button>
                                <button onclick="window.openReviewModal('${app.id}', '${escapeHtml(app.name)}', 'REJECTED')"
                                        class="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold transition">
                                    Reject
                                </button>
                            </div>
                        ` : `
                            <span class="text-xs text-slate-400 font-semibold italic">
                                Reviewed: ${formatDate(app.reviewed_at)} ${app.review_notes ? `("${escapeHtml(app.review_notes)}")` : ''}
                            </span>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load memberships:', err);
    }
}

window.openReviewModal = (appId, candidateName, initialDecision) => {
    document.getElementById('review-app-id').value = appId;
    document.getElementById('review-candidate-name').textContent = `Candidate: ${candidateName}`;
    document.getElementById('review-status').value = initialDecision;
    document.getElementById('review-notes').value = '';
    openModal('review-modal');
};

// ==================== TAB: MEMBER TASKS ====================
let currentTaskFilter = '';
let cachedProjectsForTasks = [];

async function loadActiveMembers() {
    try {
        const res = await MembershipAPI.getActiveMembers();
        cachedMembers = res.members || [];
        populateMemberDropdowns();
    } catch (err) {
        console.error('Failed to load active members:', err);
    }
}

function populateMemberDropdowns() {
    const taskSelect = document.getElementById('task-user-id');
    if (!taskSelect) return;

    if (cachedMembers.length === 0) {
        taskSelect.innerHTML = '<option value="">No active members found</option>';
        return;
    }

    taskSelect.innerHTML = '<option value="">Select an active member...</option>' +
        cachedMembers.map(m => `
            <option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})${m.role === 'ADMIN' ? ' [Admin]' : ''}</option>
        `).join('');
}

async function populateTaskProjectDropdown() {
    const taskProjectSelect = document.getElementById('task-project-id');
    if (!taskProjectSelect) return;

    const taskSaveBtn = document.getElementById('task-save-btn');

    try {
        const res = await ProjectsAPI.getAll();
        cachedProjectsForTasks = res.projects || [];

        if (cachedProjectsForTasks.length === 0) {
            taskProjectSelect.innerHTML = '<option value="">No projects available. Please create a project first.</option>';
            taskProjectSelect.disabled = true;
            if (taskSaveBtn) taskSaveBtn.disabled = true;
            return;
        }

        taskProjectSelect.disabled = false;
        if (taskSaveBtn) taskSaveBtn.disabled = false;
        taskProjectSelect.innerHTML = '<option value="">Select a project...</option>' +
            cachedProjectsForTasks.map(p => `
                <option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>
            `).join('');
    } catch (err) {
        console.error('Failed to populate task project dropdown:', err);
        taskProjectSelect.innerHTML = '<option value="">Failed to load projects</option>';
        taskProjectSelect.disabled = true;
        if (taskSaveBtn) taskSaveBtn.disabled = true;
    }
}

async function loadAdminTasks(completedFilter = currentTaskFilter) {
    currentTaskFilter = completedFilter !== undefined ? completedFilter : '';
    const container = document.getElementById('admin-tasks-list');
    if (!container) return;

    try {
        const data = await MembershipAPI.getAllTasks(null, currentTaskFilter !== '' ? currentTaskFilter : undefined);
        const tasks = data.tasks || [];

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                    <i class="fa-solid fa-list-check text-2xl text-slate-300 mb-2 block"></i>
                    No tasks found under this filter.
                </div>`;
            return;
        }

        container.innerHTML = tasks.map(t => {
            const isDone = t.completed === 1;
            return `
                <div class="p-4 rounded-2xl border transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${isDone ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-200 shadow-sm hover:border-rotary-blue'}">
                    <div class="flex items-start space-x-3.5 flex-1 min-w-0">
                        <div class="mt-0.5">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                <i class="fa-solid ${isDone ? 'fa-check' : 'fa-hourglass-half'}"></i>
                            </span>
                        </div>
                        <div class="space-y-1.5 flex-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h4 class="text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}">
                                    ${escapeHtml(t.title)}
                                </h4>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${isDone ? 'Completed' : 'Pending'}
                                </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span class="inline-flex items-center font-semibold text-slate-700">
                                    <i class="fa-solid fa-user mr-1.5 text-rotary-blue"></i>
                                    ${escapeHtml(t.member_name || 'Rotarian')}
                                    <span class="text-slate-400 font-normal ml-1">(${escapeHtml(t.member_email || '')})</span>
                                </span>
                                ${t.project_title ? `
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-rotary-blue font-semibold text-[11px]">
                                        <i class="fa-solid fa-folder-open mr-1"></i>Project: ${escapeHtml(t.project_title)}
                                    </span>
                                ` : ''}
                                ${t.due_date ? `
                                    <span class="inline-flex items-center text-slate-500 text-[11px]">
                                        <i class="fa-solid fa-calendar mr-1 text-slate-400"></i>Due: ${formatDate(t.due_date)}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <button onclick="window.toggleAdminTask('${t.id}')"
                                class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center space-x-1 ${isDone ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}"
                                title="${isDone ? 'Mark as Pending' : 'Mark as Completed'}">
                            <i class="fa-solid ${isDone ? 'fa-rotate-left' : 'fa-check'}"></i>
                            <span>${isDone ? 'Mark Pending' : 'Complete'}</span>
                        </button>
                        <button onclick="window.deleteAdminTask('${t.id}')"
                                class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center space-x-1"
                                title="Delete Task">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load tasks:', err);
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">Failed to load member tasks.</div>`;
    }
}

window.toggleAdminTask = async (id) => {
    try {
        const res = await MembershipAPI.toggleTask(id);
        showToast(res.message || 'Task status updated.', 'success');
        await loadAdminTasks();
    } catch (err) {
        showToast(err.message || 'Failed to update task status.', 'error');
    }
};

window.deleteAdminTask = async (id) => {
    if (!confirm('Are you sure you want to delete this assigned task?')) return;
    try {
        await MembershipAPI.deleteTask(id);
        showToast('Task deleted successfully.', 'success');
        await loadAdminTasks();
    } catch (err) {
        showToast(err.message || 'Failed to delete task.', 'error');
    }
};

// ==================== TAB 4: PROJECTS ====================
async function loadAdminProjects() {
    const container = document.getElementById('admin-projects-list');
    if (!container) return;

    try {
        const data = await ProjectsAPI.getAll();
        const projects = data.projects || [];

        if (projects.length === 0) {
            container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">No projects registered.</div>`;
            return;
        }

        container.innerHTML = projects.map(p => `
            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                    <div class="h-36 bg-slate-100 overflow-hidden relative">
                        <img src="${escapeHtml(p.cover_image || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80')}" class="w-full h-full object-cover">
                        <span class="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.category === 'ongoing' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}">
                            ${p.category}
                        </span>
                    </div>
                    <div class="p-4 space-y-1">
                        <h4 class="font-bold text-slate-900 text-sm font-heading">${escapeHtml(p.title)}</h4>
                        <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(p.description)}</p>
                    </div>
                </div>

                <div class="p-4 border-t border-slate-100 flex justify-end space-x-2">
                    <button onclick="window.editAdminProject('${p.id}')" class="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold hover:border-rotary-blue">
                        Edit
                    </button>
                    <button onclick="window.deleteAdminProject('${p.id}')" class="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        window._adminProjectsCache = projects;
        populateTaskProjectDropdown();

    } catch (err) {
        console.error('Failed to load projects:', err);
    }
}

function resetProjectCoverUI() {
    const dropzone = document.getElementById('project-upload-dropzone');
    const previewCard = document.getElementById('project-preview-card');
    const progressContainer = document.getElementById('project-upload-progress-container');
    const fileInput = document.getElementById('project-cover-file');
    const coverInput = document.getElementById('project-cover');
    const manualUrlInput = document.getElementById('project-manual-url');
    const urlContainer = document.getElementById('project-url-input-container');

    if (dropzone) dropzone.classList.remove('hidden');
    if (previewCard) previewCard.classList.add('hidden');
    if (progressContainer) progressContainer.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    if (coverInput) coverInput.value = '';
    if (manualUrlInput) manualUrlInput.value = '';
    if (urlContainer) urlContainer.classList.add('hidden');
}

function setProjectCoverPreview(imageUrl, filename = 'Cover Image', filesizeText = '') {
    const dropzone = document.getElementById('project-upload-dropzone');
    const previewCard = document.getElementById('project-preview-card');
    const previewImg = document.getElementById('project-preview-img');
    const filenameEl = document.getElementById('project-preview-filename');
    const filesizeEl = document.getElementById('project-preview-filesize');
    const badgeEl = document.getElementById('project-preview-badge');
    const coverInput = document.getElementById('project-cover');

    if (coverInput) coverInput.value = imageUrl || '';
    if (previewImg) previewImg.src = imageUrl || '';
    if (filenameEl) filenameEl.textContent = filename;
    if (filesizeEl) filesizeEl.textContent = filesizeText;
    if (badgeEl) {
        badgeEl.innerHTML = '<i class="fa-solid fa-circle-check mr-1 text-emerald-500"></i><span class="text-emerald-700 font-bold">Cover Image Set</span>';
    }

    if (dropzone) dropzone.classList.add('hidden');
    if (previewCard) previewCard.classList.remove('hidden');
}

window.editAdminProject = (id) => {
    const projects = window._adminProjectsCache || [];
    const p = projects.find(item => item.id === id);
    if (!p) return;

    document.getElementById('project-id').value = p.id;
    document.getElementById('project-title').value = p.title;
    document.getElementById('project-category').value = p.category;
    document.getElementById('project-cover').value = p.cover_image || '';
    document.getElementById('project-desc').value = p.description;

    if (p.cover_image) {
        setProjectCoverPreview(p.cover_image, p.title || 'Cover Photo', 'Existing Cover');
    } else {
        resetProjectCoverUI();
    }

    document.getElementById('project-modal-title').textContent = 'Edit Project';
    openModal('project-modal');
};

window.deleteAdminProject = async (id) => {
    if (!confirm('Delete this project?')) return;
    try {
        await ProjectsAPI.delete(id);
        showToast('Project deleted.', 'success');
        await loadAdminProjects();
        await loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ==================== TAB 5: LEADERS ====================
async function loadAdminLeaders() {
    const container = document.getElementById('admin-leaders-list');
    if (!container) return;

    try {
        const data = await LeadersAPI.getAll();
        const leaders = data.leaders || [];

        if (leaders.length === 0) {
            container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">No leaders registered.</div>`;
            return;
        }

        container.innerHTML = leaders.map(l => `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-sm flex flex-col justify-between">
                <div>
                    <img src="${escapeHtml(l.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80')}"
                         class="w-20 h-20 rounded-full mx-auto object-cover mb-3 border-2 border-slate-100">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-rotary-blue">${escapeHtml(l.position)}</span>
                    <h5 class="font-bold text-slate-900 text-sm mt-1">${escapeHtml(l.name)}</h5>
                    <span class="text-[11px] text-slate-400">Order: ${l.order_num}</span>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-center space-x-2 mt-4">
                    <button onclick="window.editAdminLeader('${l.id}')" class="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold hover:border-rotary-blue">
                        Edit
                    </button>
                    <button onclick="window.deleteAdminLeader('${l.id}')" class="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        window._adminLeadersCache = leaders;

    } catch (err) {
        console.error('Failed to load leaders:', err);
    }
}

window.editAdminLeader = (id) => {
    const leaders = window._adminLeadersCache || [];
    const l = leaders.find(item => item.id === id);
    if (!l) return;

    document.getElementById('leader-id').value = l.id;
    document.getElementById('leader-name').value = l.name;
    document.getElementById('leader-position').value = l.position;
    document.getElementById('leader-year').value = l.rotary_year;
    document.getElementById('leader-order').value = l.order_num;
    document.getElementById('leader-image').value = l.image || '';

    document.getElementById('leader-modal-title').textContent = 'Edit Officer';
    openModal('leader-modal');
};

window.deleteAdminLeader = async (id) => {
    if (!confirm('Remove this officer from the roster?')) return;
    try {
        await LeadersAPI.delete(id);
        showToast('Officer removed.', 'success');
        await loadAdminLeaders();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ==================== TAB 6: CONTACT INBOX ====================
async function loadAdminContacts(status = '') {
    const container = document.getElementById('admin-contacts-list');
    if (!container) return;

    try {
        const data = await ServicesAPI.getContacts(status);
        const contacts = data.contacts || [];

        if (contacts.length === 0) {
            container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">No inquiries matching filter.</div>`;
            return;
        }

        container.innerHTML = contacts.map(c => `
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 text-xs flex-1">
                    <div class="flex items-center space-x-2">
                        <span class="font-bold text-slate-900">${escapeHtml(c.name)}</span>
                        <span class="text-slate-400">&lt;${escapeHtml(c.email)}&gt;</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.status === 'NEW' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">${c.status}</span>
                    </div>
                    <p class="text-slate-700">${escapeHtml(c.message)}</p>
                    <span class="text-[11px] text-slate-400">${formatDate(c.created_at)}</span>
                </div>

                <div class="flex items-center space-x-2 shrink-0">
                    <button onclick="window.markContactStatus('${c.id}', 'READ')" class="px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50">
                        Mark Read
                    </button>
                    <button onclick="window.markContactStatus('${c.id}', 'REPLIED')" class="px-2.5 py-1 text-xs bg-rotary-blue text-white rounded-lg hover:bg-blue-900">
                        Mark Replied
                    </button>
                    <button onclick="window.deleteContactInquiry('${c.id}')" class="px-2 py-1 text-xs text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load contacts:', err);
    }
}

window.markContactStatus = async (id, status) => {
    try {
        await ServicesAPI.updateContactStatus(id, status);
        showToast(`Inquiry marked as ${status}.`, 'success');
        await loadAdminContacts();
        await loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.deleteContactInquiry = async (id) => {
    if (!confirm('Delete this inquiry?')) return;
    try {
        await ServicesAPI.deleteContact(id);
        showToast('Inquiry deleted.', 'success');
        await loadAdminContacts();
        await loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ==================== MODALS & FORM HANDLERS ====================
function initModals() {
    // Event Modal
    document.getElementById('btn-create-event')?.addEventListener('click', () => {
        document.getElementById('event-form').reset();
        document.getElementById('event-id').value = '';
        currentEventPhotos = [];
        renderEventPhotoPreviews();
        document.getElementById('event-modal-title').textContent = 'Create New Event & Gallery';
        openModal('event-modal');
    });
    document.getElementById('event-modal-close')?.addEventListener('click', () => closeModal('event-modal'));
    document.getElementById('event-cancel-btn')?.addEventListener('click', () => closeModal('event-modal'));

    // Project Modal
    document.getElementById('btn-create-project')?.addEventListener('click', () => {
        document.getElementById('project-form').reset();
        document.getElementById('project-id').value = '';
        resetProjectCoverUI();
        document.getElementById('project-modal-title').textContent = 'Add Community Project';
        openModal('project-modal');
    });
    document.getElementById('project-modal-close')?.addEventListener('click', () => {
        closeModal('project-modal');
        resetProjectCoverUI();
    });

    // Project Cover Upload UI Controls
    const projectDropzone = document.getElementById('project-upload-dropzone');
    const projectFileInput = document.getElementById('project-cover-file');
    const projectRemoveBtn = document.getElementById('project-remove-img-btn');
    const projectReplaceBtn = document.getElementById('project-replace-img-btn');
    const projectToggleUrlBtn = document.getElementById('project-toggle-url-btn');
    const projectManualUrlInput = document.getElementById('project-manual-url');

    projectDropzone?.addEventListener('click', () => projectFileInput?.click());
    projectReplaceBtn?.addEventListener('click', () => projectFileInput?.click());
    projectRemoveBtn?.addEventListener('click', () => resetProjectCoverUI());

    // Drag and Drop support on dropzone
    if (projectDropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            projectDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                projectDropzone.classList.add('border-rotary-blue', 'bg-blue-50/50');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            projectDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                projectDropzone.classList.remove('border-rotary-blue', 'bg-blue-50/50');
            });
        });
        projectDropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                handleProjectFileUpload(files[0]);
            }
        });
    }

    projectToggleUrlBtn?.addEventListener('click', () => {
        const container = document.getElementById('project-url-input-container');
        if (container) container.classList.toggle('hidden');
    });

    projectManualUrlInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
            setProjectCoverPreview(val, 'Custom URL', 'External Host');
        } else {
            resetProjectCoverUI();
        }
    });

    projectFileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleProjectFileUpload(file);
    });

    async function handleProjectFileUpload(file) {
        const progressContainer = document.getElementById('project-upload-progress-container');
        const progressBar = document.getElementById('project-upload-progress-bar');
        const progressPct = document.getElementById('project-upload-pct');
        const dropzone = document.getElementById('project-upload-dropzone');
        const previewCard = document.getElementById('project-preview-card');
        const previewImg = document.getElementById('project-preview-img');
        const filenameEl = document.getElementById('project-preview-filename');
        const filesizeEl = document.getElementById('project-preview-filesize');
        const badgeEl = document.getElementById('project-preview-badge');
        const coverInput = document.getElementById('project-cover');

        // Immediate visual feedback with local object URL
        const localPreviewUrl = URL.createObjectURL(file);
        if (previewImg) previewImg.src = localPreviewUrl;
        if (filenameEl) filenameEl.textContent = file.name;
        if (filesizeEl) filesizeEl.textContent = formatBytes(file.size);
        if (badgeEl) {
            badgeEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1 text-rotary-blue"></i><span class="text-rotary-blue font-bold">Uploading to Vercel Blob...</span>';
        }

        if (dropzone) dropzone.classList.add('hidden');
        if (previewCard) previewCard.classList.remove('hidden');
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressPct) progressPct.textContent = '0%';

        try {
            const uploadedUrl = await uploadProjectPhoto(file, (pct) => {
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressPct) progressPct.textContent = `${pct}%`;
            });

            if (coverInput) coverInput.value = uploadedUrl;
            if (previewImg) previewImg.src = uploadedUrl;
            if (badgeEl) {
                badgeEl.innerHTML = '<i class="fa-solid fa-circle-check mr-1 text-emerald-500"></i><span class="text-emerald-700 font-bold">Stored in Vercel Blob</span>';
            }
            if (progressContainer) progressContainer.classList.add('hidden');
            showToast('Cover photo uploaded to Vercel Blob!', 'success');
        } catch (err) {
            console.error('Project image upload failed:', err);
            if (coverInput) coverInput.value = '';
            if (badgeEl) {
                badgeEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1 text-rose-500"></i><span class="text-rose-700 font-bold">Upload failed</span>';
            }
            if (progressContainer) progressContainer.classList.add('hidden');
            showToast(`Upload failed: ${err.message}`, 'error');
        }
    }

    // Leader Modal
    document.getElementById('btn-create-leader')?.addEventListener('click', () => {
        document.getElementById('leader-form').reset();
        document.getElementById('leader-id').value = '';
        document.getElementById('leader-modal-title').textContent = 'Add Club Officer';
        openModal('leader-modal');
    });
    document.getElementById('leader-modal-close')?.addEventListener('click', () => closeModal('leader-modal'));

    // Review Modal
    document.getElementById('review-modal-close')?.addEventListener('click', () => closeModal('review-modal'));

    // Task Modal
    document.getElementById('btn-create-task')?.addEventListener('click', async () => {
        document.getElementById('task-form').reset();
        await Promise.all([
            loadActiveMembers(),
            populateTaskProjectDropdown()
        ]);
        openModal('task-modal');
    });
    document.getElementById('task-modal-close')?.addEventListener('click', () => closeModal('task-modal'));
    document.getElementById('task-modal-cancel')?.addEventListener('click', () => closeModal('task-modal'));

    // File Input for Multi-Photo Uploads directly to Vercel Blob
    document.getElementById('event-photo-file-input')?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const indicator = document.getElementById('upload-status-indicator');
        indicator.textContent = `Uploading ${files.length} photo(s)...`;

        for (const file of files) {
            try {
                const url = await uploadEventPhoto(file, (pct) => {
                    indicator.textContent = `Uploading ${file.name} (${pct}%)...`;
                });
                currentEventPhotos.push({
                    image_url: url,
                    caption: file.name.replace(/\.[^/.]+$/, '')
                });
                renderEventPhotoPreviews();
                showToast(`Uploaded ${file.name}`, 'success');
            } catch (err) {
                showToast(`Upload failed: ${err.message}`, 'error');
            }
        }
        indicator.textContent = `Upload complete.`;
        e.target.value = '';
    });

    // Event Form Submit
    document.getElementById('event-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('event-id').value;
        const btn = document.getElementById('event-save-btn');
        btn.disabled = true;

        const payload = {
            title: document.getElementById('event-title').value.trim(),
            description: document.getElementById('event-desc').value.trim(),
            event_date: document.getElementById('event-date').value,
            location: document.getElementById('event-location').value.trim(),
            category: document.getElementById('event-category').value,
            status: document.getElementById('event-status').value,
            is_published: document.getElementById('event-published').checked ? 1 : 0,
            photos: currentEventPhotos.map(p => p.image_url)
        };

        try {
            if (id) {
                await EventsAPI.update(id, payload);
                showToast('Event updated successfully.', 'success');
            } else {
                await EventsAPI.create(payload);
                showToast('Event created successfully.', 'success');
            }
            closeModal('event-modal');
            await loadAdminEvents();
            await loadAdminStats();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    // Project Form Submit
    document.getElementById('project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('project-id').value;
        const payload = {
            title: document.getElementById('project-title').value.trim(),
            category: document.getElementById('project-category').value,
            cover_image: document.getElementById('project-cover').value.trim() || null,
            description: document.getElementById('project-desc').value.trim()
        };

        try {
            if (id) {
                await ProjectsAPI.update(id, payload);
                showToast('Project updated.', 'success');
            } else {
                await ProjectsAPI.create(payload);
                showToast('Project added.', 'success');
            }
            closeModal('project-modal');
            resetProjectCoverUI();
            await loadAdminProjects();
            await loadAdminStats();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Leader Form Submit
    document.getElementById('leader-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('leader-id').value;
        const payload = {
            name: document.getElementById('leader-name').value.trim(),
            position: document.getElementById('leader-position').value.trim(),
            rotary_year: document.getElementById('leader-year').value.trim(),
            order_num: parseInt(document.getElementById('leader-order').value, 10) || 1,
            image: document.getElementById('leader-image').value.trim() || null
        };

        try {
            if (id) {
                await LeadersAPI.update(id, payload);
                showToast('Officer updated.', 'success');
            } else {
                await LeadersAPI.create(payload);
                showToast('Officer added.', 'success');
            }
            closeModal('leader-modal');
            await loadAdminLeaders();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Review Form Submit (Atomic Approval / Rejection)
    document.getElementById('review-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const appId = document.getElementById('review-app-id').value;
        const status = document.getElementById('review-status').value;
        const review_notes = document.getElementById('review-notes').value.trim();

        try {
            const res = await MembershipAPI.reviewApplication(appId, status, review_notes);
            showToast(res.message || `Application ${status.toLowerCase()}.`, 'success');
            closeModal('review-modal');
            await loadAdminMemberships();
            await loadAdminStats();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Task Form Submit
    document.getElementById('task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('task-save-btn');
        const userId = document.getElementById('task-user-id')?.value;
        const projectId = document.getElementById('task-project-id')?.value;
        const dueDate = document.getElementById('task-due-date')?.value || undefined;

        if (!userId) {
            showToast('Please select an active member.', 'error');
            return;
        }

        if (!projectId) {
            if (cachedProjectsForTasks.length === 0) {
                showToast('No projects available. Please create a project first.', 'error');
            } else {
                showToast('Please select a project for this task.', 'error');
            }
            return;
        }

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span>Assigning...</span>`;

        const payload = {
            user_id: userId,
            project_id: projectId,
            due_date: dueDate
        };

        try {
            const res = await MembershipAPI.createTask(payload);
            showToast(res.message || 'Task assigned successfully.', 'success');
            closeModal('task-modal');
            document.getElementById('task-form').reset();
            await loadAdminTasks();
        } catch (err) {
            showToast(err.message || 'Failed to assign task.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-check mr-1.5"></i><span>Assign Task</span>`;
        }
    });
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

