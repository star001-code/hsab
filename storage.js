import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const defaultState = {
  clients: {}, // name -> {name, phone, city, ledger:[{id,type,desc,amount,date}]}
  expenses: [], // [{id, desc, amount, date}]
  settings: { currency: "IQD", locale: "ar-IQ" }
};

function normalizeState(s){
  const out = structuredClone(defaultState);
  if (s && typeof s === "object"){
    out.clients = s.clients && typeof s.clients === "object" ? s.clients : {};
    out.expenses = Array.isArray(s.expenses) ? s.expenses : [];
    out.settings = s.settings && typeof s.settings === "object" ? s.settings : { currency:"IQD", locale:"ar-IQ" };
    out.settings.currency ||= "IQD";
    out.settings.locale ||= "ar-IQ";
  }
  return out;
}

const collectionName = "users"; // users/{uid}

export async function loadState(uid){
  const ref = doc(db, collectionName, uid);
  const snap = await getDoc(ref);
  if (snap.exists()){
    return normalizeState(snap.data());
  }
  // first time: create
  const fresh = structuredClone(defaultState);
  await setDoc(ref, fresh);
  return fresh;
}

export async function saveState(uid, state){
  const ref = doc(db, collectionName, uid);
  // overwrite the doc with the whole state (simple + predictable)
  await setDoc(ref, normalizeState(state));
}
