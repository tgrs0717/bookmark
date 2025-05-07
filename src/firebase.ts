import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

initializeApp({
  credential: cert(credentials),
});

export const db = getFirestore();
