/**
 * @file server.js
 * @description Entry point — QuestWalk RESTful API (Express.js)
 *
 * Cấu trúc routes:
 *  - POST /api/register-user → Thay thế onUserCreate trigger — tạo user document
 *  - POST /api/sync-steps    → Đồng bộ bước chân + cộng Xu nhiệm vụ
 *  - POST /api/buy-voucher   → Mua voucher bằng Xu (Transaction nguyên tử)
 *  - POST /api/upload-avatar → Upload ảnh avatar lên Cloudinary
 *
 * Chạy local:  npm run dev   (dùng nodemon)
 * Chạy prod:   npm start     (Render inject process.env.PORT tự động)
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// ─── Cấu hình Cloudinary ──────────────────────────────────────────────────────
// Cloudinary SDK tự động nhận diện biến môi trường CLOUDINARY_URL 
// Định dạng: CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
// Không cần gọi cloudinary.config() thủ công nữa.

// ─── Cấu hình Multer (lưu file trong RAM) ───────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

// ─── Khởi tạo Firebase Admin SDK ─────────────────────────────────────────────
// Import sớm để đảm bảo Firestore sẵn sàng trước khi nhận request
require("./firebase");

// ─── Import Routes ────────────────────────────────────────────────────────────
const registerUserRouter = require("./routes/registerUser");
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
app.use("/api/register-user", registerUserRouter);
app.use("/api/sync-steps", syncStepsRouter);
app.use("/api/buy-voucher", buyVoucherRouter);

// ─── POST /api/upload-avatar ─────────────────────────────────────────────────
app.post("/api/upload-avatar", upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Không có file ảnh được gửi lên (key: avatar).",
    });
  }

  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: "questwalk_avatars" },
    (error, result) => {
      if (error) {
        console.error("[POST /api/upload-avatar] Lỗi Cloudinary:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: "Đã xảy ra lỗi khi upload ảnh lên Cloudinary.",
        });
      }
      return res.status(200).json({
        success: true,
        url: result.secure_url,
      });
    }
  );

  // Đẩy buffer của file từ memoryStorage vào stream của Cloudinary
  uploadStream.end(req.file.buffer);
});

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
