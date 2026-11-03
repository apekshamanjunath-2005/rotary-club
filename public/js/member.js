/**
 * Rotary Club of Honavar - Member Portal Application Logic
 * Pure ES6+ JavaScript
 */

import { AuthStorage, showToast, AuthAPI, MembershipAPI, ServicesAPI } from './api.js';

let allTasks = [];
let currentTaskFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard check: verify authentication
    if (!AuthStorage.isAuthenticated()) {
        window.location.href = '/index.html?session=required';
        return;
    }

    initNavbar();
    await loadUserProfile();
});

function initNavbar() {
    const handleLogout = () => {
        AuthStorage.clear();
        showToast('You have signed out.', 'info');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 300);
    };

    document.getElementById('member-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('status-logout-btn')?.addEventListener('click', handleLogout);

    // Task filter tab clicks
    document.getElementById('task-filter-all')?.addEventListener('click', () => setTaskFilter('all'));
    document.getElementById('task-filter-pending')?.addEventListener('click', () => setTaskFilter('pending'));
    document.getElementById('task-filter-completed')?.addEventListener('click', () => setTaskFilter('completed'));
}

async function loadUserProfile() {
    try {
        const data = await AuthAPI.getMe();
        const user = data.user;
        if (!user) throw new Error('User profile not available.');

        // Update stored profile with fresh backend state
        AuthStorage.setUser(user);

        // Hide loading indicator
        const loadingView = document.getElementById('member-loading-view');
        if (loadingView) loadingView.classList.add('hidden');

        // Update header user displays
        const nameDisplay = document.getElementById('member-name-display');
        const welcomeName = document.getElementById('welcome-member-name');
        const roleBadge = document.getElementById('member-role-badge');

        if (nameDisplay) nameDisplay.textContent = user.name;
        if (welcomeName) welcomeName.textContent = user.name;

        // Authorization State Check directly from fresh backend profile
        const role = (user.role || '').toUpperCase();
        const appStatus = (user.application_status || (user.application && user.application.status) || '').toUpperCase();

        const isApproved = role === 'MEMBER' || role === 'ADMIN';
        const isRejected = !isApproved && appStatus === 'REJECTED';

        if (roleBadge) {
            roleBadge.classList.remove('hidden');
            if (isApproved) {
                roleBadge.textContent = role === 'ADMIN' ? 'ADMIN' : 'ACTIVE MEMBER';
                roleBadge.className = 'px-2 py-0.5 rounded-full font-bold bg-blue-100 text-rotary-blue text-[10px]';
            } else if (isRejected) {
                roleBadge.textContent = 'APPLICATION REJECTED';
                roleBadge.className = 'px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 text-[10px]';
            } else {
                roleBadge.textContent = 'PENDING REVIEW';
                roleBadge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 text-[10px]';
            }
        }

        const activeView = document.getElementById('member-active-view');
        const statusView = document.getElementById('member-status-view');

        if (isApproved) {
            // APPROVED MEMBER VIEW
            if (activeView) activeView.classList.remove('hidden');
            if (statusView) statusView.classList.add('hidden');

            updateMembershipCountdown(user.membership_end_date);
            await loadMemberTasks();
            await loadAssignedServiceRequests();
        } else {
            // PENDING APPLICANT OR REJECTED VIEW
            if (activeView) activeView.classList.add('hidden');
            renderStatusView(user);
            if (statusView) statusView.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Failed to load profile:', err);
        const loadingView = document.getElementById('member-loading-view');
        if (loadingView) loadingView.classList.add('hidden');

        // Only redirect if genuinely an authentication/session expiration (401)
        if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('session') || err.message.toLowerCase().includes('token'))) {
            showToast('Session expired. Please log in again.', 'error');
            AuthStorage.clear();
            setTimeout(() => {
                window.location.href = '/index.html?session=expired';
            }, 400);
        } else {
            showToast(err.message || 'Error loading profile.', 'error');
        }
    }
}

/**
 * Render Status Card for Pending or Rejected Applicants
 */
