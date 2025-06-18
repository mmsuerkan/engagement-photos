import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBqu_-k152mv7tQoMZ01fEtalN3dAEBE94",
  authDomain: "photos-album-8a56e.firebaseapp.com",
  projectId: "photos-album-8a56e",
  storageBucket: "photos-album-8a56e.firebasestorage.app",
  messagingSenderId: "248263558863",
  appId: "1:248263558863:web:6dac6d80c86f7ef092d9ba",
  measurementId: "G-JWY55ML3XT"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);