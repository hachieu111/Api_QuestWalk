/**
 * @file routes/buyVoucher.js
 * @description Route: POST /api/buy-voucher
 *
 * Nhận voucherId, kiểm tra coinBalance của user, nếu đủ xu thì:
 *   - Trừ Xu (coinBalance)
 *   - Giảm stock voucher (nếu có giới hạn)
 *   - Tạo document thẻ cào mới trong user_vouchers
 * Toàn bộ thực hiện trong một Firestore Transaction để đảm bảo tính nguyên tử.
 *
 * Body (JSON):
 *   - userId    {string} - UID của người dùng
 *   - voucherId {string} - ID của voucher muốn mua
 *
 * Response 200: { success, userVoucherId, remainingCoinBalance }
 * Response 400: { error: "Bad Request", message }
 * Response 500: { error: "Internal Server Error", message }
 */

const { Router } = require("express");
const { db, admin } = require("../firebase");

const router = Router();

// ─── POST /api/buy-voucher ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { userId, voucherId } = req.body;

  // ── Validate đầu vào ──────────────────────────────────────────────────────
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `userId` là bắt buộc và phải là chuỗi hợp lệ.",
    });
  }

  if (!voucherId || typeof voucherId !== "string" || voucherId.trim() === "") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `voucherId` là bắt buộc và phải là chuỗi hợp lệ.",
    });
  }

  const cleanUserId = userId.trim();
  const cleanVoucherId = voucherId.trim();

  try {
    const voucherRef = db.collection("vouchers").doc(cleanVoucherId);
    const userRef = db.collection("users").doc(cleanUserId);
    const userVouchersRef = db.collection("user_vouchers");

    let newUserVoucherId;

    // ── Firestore Transaction nguyên tử ───────────────────────────────────────
    await db.runTransaction(async (transaction) => {
      // Đọc song song voucher và user để giảm latency
      const [voucherSnap, userSnap] = await Promise.all([
        transaction.get(voucherRef),
        transaction.get(userRef),
      ]);

      // Kiểm tra voucher tồn tại
      if (!voucherSnap.exists) {
        const err = new Error(`Voucher "${cleanVoucherId}" không tồn tại.`);
        err.statusCode = 400;
        throw err;
      }

      const voucherData = voucherSnap.data();

      // Kiểm tra voucher còn hoạt động
      if (!voucherData.isActive) {
        const err = new Error("Voucher này hiện không còn khả dụng.");
        err.statusCode = 400;
        throw err;
      }

      // Kiểm tra kho hàng (stock = -1 = không giới hạn)
      if (voucherData.stock !== -1 && voucherData.stock <= 0) {
        const err = new Error("Voucher này đã hết hàng. Vui lòng chọn voucher khác.");
        err.statusCode = 400;
        throw err;
      }

      // Kiểm tra user tồn tại
      if (!userSnap.exists) {
        const err = new Error(`Không tìm thấy tài khoản người dùng: ${cleanUserId}`);
        err.statusCode = 400;
        throw err;
      }

      const userData = userSnap.data();
      const { coinBalance } = userData;
      const { coinCost, name: voucherName, stock } = voucherData;

      // Kiểm tra số dư Xu
      if (coinBalance < coinCost) {
        const err = new Error(
          `Số Xu không đủ. Bạn có ${coinBalance} Xu, cần ${coinCost} Xu.`
        );
        err.statusCode = 400;
        throw err;
      }

      // Trừ coinBalance
      transaction.update(userRef, {
        coinBalance: admin.firestore.FieldValue.increment(-coinCost),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Giảm stock nếu có giới hạn
      if (stock !== -1) {
        transaction.update(voucherRef, {
          stock: admin.firestore.FieldValue.increment(-1),
        });
      }

      // Tạo document user_vouchers mới
      const newRef = userVouchersRef.doc();
      newUserVoucherId = newRef.id;

      transaction.set(newRef, {
        userId: cleanUserId,
        voucherId: cleanVoucherId,
        voucherName: voucherName || "Voucher",
        coinSpent: coinCost,
        cardCode: null,
        cardSerial: null,
        status: "pending",
        redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Đọc coinBalance cuối cùng sau transaction
    const finalUserSnap = await userRef.get();
    const remainingCoinBalance = finalUserSnap.data().coinBalance;

    return res.status(200).json({
      success: true,
      userVoucherId: newUserVoucherId,
      remainingCoinBalance,
    });
  } catch (err) {
    // Lỗi logic từ transaction (400)
    if (err.statusCode === 400) {
      return res.status(400).json({
        error: "Bad Request",
        message: err.message,
      });
    }

    // Lỗi không mong đợi (500)
    console.error("[POST /api/buy-voucher] Lỗi:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Đã xảy ra lỗi khi xử lý đổi thưởng. Vui lòng thử lại.",
    });
  }
});

module.exports = router;