function renderStatusView(user) {
    const role = (user.role || '').toUpperCase();
    const appStatus = (user.application_status || (user.application && user.application.status) || '').toUpperCase();
    const isApproved = role === 'MEMBER' || role === 'ADMIN';
    const isRejected = !isApproved && appStatus === 'REJECTED';
    const app = user.application || {};

    const iconContainer = document.getElementById('status-icon-container');
    const icon = document.getElementById('status-icon');
    const badge = document.getElementById('status-badge');
    const heading = document.getElementById('status-heading');
    const messageBox = document.getElementById('status-message-box');
    const notesCard = document.getElementById('status-notes-card');
    const notesTitle = document.getElementById('status-notes-title');
    const notesContent = document.getElementById('status-notes-content');

    const applicantName = document.getElementById('status-applicant-name');
    const applicantEmail = document.getElementById('status-applicant-email');
    const submittedDate = document.getElementById('status-submitted-date');

    if (applicantName) applicantName.textContent = user.name || '--';
    if (applicantEmail) applicantEmail.textContent = user.email || '--';
    if (submittedDate) submittedDate.textContent = formatDate(app.created_at || user.created_at);

    if (isRejected) {
        // REJECTED STATE
        if (iconContainer) iconContainer.className = 'w-20 h-20 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl shadow-inner border border-rose-200';
        if (icon) icon.className = 'fa-solid fa-circle-xmark';
        if (badge) {
            badge.className = 'inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200';
            badge.innerHTML = `<i class="fa-solid fa-xmark mr-1"></i><span>APPLICATION REJECTED</span>`;
        }
        if (heading) heading.textContent = 'Sorry, Your Membership Application Has Been Rejected';
        if (messageBox) {
            messageBox.innerHTML = `
                <p>We are sorry to inform you that your membership application to Rotary Club of Honavar has not been approved by our club administration.</p>
                <p>Thank you for your interest in joining us and for taking the time to apply. We sincerely appreciate your willingness to serve the community.</p>
            `;
        }

        // Dedicated Card for Admin Review Message / Notes
        if (notesCard) {
            notesCard.className = 'text-left p-5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2 max-w-xl mx-auto shadow-sm';
            notesCard.classList.remove('hidden');

            if (notesTitle) {
                notesTitle.className = 'font-bold text-rose-900 block text-xs uppercase tracking-wider flex items-center gap-1.5';
                notesTitle.innerHTML = `<i class="fa-solid fa-comment-dots text-rose-600"></i><span>Message from Club Administration</span>`;
            }

            if (notesContent) {
                const rawNotes = app.review_notes || user.review_notes || '';
                const notes = (typeof rawNotes === 'string') ? rawNotes.trim() : '';
                if (notes) {
                    notesContent.className = 'text-slate-800 text-sm leading-relaxed whitespace-pre-line bg-white/80 p-3.5 rounded-xl border border-rose-100 font-normal';
                    notesContent.textContent = notes;
                } else {
                    notesContent.className = 'text-slate-500 italic text-xs';
                    notesContent.textContent = 'No additional comments were provided by the administration.';
                }
            }
        }

    } else {
        // PENDING STATE (DEFAULT)
        if (iconContainer) iconContainer.className = 'w-20 h-20 mx-auto rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-3xl shadow-inner border border-amber-200';
        if (icon) icon.className = 'fa-solid fa-hourglass-half animate-pulse';
        if (badge) {
            badge.className = 'inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200';
            badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span><span>PENDING REVIEW</span>`;
        }
        if (heading) heading.textContent = 'Membership Application Under Review';
        if (messageBox) {
            messageBox.innerHTML = `
                <p>Thank you for your interest in joining Rotary Club of Honavar!</p>
                <p>Your membership application has been successfully submitted and is currently under review by our club administration.</p>
                <p>We will notify you once your application has been reviewed and approved.</p>
                <p class="font-medium text-rotary-blue">Thank you for your patience and interest in serving the community!</p>
            `;
        }
        // Do not display rejection information
        if (notesCard) notesCard.classList.add('hidden');
    }
}

function updateMembershipCountdown(endDateStr) {
    const daysElem = document.getElementById('countdown-days');
    const dateDisplay = document.getElementById('membership-end-date-display');
    const progressBar = document.getElementById('membership-progress-bar');

    if (!endDateStr) {
        if (daysElem) daysElem.textContent = '365';
        if (dateDisplay) dateDisplay.textContent = 'Active Term';
        return;
    }

    try {
        const targetDate = new Date(endDateStr);
        const today = new Date();
        const diffTime = targetDate - today;
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        if (daysElem) daysElem.textContent = diffDays;
        if (dateDisplay) {
            dateDisplay.textContent = targetDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }

        // Calculate percentage (365 days base)
        const pct = Math.min(100, Math.max(5, Math.round((diffDays / 365) * 100)));
        if (progressBar) progressBar.style.width = `${pct}%`;

    } catch {
        if (daysElem) daysElem.textContent = '--';
    }
}

async function loadMemberTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    try {
        const res = await MembershipAPI.getMyTasks();
        allTasks = res.tasks || [];
        renderTasks();
    } catch (err) {
        console.error('Failed to load tasks:', err);
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">Failed to load assigned tasks.</div>`;
    }
}

function setTaskFilter(filter) {
    currentTaskFilter = filter;
    const btnAll = document.getElementById('task-filter-all');
    const btnPending = document.getElementById('task-filter-pending');
    const btnCompleted = document.getElementById('task-filter-completed');

    const activeClass = 'px-3.5 py-1.5 rounded-full bg-rotary-blue text-white transition';
    const inactiveClass = 'px-3.5 py-1.5 rounded-full text-slate-600 hover:text-rotary-blue transition';

    if (btnAll) btnAll.className = filter === 'all' ? activeClass : inactiveClass;
    if (btnPending) btnPending.className = filter === 'pending' ? activeClass : inactiveClass;
    if (btnCompleted) btnCompleted.className = filter === 'completed' ? activeClass : inactiveClass;

    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    let filtered = allTasks;
    if (currentTaskFilter === 'pending') {
        filtered = allTasks.filter(t => t.completed === 0);
    } else if (currentTaskFilter === 'completed') {
        filtered = allTasks.filter(t => t.completed === 1);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                <i class="fa-solid fa-list-check text-2xl text-slate-300 mb-2 block"></i>
                No tasks matching the selected filter.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(task => {
        const isDone = task.completed === 1;
        return `
            <div class="p-4 rounded-2xl border transition duration-200 flex items-start justify-between space-x-3 ${isDone ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 shadow-sm hover:border-rotary-azure'}">
                <div class="flex items-start space-x-3 flex-1">
                    <input type="checkbox" ${isDone ? 'checked' : ''}
                           class="mt-1 h-5 w-5 rounded border-slate-300 text-rotary-blue focus:ring-rotary-azure cursor-pointer"
                           onchange="window.toggleTaskItem('${task.id}')">
                    <div class="space-y-1 flex-1">
                        <h4 class="text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}">
                            ${escapeHtml(task.title)}
                        </h4>
                        <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-medium">
                            ${task.project_title ? `
                                <span class="px-2 py-0.5 rounded-full bg-blue-50 text-rotary-blue font-semibold">
                                    <i class="fa-solid fa-folder-open mr-1"></i>${escapeHtml(task.project_title)}
                                </span>
                            ` : ''}
                            ${task.due_date ? `
                                <span><i class="fa-solid fa-clock mr-1"></i>Due: ${task.due_date}</span>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                    ${isDone ? 'Done' : 'Pending'}
                </span>
            </div>
        `;
    }).join('');
}

window.toggleTaskItem = async (taskId) => {
    try {
        const res = await MembershipAPI.toggleTask(taskId);
        const updated = res.task;
        allTasks = allTasks.map(t => (t.id === taskId ? updated : t));
        renderTasks();
        showToast(res.message || 'Task updated.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        await loadMemberTasks();
    }
};

async function loadAssignedServiceRequests() {
    const container = document.getElementById('assigned-sr-container');
    const countBadge = document.getElementById('assigned-sr-count');
    const user = AuthStorage.getUser();
    if (!user || !container) return;

    try {
        const data = await ServicesAPI.getAllRequests(null, user.id);
        const requests = data.requests || [];

        if (countBadge) countBadge.textContent = `${requests.length} Requests`;

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                    No community service requests are currently assigned to you for inspection.
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(req => `
            <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 text-xs">
                    <div class="flex items-center space-x-2">
                        <span class="font-mono font-bold text-rotary-blue tracking-wide">${escapeHtml(req.tracking_code)}</span>
                        <span class="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-sky-100 text-sky-800">${req.status}</span>
                    </div>
                    <p class="text-slate-800 font-medium">${escapeHtml(req.issue_description)}</p>
                    <span class="text-slate-400"><i class="fa-solid fa-location-dot mr-1 text-rotary-azure"></i>${escapeHtml(req.location)}</span>
                </div>
                <div class="text-[11px] text-slate-400 sm:text-right">
                    Sub: ${escapeHtml(req.submitter_name)}
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load assigned requests:', err);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
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

