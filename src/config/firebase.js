// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCg2ksRmgSHq0eQ3xQmYhhXstg5n4NMut8",
  authDomain: "tahtamapppublic.firebaseapp.com",
  projectId: "tahtamapppublic",
  storageBucket: "tahtamapppublic.firebasestorage.app",
  messagingSenderId: "921510937380",
  appId: "1:921510937380:web:fda3cb0b2ecc64489729b1",
  measurementId: "G-G5QDJ93YTS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export default app;