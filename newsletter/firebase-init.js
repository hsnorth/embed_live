import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBgCds3FfTRZtZaAQ0Ej6hfgPPMqeRy54s",
    authDomain: "newsletter-496de.firebaseapp.com",
    projectId: "newsletter-496de",
    storageBucket: "newsletter-496de.appspot.com",
    messagingSenderId: "524546319756",
    appId: "1:524546319756:web:947abcff220aec51aa22a9",
    measurementId: "G-B8LSKDYS99"
};

// Initialize Firebase and export the services for other scripts to use
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
