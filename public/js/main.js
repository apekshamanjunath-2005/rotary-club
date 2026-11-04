/**
 * Rotary Club of Honavar - Public Website Frontend Application Logic
 * Pure ES6+ JavaScript
 */

import {
    AuthStorage,
    showToast,
    AuthAPI,
    EventsAPI,
    ProjectsAPI,
    LeadersAPI,
    ServicesAPI,
    MembershipAPI
} from './api.js';

// ==================== GLOBAL LIGHTBOX STATE ====================
let currentPhotos = [];
let currentPhotoIndex = 0;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initModals();
    initLightbox();
    initForms();

    // Load dynamic data from APIs
    loadLeaders();
    loadProjects();
    loadEvents();
});

// ==================== NAVBAR & SESSION STATE ====================
function initNavbar() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Close mobile menu on clicking any navigation link
        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    renderNavAuth();
}

function renderNavAuth() {
    const desktopContainer = document.getElementById('nav-auth-container');
    const mobileContainer = document.getElementById('mobile-auth-container');
    const footerMemberLink = document.getElementById('footer-member-link');

    const isAuthenticated = AuthStorage.isAuthenticated();
    const user = AuthStorage.getUser();

    if (isAuthenticated && user) {
        const portalUrl = user.role === 'ADMIN' ? '/admin.html' : '/member.html';
        const isRejected = (user.application_status === 'REJECTED') || (user.application && user.application.status === 'REJECTED');
        const portalLabel = user.role === 'ADMIN' ? 'Admin Center' : (user.role === 'PENDING' ? 'Application Status' : 'Member Portal');
        const roleBadge = user.role === 'ADMIN'
            ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 ml-1">ADMIN</span>'
            : (isRejected
                ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 ml-1">REJECTED</span>'
                : (user.role === 'PENDING'
                    ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 ml-1">PENDING</span>'
                    : '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 ml-1">MEMBER</span>'));

        const authHtml = `
            <div class="flex items-center space-x-2">
                <a href="${portalUrl}" class="px-3.5 py-1.5 text-xs font-bold rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200 transition border border-slate-300 flex items-center">
                    <i class="fa-solid fa-user-circle mr-1.5 text-rotary-blue"></i>
                    <span>${escapeHtml(user.name.split(' ')[0])}</span>
                    ${roleBadge}
                </a>
                <button id="logout-btn" title="Sign out" class="px-2.5 py-1.5 text-xs font-semibold rounded-full text-slate-500 hover:text-rose-600 transition">
                    <i class="fa-solid fa-power-off"></i>
                </button>
            </div>
        `;

        const mobileAuthHtml = `
            <div class="space-y-2">
                <a href="${portalUrl}" class="block w-full py-2.5 text-center font-bold rounded-lg bg-rotary-blue text-white text-sm">
                    <i class="fa-solid fa-gauge-high mr-1.5"></i> Open ${portalLabel}
                </a>
                <button id="mobile-logout-btn" class="w-full py-2 text-center text-xs font-semibold rounded-lg text-rose-600 border border-rose-200">
                    Sign Out (${escapeHtml(user.email)})
                </button>
            </div>
        `;

        if (desktopContainer) desktopContainer.innerHTML = authHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileAuthHtml;
        if (footerMemberLink) footerMemberLink.setAttribute('href', portalUrl);

        // Attach logout handlers
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

        // Hide password field in membership modal since user is logged in
        const passwordGroup = document.getElementById('m-password-group');
        if (passwordGroup) passwordGroup.classList.add('hidden');

    } else {
        if (footerMemberLink) {
            footerMemberLink.addEventListener('click', (e) => {
                e.preventDefault();
                openModal('login-modal');
            });
        }
    }
}

function handleLogout() {
    AuthStorage.clear();
    showToast('You have signed out successfully.', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 400);
}

