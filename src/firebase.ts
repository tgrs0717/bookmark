import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';


const credentialsString = process.env.GOOGLE_CREDENTIALS;
if (!credentialsString) {
  throw new Error('❌ Missing GOOGLE_CREDENTIALS environment variable');
}

let credentials;
try {
  credentials = JSON.parse(credentialsString);
} catch (err) {
  console.error('❌ Failed to parse GOOGLE_CREDENTIALS:', err);
  throw err;
}

// 🔍 デバッグ出力（初期の一部だけ）
console.log('🔐 private_key preview:', credentials.private_key.slice(0, 100));

export const firebaseApp = initializeApp({
  credential: cert(credentials),
});

const serviceAccount = credentials;

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();