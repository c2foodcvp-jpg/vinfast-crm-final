import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

// 1. PWA Standard Caching (Workbox)
cleanupOutdatedCaches();
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// 2. Firebase Cloud Messaging
// Define config directly or via env vars if supported by build
const firebaseConfig = {
    apiKey: "AIzaSyCsYQj9qNn5eCpCPvawiB9SjNRrsNj31GM",
    authDomain: "vinfast-crm-981ba.firebaseapp.com",
    projectId: "vinfast-crm-981ba",
    storageBucket: "vinfast-crm-981ba.firebasestorage.app",
    messagingSenderId: "79419992202",
    appId: "1:79419992202:web:086f9b9ccfe615cb09e573"
};

try {
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    onBackgroundMessage(messaging, (payload) => {
        console.log('[sw.ts] Received background message ', payload);

        // Customize notification
        const notificationTitle = payload.notification?.title || 'VinFast CRM';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: payload.data,
            // iOS Web Push specific
            tag: payload.notification?.tag || 'default-tag',
            renotify: true
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (err) {
    console.error("Firebase SW Init Error:", err);
}

// 3. Notification Click Handler
self.addEventListener('notificationclick', function (event) {
    console.log('[sw.ts] Notification click Received.', event.notification);
    event.notification.close();

    // Open App logic
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // If tab is open, focus it
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not open, open new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
