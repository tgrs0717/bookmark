import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// JSONファイルのパスを取得
const serviceAccountPath = path.resolve(__dirname, 'firebase-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Firebase 初期化
initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();
