import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
const listeners = new Set();

export function getUser(){ return currentUser; }

export function onUserChanged(fn){
  listeners.add(fn);
  // fire immediately if we already know
  if (currentUser !== undefined) fn(currentUser);
  return () => listeners.delete(fn);
}

function notify(){
  for (const fn of listeners) {
    try { fn(currentUser); } catch(e){ console.error(e); }
  }
}

export async function loginEmail(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signupEmail(email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout(){
  await signOut(auth);
}

// Wire up auth state
onAuthStateChanged(auth, (user)=>{
  currentUser = user || null;
  notify();
});

// UI helpers
export function setText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function bindAuthUIs(){
  const email = document.getElementById("auth_email");
  const pass  = document.getElementById("auth_password");
  const loginBtn  = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) loginBtn.addEventListener("click", async ()=>{
    try{
      await loginEmail(email?.value?.trim(), pass?.value || "");
    }catch(e){ alert(e.message); }
  });

  if (signupBtn) signupBtn.addEventListener("click", async ()=>{
    try{
      await signupEmail(email?.value?.trim(), pass?.value || "");
    }catch(e){ alert(e.message); }
  });

  if (logoutBtn) logoutBtn.addEventListener("click", async ()=>{
    try{
      await logout();
    }catch(e){ alert(e.message); }
  });

  const gate = document.getElementById("authGate");
  const gEmail = document.getElementById("gate_email");
  const gPass  = document.getElementById("gate_password");
  const gLogin = document.getElementById("gate_login");
  const gSignup= document.getElementById("gate_signup");

  if (gLogin) gLogin.addEventListener("click", async ()=>{
    try{
      await loginEmail(gEmail?.value?.trim(), gPass?.value || "");
    }catch(e){ setText("gate_status", "خطأ: " + e.message); }
  });

  if (gSignup) gSignup.addEventListener("click", async ()=>{
    try{
      await signupEmail(gEmail?.value?.trim(), gPass?.value || "");
    }catch(e){ setText("gate_status", "خطأ: " + e.message); }
  });

  // Keep UI in sync
  onUserChanged((user)=>{
    const status = user ? `الحالة: مسجّل (${user.email || "user"})` : "الحالة: غير مسجّل";
    setText("auth_status", status);
    setText("gate_status", status);
    if (gate) gate.classList.toggle("open", !user);
    // also mirror gate creds into settings panel for convenience
    if (user && email && !email.value) email.value = user.email || "";
  });
}