// ==================== MODALS MANAGEMENT ====================
function initModals() {
    // Open Membership Modal triggers
    document.getElementById('open-apply-btn')?.addEventListener('click', () => openModal('membership-modal'));
    document.getElementById('mobile-apply-btn')?.addEventListener('click', () => openModal('membership-modal'));
    document.getElementById('membership-modal-close')?.addEventListener('click', () => closeModal('membership-modal'));

    // Open Login Modal triggers
    document.getElementById('open-login-btn')?.addEventListener('click', () => openModal('login-modal'));
    document.getElementById('mobile-login-btn')?.addEventListener('click', () => openModal('login-modal'));
    document.getElementById('login-modal-close')?.addEventListener('click', () => closeModal('login-modal'));

    // Close modals on clicking backdrop
    window.addEventListener('click', (e) => {
        if (e.target.id === 'membership-modal') closeModal('membership-modal');
        if (e.target.id === 'login-modal') closeModal('login-modal');
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal('membership-modal');
            closeModal('login-modal');
            closeLightbox();
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// ==================== DYNAMIC LEADERSHIP SECTION ====================
async function loadLeaders() {
    const container = document.getElementById('leaders-container');
    if (!container) return;

    try {
        const data = await LeadersAPI.getAll();
        const leaders = data.leaders || [];

        if (leaders.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-8 text-center text-slate-400 text-sm">
                    Leadership roster information will be updated shortly.
                </div>
            `;
            return;
        }

        container.innerHTML = leaders.map(leader => {
            const fallbackImg = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`;
            const imageSrc = leader.image || fallbackImg;

            return `
                <div class="bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-sm hover:shadow-md hover:border-rotary-azure transition duration-300">
                    <div class="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-slate-100 shadow-inner">
                        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(leader.name)}"
                             class="w-full h-full object-cover"
                             onerror="this.src='${fallbackImg}'">
                    </div>
                    <span class="inline-block px-3 py-1 rounded-full bg-blue-50 text-rotary-blue text-[11px] font-bold tracking-wider uppercase mb-2">
                        ${escapeHtml(leader.position)}
                    </span>
                    <h4 class="font-extrabold text-slate-900 text-base font-heading">${escapeHtml(leader.name)}</h4>
                    <span class="text-xs text-slate-400 font-medium block mt-1">Rotary Year ${escapeHtml(leader.rotary_year)}</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load leaders:', err);
        container.innerHTML = `<div class="col-span-full py-6 text-center text-rose-500 text-xs">Failed to load leadership team.</div>`;
    }
}

// ==================== DYNAMIC PROJECTS SECTION ====================
async function loadProjects(category = '') {
    const container = document.getElementById('projects-container');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 text-sm">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading community projects...
        </div>
    `;

    try {
        const data = await ProjectsAPI.getAll(category);
        const projects = data.projects || [];

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400 text-sm">
                    No initiatives found for this category.
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => {
            const isOngoing = project.category === 'ongoing';
            const badgeClass = isOngoing
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-200';
            const badgeText = isOngoing ? 'Ongoing Initiative' : 'Past Impact';
            const fallbackCover = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80';
            const coverImage = project.cover_image || fallbackCover;

            return `
                <article class="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition duration-300 flex flex-col">
                    <div class="relative h-52 overflow-hidden bg-slate-100">
                        <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(project.title)}"
                             class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                             onerror="this.src='${fallbackCover}'">
                        <span class="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold shadow-md ${badgeClass}">
                            ${badgeText}
                        </span>
                    </div>

                    <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                            <h3 class="text-xl font-bold font-heading text-slate-900 leading-snug">
                                ${escapeHtml(project.title)}
                            </h3>
                            <p class="text-slate-600 text-xs mt-2 leading-relaxed line-clamp-3">
                                ${escapeHtml(project.description)}
                            </p>
                        </div>

                        <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                            <span><i class="fa-solid fa-calendar mr-1.5 text-rotary-azure"></i>${formatDate(project.date)}</span>
                            <span class="text-rotary-blue font-semibold"><i class="fa-solid fa-location-dot mr-1"></i>Honavar</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load projects:', err);
        container.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500 text-xs">Failed to load projects.</div>`;
    }

    // Attach Tab Event Handlers
    document.querySelectorAll('.project-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.project-tab').forEach(t => {
                t.className = 'project-tab px-5 py-2 rounded-full transition text-slate-600 hover:text-rotary-blue';
            });
            tab.className = 'project-tab px-5 py-2 rounded-full transition bg-rotary-blue text-white shadow-sm';
            loadProjects(tab.dataset.category);
        };
    });
}

// ==================== DYNAMIC EVENTS & PHOTO GALLERY ====================
async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;

    try {
        const data = await EventsAPI.getAll();
        const events = data.events || [];

        if (events.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400 text-sm">
                    No public gallery events to display.
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(event => {
            const photos = event.photos || [];
            const photoCount = photos.length;

            // Thumbnail previews (first 3)
            const thumbnailsHtml = photos.slice(0, 3).map((photo, pIdx) => `
                <div class="gallery-thumbnail relative h-16 rounded-xl overflow-hidden cursor-pointer border border-slate-200"
                     onclick="window.openEventGallery('${escapeHtml(event.id)}', ${pIdx})">
                    <img src="${escapeHtml(photo.image_url)}" alt="${escapeHtml(photo.caption || event.title)}"
                         class="w-full h-full object-cover">
                    ${pIdx === 2 && photoCount > 3 ? `
                        <div class="absolute inset-0 bg-black/60 text-white flex items-center justify-center font-bold text-xs">
                            +${photoCount - 3}
                        </div>
                    ` : ''}
                </div>
            `).join('');

            return `
                <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-50 text-rotary-blue">
                                ${escapeHtml(event.category || 'Event')}
                            </span>
                            <span class="text-xs font-semibold text-slate-400">
                                <i class="fa-solid fa-camera mr-1 text-rotary-azure"></i>${photoCount} Photo${photoCount === 1 ? '' : 's'}
                            </span>
                        </div>

                        <h3 class="text-xl font-bold font-heading text-slate-900 leading-snug">
                            ${escapeHtml(event.title)}
                        </h3>

                        <p class="text-slate-600 text-xs leading-relaxed line-clamp-3">
                            ${escapeHtml(event.description || '')}
                        </p>

                        <!-- Thumbnail Grid -->
                        ${photoCount > 0 ? `
                            <div class="grid grid-cols-3 gap-2 pt-2">
                                ${thumbnailsHtml}
                            </div>
                        ` : ''}
                    </div>

                    <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span><i class="fa-solid fa-calendar mr-1.5 text-rotary-azure"></i>${formatDate(event.event_date)}</span>
                        <span><i class="fa-solid fa-location-dot mr-1 text-rotary-azure"></i>${escapeHtml(event.location || 'Honavar')}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Store events in window for lightbox click delegation
        window._eventsCache = events;

    } catch (err) {
        console.error('Failed to load events:', err);
        container.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500 text-xs">Failed to load events.</div>`;
    }
}

// Lightbox opener attached to window
window.openEventGallery = (eventId, photoIndex = 0) => {
    const events = window._eventsCache || [];
    const event = events.find(e => e.id === eventId);
    if (!event || !event.photos || event.photos.length === 0) return;

    currentPhotos = event.photos;
    currentPhotoIndex = photoIndex;
    updateLightbox();
    openLightboxModal();
};

// ==================== INTERACTIVE LIGHTBOX CONTROLS ====================
function initLightbox() {
    document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev')?.addEventListener('click', prevPhoto);
    document.getElementById('lightbox-next')?.addEventListener('click', nextPhoto);

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('lightbox-modal');
        if (modal && !modal.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') prevPhoto();
            if (e.key === 'ArrowRight') nextPhoto();
        }
    });
}

function openLightboxModal() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function updateLightbox() {
    if (currentPhotos.length === 0) return;
    const photo = currentPhotos[currentPhotoIndex];

    const imgElem = document.getElementById('lightbox-img');
    const captionElem = document.getElementById('lightbox-caption');
    const counterElem = document.getElementById('lightbox-counter');

    if (imgElem) imgElem.src = photo.image_url;
    if (captionElem) captionElem.textContent = photo.caption || '';
    if (counterElem) counterElem.textContent = `Photo ${currentPhotoIndex + 1} of ${currentPhotos.length}`;
}

function nextPhoto() {
    if (currentPhotos.length === 0) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotos.length;
    updateLightbox();
}

function prevPhoto() {
    if (currentPhotos.length === 0) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
    updateLightbox();
}

// ==================== FORM HANDLERS ====================
function initForms() {
    // 1. Service Request Submission
    const srForm = document.getElementById('service-request-form');
    if (srForm) {
        srForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('sr-submit-btn');
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Registering...`;

            try {
                const payload = {
                    submitter_name: document.getElementById('sr-name').value.trim(),
                    submitter_email: document.getElementById('sr-email').value.trim(),
                    submitter_phone: document.getElementById('sr-phone').value.trim() || null,
                    location: document.getElementById('sr-location').value.trim(),
                    issue_description: document.getElementById('sr-description').value.trim()
                };

                const res = await ServicesAPI.createRequest(payload);
                srForm.reset();

                // Show success card
                const successCard = document.getElementById('sr-success-card');
                const codeElem = document.getElementById('sr-generated-code');
                if (successCard && codeElem) {
                    codeElem.textContent = res.tracking_code;
                    successCard.classList.remove('hidden');
                }

                showToast('Service request submitted successfully!', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Submit Service Request`;
            }
        });
    }

    // 2. Real-time Tracking Code Lookup
    const trackForm = document.getElementById('track-lookup-form');
    if (trackForm) {
        trackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const codeInput = document.getElementById('track-input-code');
            const code = codeInput.value.trim().toUpperCase();
            if (!code) return;

            const resultContainer = document.getElementById('track-result-container');
            const statusPill = document.getElementById('track-status-pill');
            const locElem = document.getElementById('track-location');
            const descElem = document.getElementById('track-description');
            const notesBox = document.getElementById('track-notes-box');
            const notesElem = document.getElementById('track-admin-notes');

            try {
                const res = await ServicesAPI.trackRequest(code);
                const req = res.request;

                if (resultContainer) resultContainer.classList.remove('hidden');
                if (locElem) locElem.textContent = req.location;
                if (descElem) descElem.textContent = `"${req.issue_description}"`;

                // Set status pill styling
                const statusStyles = {
                    'NEW': 'bg-sky-500/20 text-sky-400',
                    'UNDER_REVIEW': 'bg-amber-500/20 text-amber-400',
                    'ACTION_TAKEN': 'bg-blue-500/20 text-blue-400',
                    'COMPLETED': 'bg-emerald-500/20 text-emerald-400',
                    'REJECTED': 'bg-rose-500/20 text-rose-400'
                };
                if (statusPill) {
                    statusPill.className = `px-2.5 py-1 rounded-full font-bold uppercase text-[11px] ${statusStyles[req.status] || 'bg-slate-700 text-slate-300'}`;
                    statusPill.textContent = req.status.replace('_', ' ');
                }

                if (req.admin_notes && notesBox && notesElem) {
                    notesElem.textContent = req.admin_notes;
                    notesBox.classList.remove('hidden');
                } else if (notesBox) {
                    notesBox.classList.add('hidden');
                }

                showToast(`Request found: ${req.status}`, 'info');

            } catch (err) {
                if (resultContainer) resultContainer.classList.add('hidden');
                showToast(err.message || 'Tracking code not found.', 'error');
            }
        });
    }

    // 3. Enhanced Membership Application Form
    const mForm = document.getElementById('membership-form');
    if (mForm) {
        mForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errBanner = document.getElementById('membership-error');
            errBanner.classList.add('hidden');

            const age = parseInt(document.getElementById('m-age').value, 10);
            if (isNaN(age) || age < 18) {
                errBanner.textContent = 'Applicants must be at least 18 years of age to be eligible for club membership.';
                errBanner.classList.remove('hidden');
                return;
            }

            const taskWillingness = document.getElementById('m-task-willingness').checked;
            if (!taskWillingness) {
                errBanner.textContent = 'You must agree to accept and complete tasks assigned by the club.';
                errBanner.classList.remove('hidden');
                return;
            }

            const btn = document.getElementById('m-submit-btn');
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Submitting Application...`;

            try {
                const payload = {
                    name: document.getElementById('m-name').value.trim(),
                    email: document.getElementById('m-email').value.trim(),
                    age,
                    phone: document.getElementById('m-phone').value.trim() || 'N/A',
                    profession: document.getElementById('m-profession').value.trim(),
                    motivation_message: document.getElementById('m-reason').value.trim(),
                    community_interests: document.getElementById('m-interests').value.trim(),
                    skills_experience: document.getElementById('m-skills').value.trim(),
                    time_commitment: document.getElementById('m-time').value.trim(),
                    task_willingness: 'Yes',
                    service_areas: document.getElementById('m-service-areas').value.trim()
                };

                // Include password if user is unauthenticated
                if (!AuthStorage.isAuthenticated()) {
                    const passInput = document.getElementById('m-password');
                    if (passInput && passInput.value) {
                        payload.password = passInput.value;
                    }
                }

                const res = await MembershipAPI.apply(payload);

                // If new account token returned, save and authenticate
                if (res.token) {
                    AuthStorage.setToken(res.token);
                    const meRes = await AuthAPI.getMe().catch(() => null);
                    if (meRes?.user) AuthStorage.setUser(meRes.user);
                }

                mForm.reset();
                closeModal('membership-modal');
                renderNavAuth();
                showToast('Membership application submitted successfully!', 'success');

            } catch (err) {
                errBanner.textContent = err.message || 'Failed to submit application.';
                errBanner.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-file-signature mr-1.5"></i> Submit Membership Application`;
            }
        });
    }

    // 4. Contact Inquiries Form
    const cntForm = document.getElementById('contact-form');
    if (cntForm) {
        cntForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('cnt-submit-btn');
            btn.disabled = true;

            try {
                const payload = {
                    name: document.getElementById('cnt-name').value.trim(),
                    email: document.getElementById('cnt-email').value.trim(),
                    message: document.getElementById('cnt-message').value.trim()
                };

                await ServicesAPI.submitContact(payload);
                cntForm.reset();
                showToast('Thank you! Your message has been sent to the club.', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    // 5. Member / Admin Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errBanner = document.getElementById('login-error');
            errBanner.classList.add('hidden');

            const btn = document.getElementById('login-submit-btn');
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Authenticating...`;

            try {
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                const res = await AuthAPI.login(email, password);
                AuthStorage.setToken(res.token);
                AuthStorage.setUser(res.user);

                showToast(`Welcome back, ${res.user.name}!`, 'success');
                closeModal('login-modal');
                renderNavAuth();

                // If admin, auto-redirect to admin command center; otherwise member portal
                if (res.user.role === 'ADMIN') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/member.html';
                }

            } catch (err) {
                errBanner.textContent = err.message || 'Login failed. Please check your credentials.';
                errBanner.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `Sign In`;
            }
        });
    }
}

// ==================== HELPER UTILITIES ====================
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

