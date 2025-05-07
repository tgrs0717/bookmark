import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS!);

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();