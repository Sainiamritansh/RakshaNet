// services/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration (values from Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyBckDNg_H4jmcA9l8zV5XF-9DNpbeKndgg",
  authDomain: "rakshanet1.firebaseapp.com",
  projectId: "rakshanet1",
  storageBucket: "rakshanet1.appspot.com",
  messagingSenderId: "820512457164",
  appId: "1:820512457164:web:1e98de315158276c2b1d69",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services you will actually use
export const auth = getAuth(app);
export const db = getFirestore(app);
