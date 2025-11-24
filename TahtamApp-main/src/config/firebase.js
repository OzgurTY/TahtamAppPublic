// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfNfBWpPpC_a4KdervTuZWaFqdhmQcjTI",
  authDomain: "tahtamapp.firebaseapp.com",
  projectId: "tahtamapp",
  storageBucket: "tahtamapp.firebasestorage.app",
  messagingSenderId: "431508568052",
  appId: "1:431508568052:web:45e805aa918aa1c9076ba1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export default app;