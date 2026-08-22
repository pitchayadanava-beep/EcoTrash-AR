/* ==========================================================================
   EcoAR Authentication & Onboarding Logic
   ========================================================================== */

// Safe safeLocalStorage wrapper / polyfill
window.safeLocalStorage = (function() {
  var storage;
  try {
    storage = window.localStorage;
    var x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
  } catch(e) {
    storage = null;
  }
  
  if (storage) {
    return storage;
  } else {
    console.warn("safeLocalStorage is not available. Using in-memory fallback.");
    var mem = {};
    return {
      getItem: function(k) { return mem.hasOwnProperty(k) ? mem[k] : null; },
      setItem: function(k, v) { mem[k] = String(v); },
      removeItem: function(k) { delete mem[k]; },
      clear: function() { mem = {}; }
    };
  }
})();


// Cloud Sync Configurations
// Paste your Google Apps Script web app URL here to enable cross-device synchronization (e.g., https://script.google.com/macros/s/.../exec)
const CLOUD_SYNC_URL = "/api";

/**
 * Syncs local user profile and stats directly with the backend database via API.
 * Performs two-way sync: fetches fresh server profile on startup, then updates server with local changes.
 */
async function syncLocalAndCloudAccounts() {
  if (safeLocalStorage.getItem("eco_user_logged_in") !== "true") return;

  const profileStr = safeLocalStorage.getItem("eco_user_profile");
  if (!profileStr) return;

  try {
    const user = JSON.parse(profileStr);
    const email = user.email || "";
    const username = user.username || "";
    if (!email && !username) return;

    let sUser = null;

    // 1. Try Backend API
    try {
      const meRes = await fetch(`${CLOUD_SYNC_URL}/profile/me?email=${encodeURIComponent(email)}`);
      const meData = await meRes.json();
      if (meRes.ok && meData.success && meData.user) {
        sUser = meData.user;
      }
    } catch (fetchErr) {
      console.warn("Backend API unavailable, checking database.json fallback:", fetchErr);
    }

    // 2. Static / GitHub Pages Fallback: Check database.json
    if (!sUser) {
      try {
        const dbRes = await fetch('database.json?v=' + Date.now());
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          const users = dbData.users || [];
          sUser = users.find(u => 
            (email && u.email && u.email.toLowerCase() === email.toLowerCase()) ||
            (username && u.username && u.username.toLowerCase() === username.toLowerCase())
          );
        }
      } catch (dbErr) {
        console.warn("Could not fetch database.json:", dbErr);
      }
    }

    if (sUser) {
      let sTree = { waterCount: 0, selectedFruit: "apple" };
      let sCaptcha = { played: 0, highscore: 0, totalScore: 0 };
      try { if (sUser.tree_state) sTree = typeof sUser.tree_state === "string" ? JSON.parse(sUser.tree_state) : sUser.tree_state; } catch (e) {}
      try { if (sUser.captcha_stats) sCaptcha = typeof sUser.captcha_stats === "string" ? JSON.parse(sUser.captcha_stats) : sUser.captcha_stats; } catch (e) {}

      const localStatsSaved = safeLocalStorage.getItem("eco_ar_user_stats");
      let lStats = localStatsSaved ? JSON.parse(localStatsSaved) : {};

      // Keep local points and highest tree watering so watering tree or earning points never gets reverted
      const bestWaterCount = Math.max(lStats.treeState ? lStats.treeState.waterCount || 0 : 0, sTree.waterCount || 0);
      const mergedTree = {
        waterCount: bestWaterCount,
        selectedFruit: (lStats.treeState && lStats.treeState.selectedFruit) || sTree.selectedFruit || "apple"
      };

      const finalPoints = (lStats.points !== undefined && lStats.points !== null) ? lStats.points : (sUser.points !== undefined ? sUser.points : (sUser.score || 0));

      const mergedStats = {
        username: sUser.username || lStats.username || username,
        realName: sUser.real_name || lStats.realName || sUser.username || username,
        isVerified: sUser.is_verified !== undefined ? Boolean(sUser.is_verified) : true,
        level: Math.max(lStats.level || 1, sUser.level || 1),
        xp: Math.max(lStats.xp || 0, sUser.xp || 0),
        score: Math.max(lStats.score || 0, sUser.score || 0),
        scannedCount: Math.max(lStats.scannedCount || 0, sUser.scanned_count || 0),
        points: finalPoints,
        treeState: mergedTree,
        captchaStats: (sCaptcha && sCaptcha.highscore >= (lStats.captchaStats ? lStats.captchaStats.highscore || 0 : 0)) ? sCaptcha : (lStats.captchaStats || sCaptcha),
        badge: String(Math.max(Number(lStats.level || 1), Number(sUser.level || 1)))
      };

      safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(mergedStats));
      if (window.appState) {
        window.appState = { ...window.appState, ...mergedStats };
      }

      // Refresh active views
      if (typeof updateUI === "function") updateUI();
      if (typeof renderTree === "function" && document.getElementById("view-tree") && document.getElementById("view-tree").classList.contains("active")) {
        renderTree();
      }
    }

    // 3. Push merged stats back to cloud server if online
    const statsStr = safeLocalStorage.getItem("eco_ar_user_stats");
    if (!statsStr) return;
    const stats = JSON.parse(statsStr);

    const syncPayload = {
      email: email,
      username: stats.username,
      real_name: stats.realName || user.real_name || "",
      is_verified: user.is_verified !== undefined ? user.is_verified : 1,
      level: stats.level,
      xp: stats.xp,
      score: stats.score,
      scannedCount: stats.scannedCount,
      points: stats.points || 0,
      treeState: stats.treeState || { waterCount: 0, selectedFruit: "apple" },
      captchaStats: stats.captchaStats || { played: 0, highscore: 0, totalScore: 0 },
      badge: stats.badge
    };

    try {
      const res = await fetch(`${CLOUD_SYNC_URL}/profile/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncPayload)
      });
      const data = await res.json();
      if (data.success) {
        console.log("Server sync complete.");
      }
    } catch (pushErr) {}
  } catch (e) {
    console.error("Failed to sync user stats with server:", e);
  }
}

/**
 * Initializes authentication views, forms, and event listeners.
 */
// Pending registration state
let pendingUserObj = null;
let simulatedOTPCode = null;

/**
 * Initializes authentication views, forms, and event listeners.
 */
function initAuth() {
  // Trigger background sync if cloud URL is configured
  if (CLOUD_SYNC_URL) {
    syncLocalAndCloudAccounts().then(() => {
      console.log("Authentication cloud synchronization complete.");
    });
  }
  const authContainer = document.getElementById("auth-container");
  const authLanding = document.getElementById("auth-landing");
  const authSignup = document.getElementById("auth-signup");
  const authLogin = document.getElementById("auth-login");
  const authVerify = document.getElementById("auth-verify");

  const btnGoSignup = document.getElementById("btn-go-signup");
  const btnGoLogin = document.getElementById("btn-go-login");
  const btnGoGoogle = document.getElementById("btn-go-google-signup");
  const btnGoGuest = document.getElementById("btn-go-guest");

  const btnSignupBack = document.getElementById("btn-signup-back");
  const btnLoginBack = document.getElementById("btn-login-back");
  const btnVerifyBack = document.getElementById("btn-verify-back");

  const btnSubmitSignup = document.getElementById("btn-submit-signup");
  const btnSubmitLogin = document.getElementById("btn-submit-login");
  const btnSubmitVerify = document.getElementById("btn-submit-verify");
  const btnResendOtp = document.getElementById("btn-resend-otp");
  const btnLogout = document.getElementById("btn-logout");

  // Check login state
  const isLoggedIn = safeLocalStorage.getItem("eco_user_logged_in") === "true";

  if (!isLoggedIn) {
    // Show auth overlay, hide logout button in header
    if (authContainer) authContainer.classList.remove("hidden");
    if (btnLogout) btnLogout.style.display = "none";
  } else {
    // Hide auth overlay, show logout button
    if (authContainer) authContainer.classList.add("hidden");
    if (btnLogout) btnLogout.style.display = "flex";
  }

  // Bind View Transitions with defensive null-checks
  if (btnGoGuest) {
    btnGoGuest.addEventListener("click", () => {
      safeLocalStorage.setItem("eco_user_logged_in", "true");
      if (!safeLocalStorage.getItem("eco_user_profile")) {
        const guestUser = {
          username: "ผู้ตรวจการ BKK (Guest)",
          real_name: "ผู้ตรวจการ BKK",
          email: "guest@ecotrash.ar",
          level: 1,
          xp: 0,
          score: 0,
          points: 0,
          is_verified: 1
        };
        safeLocalStorage.setItem("eco_user_profile", JSON.stringify(guestUser));
      }
      if (authContainer) authContainer.classList.add("hidden");
      if (btnLogout) btnLogout.style.display = "flex";
      if (typeof loadState === "function") loadState();
      if (typeof updateUI === "function") updateUI();
    });
  }

  if (btnGoSignup) {
    btnGoSignup.addEventListener("click", () => {
      if (authLanding) authLanding.classList.add("hidden");
      if (authSignup) authSignup.classList.remove("hidden");
      const usernameInput = document.getElementById("signup-username");
      if (usernameInput) usernameInput.focus();
    });
  }

  if (btnGoLogin) {
    btnGoLogin.addEventListener("click", () => {
      if (authLanding) authLanding.classList.add("hidden");
      if (authLogin) authLogin.classList.remove("hidden");
      const loginInput = document.getElementById("login-identifier");
      if (loginInput) loginInput.focus();
    });
  }

  if (btnSignupBack) {
    btnSignupBack.addEventListener("click", () => {
      if (authSignup) authSignup.classList.add("hidden");
      if (authLanding) authLanding.classList.remove("hidden");
      clearErrors();
    });
  }

  if (btnLoginBack) {
    btnLoginBack.addEventListener("click", () => {
      if (authLogin) authLogin.classList.add("hidden");
      if (authLanding) authLanding.classList.remove("hidden");
      clearErrors();
    });
  }

  if (btnVerifyBack) {
    btnVerifyBack.addEventListener("click", () => {
      if (authVerify) authVerify.classList.add("hidden");
      if (authSignup) authSignup.classList.remove("hidden");
      clearErrors();
    });
  }

  // Google Sign Up Redirect
  if (btnGoGoogle) {
    btnGoGoogle.addEventListener("click", () => {
      window.location.href = "google_signup.html";
    });
  }

  // Submit Sign Up Form
  if (btnSubmitSignup) {
    btnSubmitSignup.addEventListener("click", handleSignUpSubmit);
  }

  // Submit Log In Form
  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener("click", handleLogInSubmit);
  }

  // Submit Verify Code Form
  if (btnSubmitVerify) {
    btnSubmitVerify.addEventListener("click", handleVerifySubmit);
  }

  // Resend OTP Code
  if (btnResendOtp) {
    btnResendOtp.addEventListener("click", handleResendOTP);
  }

  // Log Out
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      // Preserve current progress in eco_registered_users before logging out
      try {
        const profileStr = safeLocalStorage.getItem("eco_user_profile");
        const statsStr = safeLocalStorage.getItem("eco_ar_user_stats");
        if (profileStr && statsStr) {
          const profile = JSON.parse(profileStr);
          const stats = JSON.parse(statsStr);
          let accountsList = [];
          try { accountsList = JSON.parse(safeLocalStorage.getItem("eco_registered_users") || "[]"); } catch(e) {}
          const updatedUser = {
            ...profile,
            username: stats.username || profile.username,
            real_name: stats.realName || profile.real_name || stats.username || profile.username,
            level: stats.level || profile.level || 1,
            xp: stats.xp || profile.xp || 0,
            score: stats.score || profile.score || 0,
            scanned_count: stats.scannedCount || profile.scanned_count || 0,
            points: stats.points !== undefined ? stats.points : (profile.points || stats.score || 0),
            tree_state: typeof stats.treeState === 'string' ? stats.treeState : JSON.stringify(stats.treeState || { waterCount: 0, selectedFruit: "apple" }),
            captcha_stats: typeof stats.captchaStats === 'string' ? stats.captchaStats : JSON.stringify(stats.captchaStats || { played: 0, highscore: 0, totalScore: 0 }),
            badge: String(stats.badge || profile.badge || stats.level || 1),
            last_active: Date.now()
          };
          const idx = accountsList.findIndex(a => 
            (a.email && profile.email && a.email.toLowerCase() === profile.email.toLowerCase()) || 
            (a.username && a.username.toLowerCase() === (stats.username || profile.username || "").toLowerCase())
          );
          if (idx !== -1) {
            accountsList[idx] = { ...accountsList[idx], ...updatedUser };
          } else {
            accountsList.push(updatedUser);
          }
          safeLocalStorage.setItem("eco_registered_users", JSON.stringify(accountsList));
        }
      } catch(e) {
        console.error("Error saving progress before logout:", e);
      }

      safeLocalStorage.setItem("eco_user_logged_in", "false");
      safeLocalStorage.removeItem("eco_user_profile");
      safeLocalStorage.removeItem("eco_ar_user_stats");
      safeLocalStorage.removeItem("captcha_stats");
      window.location.reload();
    });
  }
}

/**
 * Clears form validation error text fields.
 */
function clearErrors() {
  const signupError = document.getElementById("signup-error");
  const loginError = document.getElementById("login-error");
  const verifyError = document.getElementById("verify-error");
  if (signupError) signupError.textContent = "";
  if (loginError) loginError.textContent = "";
  if (verifyError) verifyError.textContent = "";
}

/**
 * Sends a 6-digit OTP code using Google Apps Script or simulated local fallback.
/**
 * Sends a 6-digit OTP code using Google Apps Script, backend API, or local notification fallback.
 */
async function sendOTPCode(email) {
  let localCode = "";
  for (let i = 0; i < 6; i++) {
    localCode += Math.floor(Math.random() * 10).toString();
  }
  simulatedOTPCode = localCode;

  // 1. Check if Google Apps Script URL is configured for real email delivery
  if (typeof CLOUD_SYNC_URL === "string" && CLOUD_SYNC_URL.includes("script.google.com")) {
    try {
      const url = `${CLOUD_SYNC_URL}?action=sendOTP&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        alert(`✉️ ส่งรหัสยืนยันตัวตนไปยังอีเมล ${email} เรียบร้อยแล้ว!\n\nกรุณาเช็กในกล่องข้อความ (Inbox) หรือโฟลเดอร์ขยะ/จดหมายขยะ (Spam) ของคุณ`);
        return true;
      }
    } catch (err) {
      console.warn("Google Apps Script email send failed, falling back to local API:", err);
    }
  }

  // 2. Try Node.js Express server API
  try {
    const response = await fetch(`${CLOUD_SYNC_URL}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      if (data.simulatedOTP) {
        simulatedOTPCode = data.simulatedOTP;
      }
      alert(`✉️ [รหัสยืนยันตัวตน 2-Step Verification]
ส่งไปยังอีเมล: ${email}

🔑 รหัสผ่าน 6 หลักของคุณคือ: ${simulatedOTPCode}
(กรอกรหัสนี้ในช่องยืนยันตัวตนเพื่อสมัครสมาชิก)`);
      return true;
    } else {
      const errMsg = data.error || "ไม่สามารถส่งรหัสยืนยันตัวตนได้";
      alert("ข้อผิดพลาด: " + errMsg);
      return false;
    }
  } catch (e) {
    console.warn("Backend API endpoint unavailable, using secure notification fallback:", e);
    // Offline/Static host fallback: Display OTP code notification so registration is never blocked
    alert(`✉️ [รหัสยืนยันตัวตน 2-Step Verification]
ส่งไปยังอีเมล: ${email}

🔑 รหัสผ่าน 6 หลักของคุณคือ: ${simulatedOTPCode}
(กรอกรหัสนี้ในช่องยืนยันตัวตนเพื่อสมัครสมาชิก)`);
    return true;
  }
}

/**
 * Verifies a 6-digit OTP code using Google Apps Script, Node.js Express server API, or fallback verification.
 */
async function verifyOTPCode(email, code) {
  const cleanCode = code ? code.trim() : "";

  // 1. Try Google Apps Script if configured
  if (typeof CLOUD_SYNC_URL === "string" && CLOUD_SYNC_URL.includes("script.google.com")) {
    try {
      const url = `${CLOUD_SYNC_URL}?action=verifyOTP&email=${encodeURIComponent(email)}&code=${encodeURIComponent(cleanCode)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) return true;
    } catch (e) {
      console.warn("Google Apps Script OTP verify failed:", e);
    }
  }

  // 2. Try Node.js Express server API
  try {
    const response = await fetch(`${CLOUD_SYNC_URL}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: cleanCode })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return true;
    }
  } catch (e) {
    console.warn("Failed to verify OTP via backend API:", e);
  }

  // 3. Fallback verification against local/simulated OTP code
  if (simulatedOTPCode && cleanCode === simulatedOTPCode.trim()) {
    return true;
  }

  return false;
}

/**
 * Handles registration and requests OTP code.
 */
async function handleSignUpSubmit() {
  const realNameEl = document.getElementById("signup-realname");
  const realName = realNameEl ? realNameEl.value.trim() : "";
  const username = document.getElementById("signup-username").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const errorDiv = document.getElementById("signup-error");

  errorDiv.textContent = "";

  if (!realName) {
    errorDiv.textContent = "กรุณากรอกชื่อ-นามสกุลจริง (จำเป็นสำหรับการติดอันดับ Leaderboard)";
    return;
  }

  if (!username) {
    errorDiv.textContent = "กรุณากรอกชื่อผู้ใช้งาน";
    return;
  }

  if (!email) {
    errorDiv.textContent = "กรุณากรอกอีเมล";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorDiv.textContent = "รูปแบบอีเมลไม่ถูกต้อง (ต้องการอีเมลจริง)";
    return;
  }

  if (!password) {
    errorDiv.textContent = "กรุณากรอกรหัสผ่าน";
    return;
  }

  if (password.length < 4) {
    errorDiv.textContent = "รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร";
    return;
  }

  // Save the registration details to pending state
  pendingUserObj = {
    real_name: realName,
    username: username,
    email: email,
    password: password
  };

  errorDiv.textContent = "กำลังลงทะเบียนบัญชี...";
  await finalizeSignUp();
}

/**
 * Handles OTP verification code submission.
 */
async function handleVerifySubmit() {
  const code = document.getElementById("verify-code").value.trim();
  const errorDiv = document.getElementById("verify-error");

  errorDiv.textContent = "";

  if (!code || code.length !== 6) {
    errorDiv.textContent = "กรุณากรอกรหัสผ่าน 6 หลัก";
    return;
  }

  if (!pendingUserObj) {
    errorDiv.textContent = "ไม่พบข้อมูลการลงทะเบียน กรุณาเริ่มใหม่อีกครั้ง";
    return;
  }

  errorDiv.textContent = "กำลังตรวจสอบรหัสผ่าน...";
  const isVerified = await verifyOTPCode(pendingUserObj.email, code);

  if (isVerified) {
    errorDiv.textContent = "ยืนยันรหัสถูกต้อง! กำลังสร้างบัญชี...";
    await finalizeSignUp();
  } else {
    errorDiv.textContent = "รหัสยืนยันตัวตนไม่ถูกต้องหรือหมดอายุ";
  }
}

/**
 * Handles resending OTP code request.
 */
async function handleResendOTP() {
  const errorDiv = document.getElementById("verify-error");
  if (!pendingUserObj) {
    errorDiv.textContent = "ไม่พบข้อมูลการลงทะเบียน กรุณาเริ่มใหม่อีกครั้ง";
    return;
  }

  errorDiv.textContent = "กำลังส่งรหัสใหม่...";
  const success = await sendOTPCode(pendingUserObj.email);
  if (success) {
    errorDiv.textContent = "ส่งรหัสยืนยันตัวตนใหม่สำเร็จแล้ว!";
    errorDiv.style.color = "var(--color-green-neon)";
    setTimeout(() => {
      errorDiv.style.color = "#ef4444";
    }, 3000);
  } else {
    errorDiv.textContent = "เกิดข้อผิดพลาดในการส่งรหัสใหม่";
  }
}

/**
 * Finalizes account registration and logs the user in.
 */
async function finalizeSignUp() {
  const errorDiv = document.getElementById("verify-error");
  errorDiv.textContent = "กำลังลงทะเบียนบัญชี...";

  try {
    const response = await fetch(`${CLOUD_SYNC_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: pendingUserObj.username,
        real_name: pendingUserObj.real_name,
        email: pendingUserObj.email,
        password: pendingUserObj.password
      })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      safeLocalStorage.setItem("eco_user_logged_in", "true");
      safeLocalStorage.setItem("eco_user_profile", JSON.stringify(data.user));

      let parsedTree = { waterCount: 0, selectedFruit: "apple" };
      let parsedCaptcha = { played: 0, highscore: 0, totalScore: 0 };
      try { if (data.user.tree_state) parsedTree = typeof data.user.tree_state === "string" ? JSON.parse(data.user.tree_state) : data.user.tree_state; } catch (e) {}
      try { if (data.user.captcha_stats) parsedCaptcha = typeof data.user.captcha_stats === "string" ? JSON.parse(data.user.captcha_stats) : data.user.captcha_stats; } catch (e) {}

      const initialStats = {
        username: data.user.username,
        realName: data.user.real_name || pendingUserObj.real_name,
        isVerified: true,
        level: data.user.level || 1,
        xp: data.user.xp || 0,
        score: data.user.score || 0,
        scannedCount: data.user.scanned_count || 0,
        points: data.user.points || 0,
        treeState: parsedTree,
        captchaStats: parsedCaptcha,
        badge: String(data.user.badge || 1)
      };
      safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(initialStats));

      pendingUserObj = null;
      simulatedOTPCode = null;
      window.location.reload();
      return;
    } else {
      errorDiv.textContent = data.error || "เกิดข้อผิดพลาดในการสร้างบัญชี";
      return;
    }
  } catch (e) {
    console.warn("Backend register API unavailable, finalizing signup locally:", e);
  }

  // Local fallback registration
  const createdUser = {
    username: pendingUserObj.username,
    real_name: pendingUserObj.real_name,
    email: pendingUserObj.email.toLowerCase(),
    password: pendingUserObj.password,
    is_verified: 1,
    level: 1,
    xp: 0,
    score: 0,
    scanned_count: 0,
    points: 0,
    tree_state: '{"waterCount":0,"selectedFruit":"apple"}',
    captcha_stats: '{"played":0,"highscore":0,"totalScore":0}',
    badge: '1'
  };

  // Save to client registered accounts list for static/GitHub Pages support
  let accountsList = [];
  try { accountsList = JSON.parse(safeLocalStorage.getItem("eco_registered_users") || "[]"); } catch (e) {}
  const existingIdx = accountsList.findIndex(a => a.email === createdUser.email || a.username.toLowerCase() === createdUser.username.toLowerCase());
  if (existingIdx !== -1) {
    accountsList[existingIdx] = { ...accountsList[existingIdx], ...createdUser };
  } else {
    accountsList.push(createdUser);
  }
  safeLocalStorage.setItem("eco_registered_users", JSON.stringify(accountsList));

  safeLocalStorage.setItem("eco_user_logged_in", "true");
  safeLocalStorage.setItem("eco_user_profile", JSON.stringify(createdUser));

  const localStats = {
    username: pendingUserObj.username,
    realName: pendingUserObj.real_name,
    isVerified: true,
    level: 1,
    xp: 0,
    score: 0,
    scannedCount: 0,
    points: 0,
    treeState: { waterCount: 0, selectedFruit: "apple" },
    captchaStats: { played: 0, highscore: 0, totalScore: 0 },
    badge: '1'
  };
  safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(localStats));

  pendingUserObj = null;
  simulatedOTPCode = null;
  window.location.reload();
}

