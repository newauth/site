// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyAUknvCkrD6DE9l0g_lfDPIg-EMVH9UKHQ",
  authDomain: "newauthappnotification-dev.firebaseapp.com",
  projectId: "newauthappnotification-dev",
  storageBucket: "newauthappnotification-dev.firebasestorage.app",
  messagingSenderId: "35133977694",
  appId: "1:35133977694:web:4f30d7b7339fd5acd570cf",
  measurementId: "G-474NM0YVNV"
};


firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/firebase-logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});