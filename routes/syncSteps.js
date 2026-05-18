/**
 * @file routes/syncSteps.js
 * @description Route: POST /api/sync-steps
 *
 * Nhận số bước từ app, lưu log vào step_logs, cộng dồn vào totalSteps.
 * Kiểm tra nếu đạt mốc nhiệm vụ thì tự động cộng Xu vào coinBalance.
 *
 * Body (JSON):
 *   - userId    {string}  - UID của người dùng (xác thực từ app)
 *   - steps     {number}  - Số bước chân ghi nhận được (nguyên dương, tối đa 100.000)
 *   - source    {string?} - "health_kit" | "google_fit" | "manual" (mặc định: "manual")
 *   - recordedAt {string?} - ISO 8601 timestamp (mặc định: server time)
 *
 * Response 200: { success, totalSteps, coinBalance, completedQuests[] }
 * Response 400: { error: "Bad Request", message }
 * Response 500: { error: "Internal Server Error", message }
 */

const { Router } = require("express");
const { db, admin } = require("../firebase");

const router = Router();

// ─── POST /api/sync-steps ────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { userId, steps, source = "manual", recordedAt } = req.body;

  // ── Validate đầu vào ──────────────────────────────────────────────────────
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `userId` là bắt buộc và phải là chuỗi hợp lệ.",
    });
  }

  if (typeof steps !== "number" || !Number.isInteger(steps) || steps <= 0) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Trường `steps` phải là số nguyên dương.",
    });
  }

  const VALID_SOURCES = ["health_kit", "google_fit", "manual"];
  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      error: "Bad Request",
      message: `Trường \`source\` phải là một trong: ${VALID_SOURCES.join(", ")}.`,
    });
  }

  const MAX_STEPS_PER_SYNC = 100_000;
  if (steps > MAX_STEPS_PER_SYNC) {
    return res.status(400).json({
      error: "Bad Request",
      message: `Số bước mỗi lần đồng bộ không được vượt quá ${MAX_STEPS_PER_SYNC}.`,
    });
  }

  try {
    const userRef = db.collection("users").doc(userId.trim());

    // ── 0. Kiểm tra user tồn tại trước khi làm gì khác ──────────────────────
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Không tìm thấy user với ID: ${userId}. Hãy chắc chắn tài khoản đã được tạo.`,
      });
    }

    // ── 1. Ghi log vào step_logs ─────────────────────────────────────────────
    await db.collection("step_logs").add({
      userId: userId.trim(),
      steps,
      source,
      recordedAt: recordedAt
        ? new Date(recordedAt)
        : admin.firestore.FieldValue.serverTimestamp(),
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── 2. Cộng dồn totalSteps (atomic increment) ────────────────────────────
    await userRef.update({
      totalSteps: admin.firestore.FieldValue.increment(steps),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── 3. Đọc trạng thái user SAU KHI increment để lấy totalSteps chính xác ─
    const userSnapAfter = await userRef.get();
    const userData = userSnapAfter.data();
    const newTotalSteps = userData.totalSteps;
    const previousTotalSteps = newTotalSteps - steps;

    // ── 4. Kiểm tra quest đạt mốc, cộng Xu ──────────────────────────────────
    const questsSnap = await db
      .collection("quests")
      .where("isActive", "==", true)
      .get();

    const completedQuestTitles = [];
    let totalCoinReward = 0;

    questsSnap.forEach((doc) => {
      const { stepGoal, coinReward, title } = doc.data();
      // Chỉ thưởng nếu: trước đây chưa đạt mốc, nhưng bây giờ đã đạt
      if (previousTotalSteps < stepGoal && stepGoal <= newTotalSteps) {
        completedQuestTitles.push(title);
        totalCoinReward += coinReward || 0;
      }
    });

    if (totalCoinReward > 0) {
      await userRef.update({
        coinBalance: admin.firestore.FieldValue.increment(totalCoinReward),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // ── 5. Đọc coinBalance cuối cùng ─────────────────────────────────────────
    const finalUserSnap = await userRef.get();
    const finalCoinBalance = finalUserSnap.data().coinBalance;

    return res.status(200).json({
      success: true,
      totalSteps: newTotalSteps,
      coinBalance: finalCoinBalance,
      completedQuests: completedQuestTitles,
    });
  } catch (err) {
    console.error("[POST /api/sync-steps] Lỗi:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Đã xảy ra lỗi khi đồng bộ bước chân. Vui lòng thử lại.",
    });
  }
});

module.exports = router;
