/**
 * @file firebase.js
 * @description Khởi tạo Firebase Admin SDK một lần duy nhất.
 *              Export `db` (Firestore) để dùng trong toàn bộ ứng dụng.
 *
 * Đọc Service Account từ file firebase-key.json nằm cùng thư mục.
 * File này được bảo vệ bởi .gitignore — KHÔNG được commit lên git.
 */

const admin = require("firebase-admin");
const path = require("path");

// Đọc file service account key từ thư mục hiện tại
const serviceAccount = require(path.join(__dirname, "firebase-key.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
