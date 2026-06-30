import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABfPppMLrDvcLPtznQji-mdOrPRUQ18_g",
  authDomain: "terminal-one-67953.firebaseapp.com",
  projectId: "terminal-one-67953",
  storageBucket: "terminal-one-67953.firebasestorage.app",
  messagingSenderId: "510789387626",
  appId: "1:510789387626:web:882fd2136770587e1a9113",
  measurementId: "G-M9LRYDP35N",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
