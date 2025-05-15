import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!base64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 環境変数が未設定です');
}

const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();
