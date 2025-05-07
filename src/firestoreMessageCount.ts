import { db } from './firebase';

const COLLECTION = 'messageCounts';

export async function getMessageCount(userId: string): Promise<number> {
  const doc = await db.collection(COLLECTION).doc(userId).get();
  if (!doc.exists) return 0;
  return doc.data()?.count || 0;
}

export async function incrementMessageCount(userId: string): Promise<number> {
  try {
    const docRef = db.collection(COLLECTION).doc(userId);
    let newCount = 0;

    await db.runTransaction(async (t) => {
      const doc = await t.get(docRef);
      newCount = (doc.exists ? doc.data()?.count || 0 : 0) + 1;
      t.set(docRef, { count: newCount }, { merge: true });
    });

    console.log(`✅ Message count updated for ${userId}: ${newCount}`);
    return newCount;
  } catch (error) {
    console.error(`❌ Failed to update message count for ${userId}:`, error);
    throw error;
  }
}
