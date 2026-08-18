// src/firebase.js
// This file connects our app to YOUR Firebase project (likha-sis).
// Every other file that needs login or database access will import from here.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your project's unique connection details (safe to be public — see note below)
const firebaseConfig = {
  apiKey: "AIzaSyD5LkbygXnyMI2w0r7Cs9cwB9-VjMjlh-0",
  authDomain: "likha-sis.firebaseapp.com",
  projectId: "likha-sis",
  storageBucket: "likha-sis.firebasestorage.app",
  messagingSenderId: "116245880464",
  appId: "1:116245880464:web:8250e26f283e58e4064215"
};

// Connect to Firebase using the config above
const app = initializeApp(firebaseConfig);

// Set up the two services we'll use throughout the app:
// 'auth' handles teacher login/logout
// 'db' handles reading/writing data (forms, records, grades)
const auth = getAuth(app);
// getFirestore uses persistent local cache (IndexedDB) by default in Firebase v12+
const db = getFirestore(app);

export { auth, db };