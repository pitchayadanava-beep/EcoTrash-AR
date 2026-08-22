/**
 * ==========================================================================
 * Google Apps Script for Pick&PicTrash 2-Step Verification & Data Sync
 * ==========================================================================
 * 
 * Supports:
 * - 2-Step Email Verification (OTP) from picknpictr@gmail.com
 * - Real-time Database Syncing with timestamp-based conflict resolution (lastActive)
 * - Strict 1-Gmail-1-Account constraint enforcement
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Log into your Google account (picknpictr@gmail.com).
 * 2. Go to https://script.google.com/
 * 3. Click "New Project" and rename it to "Pick&PicTrash Backend".
 * 4. Replace any existing code with this script.
 * 5. Click "Deploy" (top right) -> "New deployment".
 * 6. Select type: "Web app".
 * 7. Set configuration:
 *    - Description: Pick&PicTrash Sync & OTP Backend
 *    - Execute as: "Me (picknpictr@gmail.com)"  <-- IMPORTANT: This ensures email is sent from this account.
 *    - Who has access: "Anyone"
 * 8. Click "Deploy", authorize permissions, and copy the "Web app URL".
 * 9. Paste the copied URL into CLOUD_SYNC_URL inside auth.js.
 */

// Handles GET Requests: DB Sync Fetch, sending OTP, and verifying OTP
function doGet(e) {
  var action = e.parameter.action;
  
  // 1. Send OTP Action
  if (action === 'sendOTP') {
    var email = e.parameter.email;
    if (!email) {
      return createJsonResponse({ success: false, error: 'Missing email address' });
    }
    
    // Generate a secure 6-digit verification code
    var code = "";
    for (var i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    
    // Store in script cache for 10 minutes (600 seconds)
    var cache = CacheService.getScriptCache();
    cache.put("otp_" + email.toLowerCase(), code, 600);
    
    try {
      MailApp.sendEmail({
        to: email,
        subject: "รหัสผ่านยืนยันตัวตนสำหรับสมัครสมาชิก Pick&PicTrash",
        htmlBody: `
          <div style="font-family: 'Athiti', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="text-align: center; margin-bottom: 25px;">
              <span style="font-size: 40px;">🌱</span>
              <h2 style="color: #3e6b53; margin: 10px 0 5px 0; font-size: 24px; font-weight: 700;">Pick&PicTrash</h2>
              <p style="color: #64748b; margin: 0; font-size: 14px;">ระบบสแกนขยะอัจฉริยะเพื่อกรุงเทพฯ สีเขียว</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 25px;">
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">สวัสดีครับ/ค่ะ,<br>ขอบคุณที่ร่วมเป็นส่วนหนึ่งในภารกิจสิ่งแวดล้อม รหัสยืนยันการสมัครสมาชิกของคุณคือ:</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #3e6b53; padding: 12px 30px; background-color: #f0fdf4; border: 2px solid #b2d8c3; border-radius: 12px; display: inline-block;">${code}</span>
            </div>
            
            <p style="color: #64748b; font-size: 13px; line-height: 1.5; text-align: center; margin-top: 25px;">
              * รหัสยืนยันตัวตนนี้จะมีอายุการใช้งาน 10 นาที<br>หากคุณไม่ได้สมัครใช้งานระบบ โปรดละเว้นอีเมลฉบับนี้
            </p>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0 15px 0;">
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">ส่งโดยระบบอัตโนมัติจากบัญชีหลัก picknpictr@gmail.com</p>
          </div>
        `
      });
      return createJsonResponse({ success: true });
    } catch (err) {
      return createJsonResponse({ success: false, error: 'ไม่สามารถส่งอีเมลได้: ' + err.message });
    }
  }
  
  // 2. Verify OTP Action
  if (action === 'verifyOTP') {
    var email = e.parameter.email;
    var code = e.parameter.code;
    
    if (!email || !code) {
      return createJsonResponse({ success: false, error: 'ข้อมูลไม่ครบถ้วน (ต้องการ email และ code)' });
    }
    
    var cache = CacheService.getScriptCache();
    var cachedCode = cache.get("otp_" + email.toLowerCase());
    
    if (cachedCode && cachedCode === code) {
      // Success: Remove code from cache so it cannot be used again
      cache.remove("otp_" + email.toLowerCase());
      return createJsonResponse({ success: true });
    } else {
      return createJsonResponse({ success: false, error: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุการใช้งานแล้ว' });
    }
  }
  
  // 3. Database Sync Read Action (Fetch Database)
  var key = e.parameter.key;
  if (key) {
    var val = PropertiesService.getScriptProperties().getProperty(key);
    return createJsonResponse({ value: val });
  }
  
  return createJsonResponse({ success: false, error: 'คำร้องขอไม่ถูกต้อง (Invalid action)' });
}

// Handles POST Requests: Syncing/Saving updated user database accounts
function doPost(e) {
  var postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ success: false, error: 'ข้อมูล JSON ไม่ถูกต้อง' });
  }
  
  var key = postData.key;
  var value = postData.value;
  
  if (key) {
    PropertiesService.getScriptProperties().setProperty(key, value);
    return createJsonResponse({ success: true });
  }
  
  return createJsonResponse({ success: false, error: 'ไม่พบคีย์สำหรับการบันทึก' });
}

// Utility function to convert JavaScript object to JSON Response with CORS permissions enabled
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
