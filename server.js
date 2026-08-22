const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "Peachy_4177"; // Customizable password for dashboard

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const DB_FILE = path.join(__dirname, 'eco_trash.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database: eco_trash.db");
  }
});

// Setup database tables
db.serialize(() => {
  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    real_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    is_verified INTEGER DEFAULT 1,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    scanned_count INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    tree_state TEXT DEFAULT '{"waterCount":0,"selectedFruit":"apple"}',
    badge TEXT DEFAULT '1',
    last_active INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure new columns exist on existing databases
  db.run(`ALTER TABLE users ADD COLUMN real_name TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN captcha_stats TEXT DEFAULT '{"played":0,"highscore":0,"totalScore":0}'`, () => {});

  // Scans Log Table
  db.run(`CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    item_name TEXT,
    confidence REAL,
    bin_type TEXT,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // OTP Verification Table
  db.run(`CREATE TABLE IF NOT EXISTS otps (
    email TEXT PRIMARY KEY,
    code TEXT,
    expires_at INTEGER
  )`);
});

// API Routes

// Email SMTP Configuration for 2-Step Verification
const SMTP_USER = process.env.SMTP_USER || "picknpictr@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "Pick_N_PicTR67";

let transporter = null;
try {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  console.log(`✉️  Gmail SMTP Mailer initialized for: ${SMTP_USER}`);
} catch (e) {
  console.warn("⚠️  Nodemailer not loaded. Install via npm to enable live email delivery.");
}

// 1. Send OTP
app.post('/api/auth/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมล' });
  }

  // Check if email already registered
  db.get(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase()], (err, userRow) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    if (userRow) {
      return res.status(400).json({ success: false, error: 'อีเมลนี้ถูกใช้งานลงทะเบียนแล้ว' });
    }

    // Generate 6-digit OTP
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    const expiresAt = Date.now() + 600000; // 10 minutes

    db.run(`INSERT OR REPLACE INTO otps (email, code, expires_at) VALUES (?, ?, ?)`,
      [email.toLowerCase(), code, expiresAt],
      async (err) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Database error' });
        }

        console.log("\n============================================");
        console.log(`🌱 [ECOTRASH-AR OTP SERVICE]`);
        console.log(`✉️  Sending to: ${email}`);
        console.log(`🔑 Verification Code: ${code}`);
        console.log(`⏱️  Expires in 10 minutes`);
        console.log("============================================\n");

        let emailSent = false;
        let emailError = null;

        if (transporter) {
          try {
            await transporter.sendMail({
              from: '"Pick&PicTrash Support" <picknpictr@gmail.com>',
              to: email.toLowerCase(),
              subject: '🌱 รหัสยืนยันตัวตน (OTP) สมัครสมาชิก Pick&PicTrash',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <span style="font-size: 38px;">🌱</span>
                    <h2 style="color: #3e6b53; margin: 8px 0 4px 0; font-size: 22px;">Pick&PicTrash</h2>
                    <p style="color: #64748b; margin: 0; font-size: 13px;">ระบบสแกนขยะอัจฉริยะเพื่อกรุงเทพฯ สีเขียว</p>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 20px;">
                  <p style="color: #334155; font-size: 15px; line-height: 1.5;">สวัสดีครับ/ค่ะ,<br>ขอบคุณที่ร่วมลงทะเบียนใช้งาน Pick&PicTrash รหัสยืนยันตัวตน (OTP) ของคุณคือ:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <span style="font-family: monospace; font-size: 34px; font-weight: bold; letter-spacing: 6px; color: #3e6b53; padding: 12px 28px; background-color: #f0fdf4; border: 2px solid #b2d8c3; border-radius: 12px; display: inline-block;">${code}</span>
                  </div>
                  <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                    * รหัสนี้มีอายุการใช้งาน 10 นาที หากไม่ได้ทำรายการ โปรดละเว้นอีเมลฉบับนี้<br>
                    ส่งโดยอัตโนมัติจากบัญชีหลัก <strong>picknpictr@gmail.com</strong>
                  </p>
                </div>
              `
            });
            emailSent = true;
            console.log(`✅ Live email successfully dispatched to ${email} via Gmail SMTP!`);
          } catch (mErr) {
            console.error("❌ Live email sending error:", mErr.message);
            emailError = mErr.message;
          }
        }

        res.json({ success: true, emailSent, emailError, simulatedOTP: code });
      }
    );
  });
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
  }

  db.get(`SELECT code, expires_at FROM otps WHERE email = ?`, [email.toLowerCase()], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    if (!row) {
      return res.status(400).json({ success: false, error: 'ไม่พบรหัสยืนยันสำหรับอีเมลนี้' });
    }
    if (Date.now() > row.expires_at) {
      return res.status(400).json({ success: false, error: 'รหัสยืนยันหมดอายุการใช้งานแล้ว' });
    }
    if (row.code !== code) {
      return res.status(400).json({ success: false, error: 'รหัสยืนยันไม่ถูกต้อง' });
    }

    // Delete OTP on successful verification
    db.run(`DELETE FROM otps WHERE email = ?`, [email.toLowerCase()]);
    res.json({ success: true });
  });
});

