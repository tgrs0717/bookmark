"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementMessageCount = incrementMessageCount;
exports.getMessageCount = getMessageCount;
const firebase_1 = require("./firebase");
const firestore_1 = require("firebase-admin/firestore");
async function incrementMessageCount(userId) {
    const docRef = firebase_1.db.collection('messageCounts').doc(userId);
    await docRef.set({ count: firestore_1.FieldValue.increment(1) }, { merge: true });
    const snapshot = await docRef.get();
    const data = snapshot.data();
    return data?.count ?? 0;
}
async function getMessageCount(userId) {
    const doc = await firebase_1.db.collection('messageCounts').doc(userId).get();
    return doc.exists && typeof doc.data()?.count === 'number' ? doc.data().count : 0;
}
