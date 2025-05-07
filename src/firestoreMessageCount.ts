import { db } from './firebase';

const COLLECTION = 'messageCounts';

export async function getMessageCount(userId: string): Promise<number> {
  const doc = await db.collection(COLLECTION).doc(userId).get();
  if (!doc.exists) return 0;
  return doc.data()?.count || 0;
}

export async function incrementMessageCount(userId: string): Promise<number> {
  const ref = db.collection(COLLECTION).doc(userId);
  const doc = await ref.get();
  const current = doc.exists ? doc.data()?.count || 0 : 0;
  const updated = current + 1;
  await ref.set({ count: updated });
  return updated;
}
