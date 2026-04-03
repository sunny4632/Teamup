importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC_qPCx-G0GA4P0hjr6QqjYkKBd7Zgd988",
  authDomain: "teamup-dd3a4.firebaseapp.com",
  projectId: "teamup-dd3a4",
  storageBucket: "teamup-dd3a4.firebasestorage.app",
  messagingSenderId: "197508626131",
  appId: "1:197508626131:web:93072e8dfca111fea18626",
  measurementId: "G-DGM7ZCRLP7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
