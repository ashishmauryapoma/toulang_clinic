importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC1RHZ0r3zUEFI9al1oC-5vMRRCPvGkvqg",
  authDomain: "toulang-clinic-ae239.firebaseapp.com",
  projectId: "toulang-clinic-ae239",
  storageBucket: "toulang-clinic-ae239.firebasestorage.app",
  messagingSenderId: "946925200427",
  appId: "1:946925200427:web:1b966c4d708f5f01b8766e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: 'new-appointment',
    renotify: true
  });
});
