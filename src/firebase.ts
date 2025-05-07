import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.resolve('./serviceAccountKey.json'));

admin.initializeApp({
  credential: cert(serviceAccount)
});

export const db = getFirestore();