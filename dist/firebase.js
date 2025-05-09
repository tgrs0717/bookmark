"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const credentials = process.env.GOOGLE_CREDENTIALS;
if (!credentials) {
    throw new Error('Missing GOOGLE_CREDENTIALS environment variable');
}
const serviceAccount = JSON.parse(credentials);
(0, app_1.initializeApp)({
    credential: (0, app_1.cert)(serviceAccount),
});
exports.db = (0, firestore_1.getFirestore)();
