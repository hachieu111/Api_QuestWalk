/**
 * @file server.js
 * @description Entry point — QuestWalk RESTful API (Express.js)
 *
 * Setup:  Express + CORS + JSON parser
 * Routes: /api/sync-steps, /api/buy-voucher
 * Deploy: Render (process.env.PORT được Render tự inject)
 *
 * Chạy local:  npm run dev   (dùng nodemon)
 * Chạy prod:   npm start
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

// ─── Khởi tạo Firebase Admin SDK ─────────────────────────────────────────────
// Import sớm để đảm bảo Firestore sẵn sàng trước khi nhận request
require("./firebase");

// ─── Import Routes ────────────────────────────────────────────────────────────
const syncStepsRouter = require("./routes/syncSteps");
const buyVoucherRouter = require("./routes/buyVoucher");

// ─── Khởi tạo Express App ─────────────────────────────────────────────────────
const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS — cho phép app React Native và các client khác gọi API
app.use(
  cors({
    origin: "*", // Mở rộng theo whitelist khi cần thiết trước khi production
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse request body dạng JSON
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
// Render dùng endpoint này để kiểm tra server còn sống
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "QuestWalk API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/sync-steps", syncStepsRouter);
app.use("/api/buy-voucher", buyVoucherRouter);

// ─── 404 Handler — Route không tồn tại ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} không tồn tại.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Đã xảy ra lỗi không mong đợi trên server.",
  });
});

// ─── Khởi động Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ QuestWalk API đang chạy tại http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app; // Export để dễ test nếu cần