// 3. Register Account
app.post('/api/auth/register', (req, res) => {
  const { username, real_name, email, password } = req.body;
  if (!username || !real_name || !email || !password) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลและชื่อ-นามสกุลจริงให้ครบถ้วน' });
  }

  db.run(`INSERT INTO users (username, real_name, email, password, is_verified, last_active) VALUES (?, ?, ?, ?, 1, ?)`,
    [username, real_name, email.toLowerCase(), password, Date.now()],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: users.username')) {
          return res.status(400).json({ success: false, error: 'ชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว' });
        }
        if (err.message.includes('UNIQUE constraint failed: users.email')) {
          return res.status(400).json({ success: false, error: 'อีเมลนี้ถูกใช้งานลงทะเบียนแล้ว' });
        }
        return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการบันทึกบัญชี' });
      }

      // Return created user profile
      db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ success: false, error: 'Error fetching created user' });
        }
        delete user.password; // Do not send password back
        res.json({ success: true, user });
      });
    }
  );
});

// 4. Log In
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [identifier, identifier.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    if (!user || user.password !== password) {
      return res.status(400).json({ success: false, error: 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // Update last active timestamp
    db.run(`UPDATE users SET last_active = ? WHERE id = ?`, [Date.now(), user.id]);

    delete user.password; // Secure user details before output
    res.json({ success: true, user });
  });
});

// 4.5. Google Authentication Direct Login/Register
app.post('/api/auth/google-login', (req, res) => {
  const { username, real_name, email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมล' });
  }

  const cleanEmail = email.toLowerCase();
  db.get(`SELECT * FROM users WHERE email = ?`, [cleanEmail], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (user) {
      db.run(`UPDATE users SET last_active = ? WHERE id = ?`, [Date.now(), user.id]);
      delete user.password;
      return res.json({ success: true, user });
    }

    const safeUsername = username || cleanEmail.split('@')[0];
    const safeRealName = real_name || safeUsername;

    db.run(
      `INSERT INTO users (username, real_name, email, password, is_verified, last_active) VALUES (?, ?, ?, ?, 1, ?)`,
      [safeUsername, safeRealName, cleanEmail, 'google_oauth_verified', Date.now()],
      function (insertErr) {
        if (insertErr) {
          const altUsername = safeUsername + "_" + Math.floor(100 + Math.random() * 900);
          db.run(
            `INSERT INTO users (username, real_name, email, password, is_verified, last_active) VALUES (?, ?, ?, ?, 1, ?)`,
            [altUsername, safeRealName, cleanEmail, 'google_oauth_verified', Date.now()],
            function (altErr) {
              if (altErr) return res.status(500).json({ success: false, error: 'User creation failed' });
              db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e, newUser) => {
                if (newUser) delete newUser.password;
                res.json({ success: true, user: newUser });
              });
            }
          );
        } else {
          db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e, newUser) => {
            if (newUser) delete newUser.password;
            res.json({ success: true, user: newUser });
          });
        }
      }
    );
  });
});

// 4.6. Fetch current profile data
app.get('/api/profile/me', (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Missing email' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    delete user.password;
    res.json({ success: true, user });
  });
});

