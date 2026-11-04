/**
 * Rotary Club of Honavar - Direct Browser Vercel Blob Uploader
 * Utilizes @vercel/blob/client with Express auth integration
 */

import { AuthStorage } from './api.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB limit per photo

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Validate image before upload attempt
 */
export function validateImageFile(file) {
    if (!file) throw new Error('No file provided.');
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Invalid file type (${file.type}). Allowed formats: JPG, PNG, WebP.`);
    }
    if (file.size > MAX_FILE_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(`File size (${sizeMb} MB) exceeds maximum allowed limit of 4.5 MB.`);
    }
    return true;
}

/**
 * Uploads a file directly to Vercel Blob storage from the browser
 * @param {File} file - Browser File object
 * @param {string} folder - Target folder prefix ('projects' or 'events')
 * @param {Function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<string>} - Resolves to public CDN URL of uploaded blob
 */
export async function uploadBlobFile(file, folder = 'projects', onProgress = null) {
    validateImageFile(file);

    const token = AuthStorage.getToken();
    if (!token) {
        throw new Error('Authentication required to upload photos. Please log in as admin.');
    }

    // Dynamic import of @vercel/blob/client for browser runtime
    const { upload } = window.vercelBlob || await import('https://esm.sh/@vercel/blob/client');

    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const pathname = `${folder}/${Date.now()}-${cleanFilename}`;
    const handleUploadUrl = folder === 'events' ? '/api/events/upload' : '/api/projects/upload';

    const newBlob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl,
        headers: {
            Authorization: `Bearer ${token}`
        },
        onUploadProgress: (progress) => {
            if (typeof onProgress === 'function' && progress.total > 0) {
                onProgress(Math.round((progress.loaded / progress.total) * 100));
            }
        }
    });

    return newBlob.url;
}

/**
 * Upload an event gallery photo directly to Vercel Blob
 */
export async function uploadEventPhoto(file, onProgress = null) {
    return uploadBlobFile(file, 'events', onProgress);
}

/**
 * Upload a community project cover photo directly to Vercel Blob
 */
export async function uploadProjectPhoto(file, onProgress = null) {
    return uploadBlobFile(file, 'projects', onProgress);
}

/**
 * Upload a civic service request photo directly to Vercel Blob
 * Public upload for citizens submitting civic complaints
 */
export async function uploadCivicPhoto(file, onProgress = null) {
    validateImageFile(file);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (e) => {
            if (e.lengthComputable && typeof onProgress === 'function') {
                onProgress(Math.round((e.loaded / e.total) * 40));
            }
        };

        reader.onload = async () => {
            try {
                if (typeof onProgress === 'function') onProgress(50);
                const base64Data = reader.result.split(',')[1];
                const res = await fetch('/api/service-requests/upload-direct', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type || 'image/jpeg',
                        base64Data
                    })
                });

                if (typeof onProgress === 'function') onProgress(90);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Failed to upload photo to storage.');
                }

                if (typeof onProgress === 'function') onProgress(100);
                resolve(data.url);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
    });
}


