import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const credentials = process.env.GOOGLE_CREDENTIALS;

if (!credentials) {
  throw new Error('Missing GOOGLE_CREDENTIALS environment variable');
}

const serviceAccount = JSON.parse(credentials);

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();