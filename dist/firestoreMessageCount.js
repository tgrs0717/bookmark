"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageCount = getMessageCount;
exports.incrementMessageCount = incrementMessageCount;
const firebase_1 = require("./firebase");
const COLLECTION = 'messageCounts';
async function getMessageCount(userId) {
    const doc = await firebase_1.db.collection(COLLECTION).doc(userId).get();
    if (!doc.exists)
        return 0;
    return doc.data()?.count || 0;
}
async function incrementMessageCount(userId) {
    try {
        const docRef = firebase_1.db.collection(COLLECTION).doc(userId);
        let newCount = 0;
        await firebase_1.db.runTransaction(async (t) => {
            const doc = await t.get(docRef);
            newCount = (doc.exists ? doc.data()?.count || 0 : 0) + 1;
            t.set(docRef, { count: newCount }, { merge: true });
        });
        console.log(`✅ Message count updated for ${userId}: ${newCount}`);
        return newCount;
    }
    catch (error) {
        console.error(`❌ Failed to update message count for ${userId}:`, error);
        throw error;
    }
}
