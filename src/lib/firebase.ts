import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

// TODO: Replace with your actual Firebase project configuration
// You can find these in the Firebase Console > Project Settings
// Check configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log("🔥 Initializing Firebase with Project ID:", firebaseConfig.projectId ? "OK" : "MISSING");

let app;
let messaging: Messaging;

try {
    if (!firebaseConfig.projectId) {
        throw new Error("Firebase Configuration Missing: projectId is undefined. Check Environment Variables.");
    }
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
} catch (error) {
    console.error("❌ Firebase Initialization Error:", error);
    // Don't crash the entire app if Firebase fails, but features won't work
}

export { messaging };

export const requestForToken = async () => {
    try {
        const currentToken = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
        if (currentToken) {
            console.log('current token for client: ', currentToken);
            return currentToken;
        } else {
            console.log('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
