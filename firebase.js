import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMvJZNo_S8osno0GTi3vhTb7RCfjn9s_8",
  authDomain: "hsabat-e0501.firebaseapp.com",
  projectId: "hsabat-e0501",
  storageBucket: "hsabat-e0501.firebasestorage.app",
  messagingSenderId: "23805888722",
  appId: "1:23805888722:web:f1cf5bcd9a0e874bc8450b"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
