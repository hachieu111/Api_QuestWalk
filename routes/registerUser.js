/**
 * @file routes/registerUser.js
 * @description Route: POST /api/register-user
 *
 * Thay thế cho trigger onUserCreate (Cloud Functions) — dùng khi không
 * có Firebase Blaze plan. App gọi endpoint này ngay sau khi đăng ký
 * tài khoản Firebase Auth thành công.
 *
 * Logic dùng set() với { merge: true } → idempotent:
 *   - Nếu document CHƯA tồn tại → tạo mới với giá trị mặc định
 *   - Nếu document ĐÃ tồn tại   → KHÔNG ghi đè (chỉ merge, giữ nguyên data cũ)
 *   Điều này đảm bảo gọi nhiều lần cũng an toàn (không reset coin/steps).
 *
 * Body (JSON):
 *   - uid          {string}  - Firebase Auth UID
 *   - email        {string}  - Email đăng ký
 *   - displayName  {string?} - Tên hiển thị (từ Google/Apple sign-in)
 *   - avatarUrl    {string?} - URL ảnh đại diện từ provider
 *
 * Response 200: { success, userId, isNewUser }
 * Response 400: { error: "Bad Request", message }
 * Response 500: { error: "Internal Server Error", message }
 */

const { Router } = require("express");
const { db, admin } = require("../firebase");

const router = Router();

// ─── POST /api/register-user ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { uid, email, displayName, avatarUrl } = req.body;

  // ── Validate đầu vào ──────────────────────────────────────────────────────
  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `uid` là bắt buộc và phải là chuỗi hợp lệ.",
    });
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `email` là bắt buộc và phải là email hợp lệ.",
    });
  }

  try {
    const userRef = db.collection("users").doc(uid.trim());

    // Kiểm tra document đã tồn tại chưa (để trả về isNewUser)
    const existingSnap = await userRef.get();
    const isNewUser = !existingSnap.exists;

    if (isNewUser) {
      // Tạo document mới với giá trị mặc định
      await userRef.set({
        uid: uid.trim(),
        email: email.trim(),
        displayName: displayName || null,
        avatarUrl: avatarUrl || null,
        coinBalance: 0,
        totalSteps: 0,
        fcmToken: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    // Nếu đã tồn tại → không làm gì, trả về success luôn (idempotent)

    return res.status(200).json({
      success: true,
      userId: uid.trim(),
      isNewUser,
      message: isNewUser
        ? "Tài khoản người dùng đã được khởi tạo thành công."
        : "Tài khoản đã tồn tại, không có thay đổi.",
    });
  } catch (err) {
    console.error("[POST /api/register-user] Lỗi:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Đã xảy ra lỗi khi khởi tạo tài khoản. Vui lòng thử lại.",
    });
  }
});

module.exports = router;
