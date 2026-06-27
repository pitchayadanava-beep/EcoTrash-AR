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
const CLOUD_SYNC_URL = "";

/**
 * Fetches the registered accounts database from the cloud.
 */
async function fetchCloudAccounts() {
  if (!CLOUD_SYNC_URL) return null;
  try {
    const res = await fetch(`${CLOUD_SYNC_URL}?key=eco_accounts_database`);
    const data = await res.json();
    if (data && data.value) {
      return JSON.parse(data.value);
    }
  } catch (e) {
    console.error("Failed to fetch accounts from cloud:", e);
  }
  return null;
}

/**
 * Pushes the registered accounts database to the cloud.
 */
async function saveCloudAccounts(accounts) {
  if (!CLOUD_SYNC_URL) return;
  try {
    await fetch(CLOUD_SYNC_URL, {
      method: "POST",
      mode: "no-cors", // Google Apps Script redirects require no-cors to avoid client-side preflight block
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: "eco_accounts_database",
        value: JSON.stringify(accounts)
      })
    });
  } catch (e) {
    console.error("Failed to save accounts to cloud:", e);
  }
}

/**
 * Syncs local accounts database with cloud accounts database.
 */
async function syncLocalAndCloudAccounts() {
  if (!CLOUD_SYNC_URL) return;
  
  const cloudAccounts = await fetchCloudAccounts();
  if (!cloudAccounts) return;
  
  let localAccounts = [];
  try {
    localAccounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
  } catch (e) {
    localAccounts = [];
  }
  
  // Merge accounts:
  // For each account, keep the one with the higher level and XP (more progress).
  const mergedAccounts = [...cloudAccounts];
  
  localAccounts.forEach(localAcc => {
    const cloudIndex = mergedAccounts.findIndex(c => c.email.toLowerCase() === localAcc.email.toLowerCase());
    if (cloudIndex === -1) {
      // Add local-only account to the cloud list
      mergedAccounts.push(localAcc);
    } else {
      // If local account has more progress, update the merged account
      const cloudAcc = mergedAccounts[cloudIndex];
      const localXP = (localAcc.level * 1000) + (localAcc.xp || 0); // Calculate absolute progress weight
      const cloudXP = (cloudAcc.level * 1000) + (cloudAcc.xp || 0);
      
      if (localXP > cloudXP) {
        mergedAccounts[cloudIndex] = { ...cloudAcc, ...localAcc };
      }
    }
  });
  
  // Update local storage
  safeLocalStorage.setItem("eco_accounts", JSON.stringify(mergedAccounts));
  
  // Update cloud database with the merged list
  await saveCloudAccounts(mergedAccounts);
  
  // If user is currently logged in, sync their local profile stats card
  const profileStr = safeLocalStorage.getItem("eco_user_profile");
  if (profileStr) {
    const loggedInUser = JSON.parse(profileStr);
    const updatedUser = mergedAccounts.find(a => a.email.toLowerCase() === loggedInUser.email.toLowerCase());
    if (updatedUser) {
      safeLocalStorage.setItem("eco_user_profile", JSON.stringify(updatedUser));
      
      // Update appState cache if appState is defined
      if (window.appState) {
        window.appState.username = updatedUser.username;
        window.appState.xp = updatedUser.xp;
        window.appState.level = updatedUser.level;
        window.appState.score = updatedUser.score;
        window.appState.scannedCount = updatedUser.scannedCount;
        window.appState.badge = `Lv. ${updatedUser.level} ${updatedUser.badge || "พลเมืองสะอาดกรุงเทพฯ"}`;
        
        // Update header UI
        if (typeof window.updateUI === "function") {
          window.updateUI();
        }
      }
    }
  }
}

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

  const btnGoSignup = document.getElementById("btn-go-signup");
  const btnGoLogin = document.getElementById("btn-go-login");
  const btnGoGoogle = document.getElementById("btn-go-google-signup");

  const btnSignupBack = document.getElementById("btn-signup-back");
  const btnLoginBack = document.getElementById("btn-login-back");

  const btnSubmitSignup = document.getElementById("btn-submit-signup");
  const btnSubmitLogin = document.getElementById("btn-submit-login");
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

  // Log Out
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      safeLocalStorage.setItem("eco_user_logged_in", "false");
      safeLocalStorage.removeItem("eco_user_profile");
      safeLocalStorage.removeItem("eco_ar_user_stats"); // Clear dynamic cache to reset to defaults
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
  if (signupError) signupError.textContent = "";
  if (loginError) loginError.textContent = "";
}