// 5. Sync profile stats
app.post('/api/profile/sync', (req, res) => {
  const { email, username, real_name, level, xp, score, scannedCount, points, treeState, captchaStats, badge, is_verified } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Missing user email' });
  }

  db.run(`UPDATE users SET 
    username = COALESCE(?, username), 
    real_name = COALESCE(?, real_name),
    is_verified = COALESCE(?, is_verified, 1),
    level = COALESCE(?, level), 
    xp = COALESCE(?, xp), 
    score = COALESCE(?, score), 
    scanned_count = COALESCE(?, scanned_count), 
    points = COALESCE(?, points), 
    tree_state = COALESCE(?, tree_state), 
    captcha_stats = COALESCE(?, captcha_stats),
    badge = COALESCE(?, badge), 
    last_active = ? 
    WHERE email = ?`,
    [
      username,
      real_name || null,
      is_verified !== undefined ? is_verified : 1,
      level,
      xp,
      score,
      scannedCount,
      points,
      treeState ? JSON.stringify(treeState) : null,
      captchaStats ? JSON.stringify(captchaStats) : null,
      badge,
      Date.now(),
      email.toLowerCase()
    ],
    function(err) {
      if (err) {
        console.error("Sync error:", err.message);
        return res.status(500).json({ success: false, error: 'Sync failed' });
      }
      res.json({ success: true });
    }
  );
});

// 6. Log Scan Details
app.post('/api/scanner/log-scan', (req, res) => {
  const { email, item_name, confidence, bin_type } = req.body;
  if (!email || !item_name || !bin_type) {
    return res.status(400).json({ success: false, error: 'ข้อมูลสแกนไม่ครบถ้วน' });
  }

  db.run(`INSERT INTO scans (email, item_name, confidence, bin_type) VALUES (?, ?, ?, ?)`,
    [email.toLowerCase(), item_name, confidence, bin_type],
    (err) => {
      if (err) {
        console.error("Scan logging error:", err.message);
        return res.status(500).json({ success: false, error: 'Scan logging failed' });
      }
      res.json({ success: true });
    }
  );
});

// 7. Get Leaderboard (Returns strictly real registered accounts)
app.get('/api/leaderboard', (req, res) => {
  db.all(`SELECT username, real_name, is_verified, level, score, scanned_count, badge FROM users WHERE is_verified = 1 ORDER BY score DESC LIMIT 10`, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    res.json({ success: true, leaderboard: rows || [] });
  });
});

// 8. Admin Dashboard Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "admin-session-secure-token" });
  } else {
    res.status(401).json({ success: false, error: 'รหัสผ่านแอดมินไม่ถูกต้อง' });
  }
});

// 9. Admin Stats (requires authorization header)
app.get('/api/admin/stats', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== 'Bearer admin-session-secure-token') {
    return res.status(401).json({ success: false, error: 'Unauthorized access' });
  }

  // Get total stats
  const stats = {
    totalUsers: 0,
    totalScans: 0,
    activeUsers: 0,
    recyclingSaved: 0,
    scansByCategory: {
      recycling: 0,
      organic: 0,
      hazardous: 0,
      general: 0
    },
    users: [],
    recentScans: []
  };

  // Perform multi-query fetches
  db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
    if (row) stats.totalUsers = row.count;

    db.get(`SELECT COUNT(*) as count FROM scans`, (err, row) => {
      if (row) stats.totalScans = row.count;

      // Count active users (active in the last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      db.get(`SELECT COUNT(*) as count FROM users WHERE last_active > ?`, [oneDayAgo], (err, row) => {
        if (row) stats.activeUsers = row.count;

        // Count recycling items saved
        db.get(`SELECT COUNT(*) as count FROM scans WHERE bin_type = 'recycling'`, (err, row) => {
          if (row) stats.recyclingSaved = row.count;

          // Categorized scans
          db.all(`SELECT bin_type, COUNT(*) as count FROM scans GROUP BY bin_type`, (err, rows) => {
            if (rows) {
              rows.forEach(r => {
                if (stats.scansByCategory.hasOwnProperty(r.bin_type)) {
                  stats.scansByCategory[r.bin_type] = r.count;
                }
              });
            }

            // Fetch users list
            db.all(`SELECT username, email, level, score, scanned_count, last_active FROM users ORDER BY score DESC`, (err, rows) => {
              if (rows) stats.users = rows;

              // Fetch recent scans
              db.all(`SELECT scans.*, users.username FROM scans LEFT JOIN users ON scans.email = users.email ORDER BY scans.scanned_at DESC LIMIT 50`, (err, rows) => {
                if (rows) stats.recentScans = rows;

                res.json({ success: true, stats });
              });
            });
          });
        });
      });
    });
  });
});

// Serve frontend static files
app.use(express.static(__dirname));

// Direct admin access html route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Catch-all route to redirect back to main app
app.get('*', (req, res) => {
  res.redirect('/');
});

// Start listening
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🌱 EcoTrash-AR backend runs successfully!`);
  console.log(`🔗 Address: http://localhost:${PORT}`);
  console.log(`👑 Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`==================================================`);
});
