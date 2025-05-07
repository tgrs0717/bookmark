"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
(0, app_1.initializeApp)({
    credential: (0, app_1.cert)(credentials),
});
exports.db = (0, firestore_1.getFirestore)();
