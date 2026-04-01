import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBckDNg_H4jmcA9l8zV5XF-9DNpbeKndgg",
  authDomain: "rakshanet1.firebaseapp.com",
  projectId: "rakshanet1",
  storageBucket: "rakshanet1.appspot.com",
  messagingSenderId: "820512457164",
  appId: "1:820512457164:web:1e98de315158276c2b1d69",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);