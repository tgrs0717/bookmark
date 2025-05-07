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
    const ref = firebase_1.db.collection(COLLECTION).doc(userId);
    const doc = await ref.get();
    const current = doc.exists ? doc.data()?.count || 0 : 0;
    const updated = current + 1;
    await ref.set({ count: updated });
    return updated;
}
