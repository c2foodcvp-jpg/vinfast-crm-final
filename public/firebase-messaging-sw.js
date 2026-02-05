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

    // FIX: With Data-Only messages, payload.notification might be undefined.
    // We must read from payload.data
    const notificationTitle = payload.notification?.title || payload.data?.title || 'VinFast CRM';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Bạn có thông báo mới',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data, // Store data for click handler
        tag: 'vinfast-crm-notification' // Optional: grouping
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event);
    event.notification.close();

    const link = event.notification.data?.link || '/';

    // Open the app and navigate
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if there's already a tab open
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus().then(c => {
                        if (c) c.navigate(link);
                        return c;
                    });
                }
            }
            // If not open, open it
            if (clients.openWindow)
                return clients.openWindow(link);
        })
    );
});