/**
 * Handles log in form submission.
 */
async function handleLogInSubmit() {
  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errorDiv = document.getElementById("login-error");

  errorDiv.textContent = "";

  if (!identifier) {
    errorDiv.textContent = "กรุณากรอกชื่อผู้ใช้งาน หรือ อีเมล";
    return;
  }

  if (!password) {
    errorDiv.textContent = "กรุณากรอกรหัสผ่าน";
    return;
  }

  errorDiv.textContent = "กำลังเชื่อมต่อกับเซิร์ฟเวอร์...";
  try {
    const response = await fetch(`${CLOUD_SYNC_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      // Set login session details
      safeLocalStorage.setItem("eco_user_logged_in", "true");
      safeLocalStorage.setItem("eco_user_profile", JSON.stringify(data.user));

      let parsedTree = { waterCount: 0, selectedFruit: "apple" };
      let parsedCaptcha = { played: 0, highscore: 0, totalScore: 0 };
      try { if (data.user.tree_state) parsedTree = typeof data.user.tree_state === "string" ? JSON.parse(data.user.tree_state) : data.user.tree_state; } catch (e) {}
      try { if (data.user.captcha_stats) parsedCaptcha = typeof data.user.captcha_stats === "string" ? JSON.parse(data.user.captcha_stats) : data.user.captcha_stats; } catch (e) {}

      // Set dynamic stats cache for app.js
      const userStats = {
        username: data.user.username,
        realName: data.user.real_name || data.user.username,
        isVerified: true,
        level: data.user.level || 1,
        xp: data.user.xp || 0,
        score: data.user.score || 0,
        scannedCount: data.user.scanned_count || 0,
        points: data.user.points !== undefined ? data.user.points : (data.user.score || 0),
        treeState: parsedTree,
        captchaStats: parsedCaptcha,
        badge: String(data.user.badge || data.user.level || 1)
      };
      safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(userStats));

      // Reload page to start app
      window.location.reload();
      return;
    } else {
      errorDiv.textContent = data.error || "ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง";
      return;
    }
  } catch (e) {
    console.warn("Backend login API unavailable, attempting database.json & client local account login:", e);
  }

  // 1. Static / GitHub Pages Fallback: Check local registered accounts and database.json
  let localAccount = null;
  try {
    const regList = JSON.parse(safeLocalStorage.getItem("eco_registered_users") || "[]");
    localAccount = regList.find(a => 
      (a.username.toLowerCase() === identifier.toLowerCase() || (a.email && a.email.toLowerCase() === identifier.toLowerCase())) &&
      (a.password === password || a.password === "google_oauth_verified")
    );
  } catch(e) {}

  let dbAccount = null;
  try {
    const dbRes = await fetch('database.json?v=' + Date.now());
    if (dbRes.ok) {
      const dbData = await dbRes.json();
      const users = dbData.users || [];
      dbAccount = users.find(a => 
        (a.username.toLowerCase() === identifier.toLowerCase() || (a.email && a.email.toLowerCase() === identifier.toLowerCase())) &&
        (a.password === password || a.password === "google_oauth_verified")
      );
    }
  } catch (dbErr) {
    console.warn("Could not check database.json:", dbErr);
  }

  const matchedAccount = localAccount || dbAccount;

  if (matchedAccount) {
    const fallbackSource = dbAccount || localAccount || {};
    let lTree = { waterCount: 0, selectedFruit: "apple" };
    let dTree = { waterCount: 0, selectedFruit: "apple" };
    if (matchedAccount.tree_state) {
      try { lTree = typeof matchedAccount.tree_state === "string" ? JSON.parse(matchedAccount.tree_state) : matchedAccount.tree_state; } catch(e){}
    }
    if (fallbackSource.tree_state) {
      try { dTree = typeof fallbackSource.tree_state === "string" ? JSON.parse(fallbackSource.tree_state) : fallbackSource.tree_state; } catch(e){}
    }

    const bestWater = Math.max(lTree.waterCount || 0, dTree.waterCount || 0);
    const mergedTree = {
      waterCount: bestWater,
      selectedFruit: lTree.selectedFruit || dTree.selectedFruit || "apple"
    };

    let parsedCaptcha = { played: 0, highscore: 0, totalScore: 0 };
    if (matchedAccount.captcha_stats) {
      try { parsedCaptcha = typeof matchedAccount.captcha_stats === "string" ? JSON.parse(matchedAccount.captcha_stats) : matchedAccount.captcha_stats; } catch (e) {}
    }

    const bestLevel = Math.max(matchedAccount.level || 1, fallbackSource.level || 1);
    const bestXP = Math.max(matchedAccount.xp || 0, fallbackSource.xp || 0);
    const bestScore = Math.max(matchedAccount.score || 0, fallbackSource.score || 0);
    const bestPoints = matchedAccount.points !== undefined ? matchedAccount.points : (fallbackSource.points !== undefined ? fallbackSource.points : bestScore);

    const userStats = {
      username: matchedAccount.username,
      realName: matchedAccount.real_name || matchedAccount.username,
      isVerified: true,
      level: bestLevel,
      xp: bestXP,
      score: bestScore,
      scannedCount: Math.max(matchedAccount.scanned_count || 0, fallbackSource.scanned_count || 0),
      points: bestPoints,
      treeState: mergedTree,
      captchaStats: parsedCaptcha,
      badge: String(matchedAccount.badge || fallbackSource.badge || bestLevel)
    };

    safeLocalStorage.setItem("eco_user_logged_in", "true");
    safeLocalStorage.setItem("eco_user_profile", JSON.stringify({ ...matchedAccount, ...userStats }));
    safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(userStats));
    window.location.reload();
  } else {
    errorDiv.textContent = "ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง";
  }
}

/**
 * Account Sync & Transfer Code System
 */
function exportSyncCode() {
  const stats = safeLocalStorage.getItem("eco_ar_user_stats");
  const profile = safeLocalStorage.getItem("eco_user_profile");
  if (!stats) return "";
  const payload = {
    stats: JSON.parse(stats),
    profile: profile ? JSON.parse(profile) : {},
    timestamp: Date.now()
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function importSyncCode(codeStr) {
  try {
    const raw = decodeURIComponent(escape(atob(codeStr.trim())));
    const payload = JSON.parse(raw);
    if (!payload.stats) return false;

    safeLocalStorage.setItem("eco_user_logged_in", "true");
    safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(payload.stats));
    if (payload.profile) {
      safeLocalStorage.setItem("eco_user_profile", JSON.stringify(payload.profile));
    }
    return true;
  } catch (e) {
    console.error("Failed to import sync code:", e);
    return false;
  }
}

// Bind Points Button & Account Transfer Modal
document.addEventListener("DOMContentLoaded", () => {
  const pointsBtn = document.getElementById("btn-account-points");
  if (pointsBtn) {
    pointsBtn.addEventListener("click", () => {
      openAccountSyncModal();
    });
  }
});

function openAccountSyncModal() {
  let modal = document.getElementById("account-sync-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "account-sync-modal";
    modal.className = "sync-modal-overlay";
    modal.innerHTML = `
      <div class="sync-modal-card">
        <div class="sync-modal-header">
          <div class="sync-modal-title">
            <span style="font-size: 24px;">🔄</span>
            <h3>ศูนย์ซิงค์คะแนน & ถ่ายโอนบัญชี</h3>
          </div>
          <button id="btn-close-sync-modal" class="sync-modal-close">&times;</button>
        </div>
        <div class="sync-modal-body">
          <div class="sync-account-preview" id="sync-preview-box">
            <!-- Account dynamic preview -->
          </div>
          
          <div class="sync-action-section">
            <label class="sync-label">📋 รหัสถ่ายโอนข้อมูล (Export Code)</label>
            <p class="sync-subtext">กดคัดลอกรหัสนี้เพื่อนำไปวางในมือถือหรือเบราว์เซอร์อื่น คะแนนและต้นไม้จะย้ายไปทันที</p>
            <div class="sync-input-row">
              <input type="text" id="sync-export-input" readonly class="sync-input-box" />
              <button id="btn-copy-sync-code" class="btn btn-primary" style="white-space: nowrap;">คัดลอก</button>
            </div>
          </div>

          <div class="sync-action-section" style="margin-top: 15px; border-top: 1px dashed #c4d7cb; padding-top: 15px;">
            <label class="sync-label">📥 วางรหัสเพื่อนำเข้าข้อมูล (Import Code)</label>
            <p class="sync-subtext">วางรหัสถ่ายโอนที่คัดลอกมาจากเครื่องอื่นเพื่อโหลดคะแนน</p>
            <div class="sync-input-row">
              <input type="text" id="sync-import-input" placeholder="วางรหัสซิงค์ที่นี่..." class="sync-input-box" />
              <button id="btn-apply-sync-code" class="btn btn-secondary" style="white-space: nowrap;">นำเข้า</button>
            </div>
            <div id="sync-status-msg" style="margin-top: 8px; font-size: 13px; font-weight: 600;"></div>
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <button id="btn-force-cloud-sync" class="btn btn-outline" style="width: 100%; border: 1px solid #3e6b53; color: #3e6b53; background: transparent; padding: 10px; border-radius: 12px; font-weight: 600; cursor: pointer;">
              ⚡ ซิงค์ด่วนกับฐานข้อมูลกลาง (Cloud Re-sync)
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners for modal controls
    document.getElementById("btn-close-sync-modal").onclick = () => {
      modal.classList.add("hidden");
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };

    document.getElementById("btn-copy-sync-code").onclick = () => {
      const input = document.getElementById("sync-export-input");
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        const msg = document.getElementById("sync-status-msg");
        msg.style.color = "#16a34a";
        msg.textContent = "✅ คัดลอกรหัสถ่ายโอนเรียบร้อยแล้ว!";
      });
    };

    document.getElementById("btn-apply-sync-code").onclick = () => {
      const code = document.getElementById("sync-import-input").value.trim();
      const msg = document.getElementById("sync-status-msg");
      if (!code) {
        msg.style.color = "#dc2626";
        msg.textContent = "กรุณาวางรหัสถ่ายโอน";
        return;
      }
      if (importSyncCode(code)) {
        msg.style.color = "#16a34a";
        msg.textContent = "🎉 นำเข้าข้อมูลสำเร็จ! กำลังรีโหลดหน้าเว็บ...";
        setTimeout(() => { window.location.reload(); }, 1000);
      } else {
        msg.style.color = "#dc2626";
        msg.textContent = "❌ รหัสถ่ายโอนไม่ถูกต้อง";
      }
    };

    document.getElementById("btn-force-cloud-sync").onclick = async () => {
      const msg = document.getElementById("sync-status-msg");
      msg.style.color = "#2563eb";
      msg.textContent = "กำลังซิงค์กับฐานข้อมูลกลาง...";
      await syncLocalAndCloudAccounts();
      msg.style.color = "#16a34a";
      msg.textContent = "✅ ซิงค์ข้อมูลสำเร็จ!";
      setTimeout(() => { window.location.reload(); }, 1000);
    };
  }

  // Populate dynamic data
  const statsStr = safeLocalStorage.getItem("eco_ar_user_stats");
  const stats = statsStr ? JSON.parse(statsStr) : (window.appState || {});
  const code = exportSyncCode();

  const preview = document.getElementById("sync-preview-box");
  if (preview) {
    preview.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 14px;">
        <div>
          <div style="font-weight: 700; color: #166534; font-size: 16px;">👤 ${stats.username || "ผู้ใช้งาน"}</div>
          <div style="font-size: 13px; color: #4b5563;">เลเวล: <b style="color: #15803d;">Lv. ${stats.level || 1}</b> | คะแนน: <b style="color: #d97706;">🪙 ${stats.points !== undefined ? stats.points : (stats.score || 0)}</b></div>
        </div>
        <div style="text-align: right; font-size: 13px; color: #4b5563;">
          <div>XP: <b>${stats.xp || 0}</b></div>
          <div>รดน้ำต้นไม้: <b>${stats.treeState ? stats.treeState.waterCount || 0 : 0} ครั้ง</b></div>
        </div>
      </div>
    `;
  }

  const exportInput = document.getElementById("sync-export-input");
  if (exportInput) exportInput.value = code;

  modal.classList.remove("hidden");
}

