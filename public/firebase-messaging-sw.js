// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config
const firebaseConfig = {
    apiKey: "AIzaSyCsYQj9qNn5eCpCPvawiB9SjNRrsNj31GM",
    authDomain: "vinfast-crm-981ba.firebaseapp.com",
    projectId: "vinfast-crm-981ba",
    storageBucket: "vinfast-crm-981ba.firebasestorage.app",
    messagingSenderId: "79419992202",
    appId: "1:79419992202:web:086f9b9ccfe615cb09e573"
};

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // If payload has notification object, the SDK usually handles it.
    // But if we want to force or customize, or if it's a data-only message:

    const notificationTitle = payload.notification?.title || payload.data?.title || 'VinFast CRM';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Bạn có thông báo mới',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data // Pass data to click handler
    };

    // Only show if we explicitly have content, or if standard SDK didn't pick it up
    // Note: If 'notification' is present in payload, showing it here might cause duplicates
    // unless we strictly use data-only messages from backend.

    // Check if window is focused (optional, usually handled by foreground handler)

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event);
    event.notification.close();

    // Open the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // If app is already open, focus it
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === '/' && 'focus' in client)
                    return client.focus();
            }
            // If not open, open it
            if (clients.openWindow)
                return clients.openWindow('/');
        })
    );
});
