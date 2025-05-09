import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';

export async function incrementMessageCount(userId: string): Promise<number> {
  const docRef = db.collection('messageCounts').doc(userId);
  await docRef.set({ count: FieldValue.increment(1) }, { merge: true });

  const snapshot = await docRef.get();
  const data = snapshot.data();
  return data?.count ?? 0;
}

export async function getMessageCount(userId: string): Promise<number> {
  const doc = await db.collection('messageCounts').doc(userId).get();
  return doc.exists && typeof doc.data()?.count === 'number' ? doc.data()!.count : 0;
}