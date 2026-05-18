/**
 * @file test-api.js
 * @description Script test thủ công cho QuestWalk API đã deploy trên Render.
 * Chạy: node test-api.js
 */

const BASE_URL = "https://questwalk-backend.onrender.com";

// ─── Helper: gửi POST request và in kết quả ─────────────────────────────────
async function testPost(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  console.log("\n" + "─".repeat(55));
  console.log(`📤 POST ${url}`);
  console.log("   Body:", JSON.stringify(body, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log(`\n📥 Status: ${response.status} ${response.statusText}`);
    console.log("   Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("   ✅ THÀNH CÔNG");
    } else {
      console.log("   ❌ THẤT BẠI");
    }
  } catch (err) {
    console.error("   💥 Lỗi kết nối:", err.message);
  }
}

// ─── Helper: kiểm tra health check ──────────────────────────────────────────
async function testHealthCheck() {
  console.log("\n" + "─".repeat(55));
  console.log(`📤 GET ${BASE_URL}/`);

  try {
    const response = await fetch(`${BASE_URL}/`);
    const data = await response.json();
    console.log(`\n📥 Status: ${response.status} ${response.statusText}`);
    console.log("   Response:", JSON.stringify(data, null, 2));
    console.log(response.ok ? "   ✅ Server đang hoạt động" : "   ❌ Server lỗi");
  } catch (err) {
    console.error("   💥 Lỗi kết nối:", err.message);
  }
}

// ─── Chạy tất cả test cases ──────────────────────────────────────────────────
async function runTests() {
  const REAL_USER_ID = "osEnFwyYOMXabJKBw3oQbH8UpEf1";

  console.log("🚀 Bắt đầu test QuestWalk API...");
  console.log(`   Target : ${BASE_URL}`);
  console.log(`   User ID: ${REAL_USER_ID}`);

  // Test 1: Health check
  await testHealthCheck();

  // Test 2: sync-steps — userId thật, 500 bước
  await testPost("/api/sync-steps", {
    userId: REAL_USER_ID,
    steps: 500,
    source: "manual",
  });

  // Test 3: sync-steps — userId thật, thêm 8000 bước (kiểm tra quest milestone)
  await testPost("/api/sync-steps", {
    userId: REAL_USER_ID,
    steps: 8000,
    source: "google_fit",
  });

  // Test 4: sync-steps — thiếu userId (expect 400)
  await testPost("/api/sync-steps", {
    steps: 100,
  });

  // Test 5: sync-steps — steps âm (expect 400)
  await testPost("/api/sync-steps", {
    userId: REAL_USER_ID,
    steps: -50,
  });

  // Test 6: register-user — user mới hoàn toàn (dùng uid ngẫu nhiên)
  const fakeNewUid = "test_new_user_" + Date.now();
  await testPost("/api/register-user", {
    uid: fakeNewUid,
    email: "newuser@questwalk.com",
    displayName: "New Test User",
  });

  // Test 7: register-user — uid thật đã tồn tại (phải idempotent, không reset data)
  await testPost("/api/register-user", {
    uid: REAL_USER_ID,
    email: "testuser@questwalk.com",
    displayName: "Test User",
  });

  // Test 8: register-user — thiếu uid (expect 400)
  await testPost("/api/register-user", {
    email: "no-uid@questwalk.com",
  });

  console.log("\n" + "─".repeat(55));
  console.log("✔️  Hoàn thành tất cả test cases.\n");
}

runTests();