/**
 * Handles registration and signs up a new user.
 */
async function handleSignUpSubmit() {
  const username = document.getElementById("signup-username").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const errorDiv = document.getElementById("signup-error");

  errorDiv.textContent = "";

  if (!username) {
    errorDiv.textContent = "กรุณากรอกชื่อผู้ใช้งาน";
    return;
  }

  if (!email) {
    errorDiv.textContent = "กรุณากรอกอีเมล";
    return;
  }

  // Real email address validation regex
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

  // Fetch registered accounts DB
  let accounts = [];
  try {
    // If sync is active, load cloud accounts first to prevent duplicate registrations
    if (CLOUD_SYNC_URL) {
      errorDiv.textContent = "กำลังตรวจสอบกับฐานข้อมูลคลาวด์...";
      const cloudAccounts = await fetchCloudAccounts();
      if (cloudAccounts) {
        accounts = cloudAccounts;
      } else {
        accounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
      }
      errorDiv.textContent = "";
    } else {
      accounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
    }
  } catch (e) {
    accounts = [];
  }

  // Check if username already exists
  if (accounts.some(acc => acc.username.toLowerCase() === username.toLowerCase())) {
    errorDiv.textContent = "ชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว";
    return;
  }

  // Check if email already exists
  if (accounts.some(acc => acc.email.toLowerCase() === email.toLowerCase())) {
    errorDiv.textContent = "อีเมลนี้ถูกใช้งานลงทะเบียนแล้ว";
    return;
  }

  // Create new account
  const newUser = {
    username: username,
    email: email,
    password: password,
    xp: 0,
    level: 1,
    badge: "พลเมืองสะอาดกรุงเทพฯ",
    score: 0,
    scannedCount: 0
  };

  accounts.push(newUser);
  safeLocalStorage.setItem("eco_accounts", JSON.stringify(accounts));

  // Sync to cloud
  if (CLOUD_SYNC_URL) {
    errorDiv.textContent = "กำลังลงทะเบียนในคลาวด์...";
    await saveCloudAccounts(accounts);
  }

  // Set login session details
  safeLocalStorage.setItem("eco_user_logged_in", "true");
  safeLocalStorage.setItem("eco_user_profile", JSON.stringify(newUser));
  
  // Set initial stats cache for app.js
  const initialStats = {
    username: newUser.username,
    level: newUser.level,
    xp: newUser.xp,
    score: newUser.score,
    scannedCount: newUser.scannedCount,
    badge: `Lv. ${newUser.level} ${newUser.badge}`
  };
  safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(initialStats));

  // Reload page to start app
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

  // Fetch accounts DB
  let accounts = [];
  try {
    if (CLOUD_SYNC_URL) {
      errorDiv.textContent = "กำลังเชื่อมต่อกับคลาวด์...";
      const cloudAccounts = await fetchCloudAccounts();
      if (cloudAccounts) {
        accounts = cloudAccounts;
        safeLocalStorage.setItem("eco_accounts", JSON.stringify(cloudAccounts));
      } else {
        accounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
      }
      errorDiv.textContent = "";
    } else {
      accounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
    }
  } catch (e) {
    accounts = [];
  }

  // Query account
  const user = accounts.find(acc => 
    acc.username.toLowerCase() === identifier.toLowerCase() || 
    acc.email.toLowerCase() === identifier.toLowerCase()
  );

  if (!user || user.password !== password) {
    errorDiv.textContent = "ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง";
    return;
  }

  // Set login session details
  safeLocalStorage.setItem("eco_user_logged_in", "true");
  safeLocalStorage.setItem("eco_user_profile", JSON.stringify(user));

  // Set dynamic stats cache for app.js
  const userStats = {
    username: user.username,
    level: user.level,
    xp: user.xp,
    score: user.score,
    scannedCount: user.scannedCount,
    badge: `Lv. ${user.level} ${user.badge}`
  };
  safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(userStats));

  // Run final sync to download latest state before starting
  if (CLOUD_SYNC_URL) {
    errorDiv.textContent = "กำลังซิงค์โปรไฟล์...";
    await syncLocalAndCloudAccounts();
  }

  // Reload page to start app
  window.location.reload();
}
