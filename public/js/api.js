/**
 * Rotary Club of Honavar - Unified API Client
 * Pure Vanilla JavaScript (ES6+)
 */

const API_BASE = '/api';

// Token Management
export const AuthStorage = {
    getToken: () => localStorage.getItem('rotary_token'),
    setToken: (token) => localStorage.setItem('rotary_token', token),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('rotary_user'));
        } catch {
            return null;
        }
    },
    setUser: (user) => localStorage.setItem('rotary_user', JSON.stringify(user)),
    clear: () => {
        localStorage.removeItem('rotary_token');
        localStorage.removeItem('rotary_user');
    },
    isAuthenticated: () => !!localStorage.getItem('rotary_token'),
    isAdmin: () => {
        const user = AuthStorage.getUser();
        return user && user.role === 'ADMIN';
    },
    isMember: () => {
        const user = AuthStorage.getUser();
        return user && (user.role === 'MEMBER' || user.role === 'ADMIN');
    }
};

/**
 * Core HTTP Request Wrapper
 */
export async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = AuthStorage.getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        cache: 'no-store',
        ...options,
        headers
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            // Handle session expiration
            if (response.status === 401 && !endpoint.includes('/auth/login')) {
                AuthStorage.clear();
                if (window.location.pathname.includes('admin') || window.location.pathname.includes('member')) {
                    window.location.href = '/index.html?session=expired';
                }
            }
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        return data;
    } catch (err) {
        console.error(`API Error [${config.method || 'GET'} ${endpoint}]:`, err.message);
        throw err;
    }
}

// ==================== SERVICE APIS ====================

// 1. Authentication
export const AuthAPI = {
    login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
    register: (userData) => apiFetch('/auth/register', { method: 'POST', body: userData }),
    getMe: () => apiFetch(`/auth/me?_t=${Date.now()}`, { cache: 'no-store' })
};

// 2. Events & Photos
export const EventsAPI = {
    getAll: () => apiFetch('/events'),
    getById: (id) => apiFetch(`/events/${id}`),
    adminGetAll: () => apiFetch('/events/admin/all'),
    adminGetById: (id) => apiFetch(`/events/admin/${id}`),
    create: (eventData) => apiFetch('/events', { method: 'POST', body: eventData }),
    update: (id, eventData) => apiFetch(`/events/${id}`, { method: 'PUT', body: eventData }),
    delete: (id) => apiFetch(`/events/${id}`, { method: 'DELETE' }),
    deletePhoto: (photoId) => apiFetch(`/events/photos/${photoId}`, { method: 'DELETE' }),
    deleteUnusedBlob: (url) => apiFetch('/events/blob', { method: 'DELETE', body: { url } })
};

// 3. Projects
export const ProjectsAPI = {
    getAll: (category) => apiFetch(`/projects${category ? `?category=${category}` : ''}`),
    getById: (id) => apiFetch(`/projects/${id}`),
    create: (data) => apiFetch('/projects', { method: 'POST', body: data }),
    update: (id, data) => apiFetch(`/projects/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiFetch(`/projects/${id}`, { method: 'DELETE' })
};

// 4. Leaders
export const LeadersAPI = {
    getAll: (rotary_year) => apiFetch(`/leaders${rotary_year ? `?rotary_year=${rotary_year}` : ''}`),
    getById: (id) => apiFetch(`/leaders/${id}`),
    create: (data) => apiFetch('/leaders', { method: 'POST', body: data }),
    update: (id, data) => apiFetch(`/leaders/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiFetch(`/leaders/${id}`, { method: 'DELETE' })
};

// 5. Civic Service Requests & Contact Inquiries
export const ServicesAPI = {
    createRequest: (data) => apiFetch('/service-requests', { method: 'POST', body: data }),
    trackRequest: (code) => apiFetch(`/service-requests/track/${encodeURIComponent(code)}`),
    getAllRequests: (status, assigned_to, my_requests) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (assigned_to) params.append('assigned_to', assigned_to);
        if (my_requests) params.append('my_requests', 'true');
        return apiFetch(`/service-requests?${params.toString()}`);
    },
    updateRequestStatus: (id, status, admin_notes) =>
        apiFetch(`/service-requests/${id}/status`, { method: 'PATCH', body: { status, admin_notes } }),
    assignRequest: (id, assigned_member_id) =>
        apiFetch(`/service-requests/${id}/assign`, { method: 'PATCH', body: { assigned_member_id } }),
    submitContact: (data) => apiFetch('/contacts', { method: 'POST', body: data }),
    getContacts: (status) => apiFetch(`/contacts${status ? `?status=${status}` : ''}`),
    updateContactStatus: (id, status) => apiFetch(`/contacts/${id}/status`, { method: 'PATCH', body: { status } }),
    deleteContact: (id) => apiFetch(`/contacts/${id}`, { method: 'DELETE' })
};

// 6. Membership Applications & Tasks
export const MembershipAPI = {
    apply: (data) => apiFetch('/memberships/apply', { method: 'POST', body: data }),
    getApplications: (status) => apiFetch(`/memberships${status ? `?status=${status}` : ''}`),
    getApplicationById: (id) => apiFetch(`/memberships/${id}`),
    reviewApplication: (id, status, review_notes) =>
        apiFetch(`/memberships/${id}/review`, { method: 'PATCH', body: { status, review_notes } }),
    getActiveMembers: () => apiFetch('/memberships/active-members'),
    getMyTasks: () => apiFetch('/tasks/my-tasks'),
    toggleTask: (id) => apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' }),
    createTask: (data) => apiFetch('/tasks', { method: 'POST', body: data }),
    getAllTasks: (user_id, completed) => {
        const params = new URLSearchParams();
        if (user_id) params.append('user_id', user_id);
        if (completed !== undefined) params.append('completed', completed);
        return apiFetch(`/tasks?${params.toString()}`);
    },
    deleteTask: (id) => apiFetch(`/tasks/${id}`, { method: 'DELETE' })
};

// 7. Admin Dashboard Stats
export const StatsAPI = {
    getAdminStats: () => apiFetch('/stats')
};

/**
 * Toast Notification System
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col space-y-2';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorClasses = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-rose-600 text-white',
        warning: 'bg-amber-500 text-white',
        info: 'bg-sky-600 text-white'
    }[type] || 'bg-slate-800 text-white';

    toast.className = `flex items-center px-4 py-3 rounded-lg shadow-lg text-sm font-medium transform transition-all duration-300 translate-y-2 opacity-0 ${colorClasses}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

