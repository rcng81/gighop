import { initializeApp } from 'firebase/app';
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCZubK5VzaEaX85uHRBDIk_4u6RZewC86g",
    authDomain: "gighop-7e404.firebaseapp.com",
    projectId: "gighop-7e404",
    storageBucket: "gighop-7e404.firebasestorage.app",
    messagingSenderId: "220731630475",
    appId: "1:220731630475:web:f490adaa912e518c0c858e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);