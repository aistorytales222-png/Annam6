const firebaseConfig = {
  apiKey: "AIzaSyAxMgjtiFPvZdbxRI9MTLPjBHInLG9dnBU",
  authDomain: "annam-c69cc.firebaseapp.com",
  projectId: "annam-c69cc",
  storageBucket: "annam-c69cc.firebasestorage.app",
  messagingSenderId: "212566489793",
  appId: "1:212566489793:web:93956de120edddfd7a7240",
};

var db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (e) {
  console.error("Firebase not started:", e);
}