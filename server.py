import json
import os
import random
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

PORT = 3000
DB_FILE = os.path.join(os.path.dirname(__file__), "database.json")
ADMIN_PASSWORD = "Peachy_4177"

def get_db():
    if not os.path.exists(DB_FILE):
        init_db = {"users": [], "scans": [], "otps": []}
        save_db(init_db)
        return init_db
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"users": [], "scans": [], "otps": []}

def save_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class EcoRequestHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body_bytes = self.rfile.read(content_length)
            try:
                return json.loads(body_bytes.decode('utf-8'))
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/profile/me":
            email_list = query.get("email", [])
            email = email_list[0] if email_list else None
            if not email:
                return self.send_json({"success": False, "error": "Missing email"}, 400)
            db = get_db()
            for u in db.get("users", []):
                if u.get("email", "").lower() == email.lower():
                    u_clean = dict(u)
                    u_clean.pop("password", None)
                    return self.send_json({"success": True, "user": u_clean})
            return self.send_json({"success": False, "error": "User profile not found"}, 404)

        elif path == "/api/leaderboard":
            db = get_db()
            leaderboard = []
            for u in db.get("users", []):
                leaderboard.append({
                    "username": u.get("username"),
                    "real_name": u.get("real_name", u.get("username")),
                    "is_verified": u.get("is_verified", 1),
                    "level": u.get("level", 1),
                    "score": u.get("score", 0),
                    "scanned_count": u.get("scanned_count", 0),
                    "badge": str(u.get("badge", "1"))
                })
            
            mock_competitors = [
                {"username": "Somchai_GreenBKK", "level": 6, "score": 950, "scanned_count": 19, "badge": "Lv. 6 BKK Tree Keeper"},
                {"username": "Pim_EcoBangkok", "level": 5, "score": 720, "scanned_count": 14, "badge": "Lv. 5 BKK Eco Guardian"},
                {"username": "Anan_CleanAir", "level": 4, "score": 580, "scanned_count": 11, "badge": "Lv. 4 BKK Eco Guardian"},
                {"username": "Kanya_GreenScout", "level": 3, "score": 410, "scanned_count": 8, "badge": "Lv. 3 BKK Green Scout"}
            ]

            existing_names = {l["username"].lower() for l in leaderboard}
            for mock in mock_competitors:
                if len(leaderboard) >= 10:
                    break
                if mock["username"].lower() not in existing_names:
                    leaderboard.append(mock)

            leaderboard.sort(key=lambda x: x.get("score", 0), reverse=True)
            return self.send_json({"success": True, "leaderboard": leaderboard})

        elif path == "/api/admin/stats":
            auth_header = self.headers.get("Authorization")
            if auth_header != "Bearer admin-session-secure-token":
                return self.send_json({"success": False, "error": "Unauthorized access"}, 401)

            db = get_db()
            one_day_ago = int(time.time() * 1000) - 86400000
            users = db.get("users", [])
            scans = db.get("scans", [])

            active_users = sum(1 for u in users if u.get("last_active", 0) > one_day_ago)
            scans_cat = {"recycling": 0, "organic": 0, "hazardous": 0, "general": 0}
            for s in scans:
                bt = s.get("bin_type", "general")
                if bt in scans_cat:
                    scans_cat[bt] += 1

            recent_scans = sorted(scans, key=lambda s: s.get("scanned_at", ""), reverse=True)[:50]
            users_sorted = sorted(users, key=lambda u: u.get("score", 0), reverse=True)
            clean_users = []
            for u in users_sorted:
                uc = dict(u)
                uc.pop("password", None)
                clean_users.append(uc)

            stats = {
                "totalUsers": len(users),
                "totalScans": len(scans),
                "activeUsers": active_users,
                "recyclingSaved": scans_cat["recycling"],
                "scansByCategory": scans_cat,
                "users": clean_users,
                "recentScans": recent_scans
            }
            return self.send_json({"success": True, "stats": stats})

        # Serve static files
        clean_path = path.lstrip("/")
        if not clean_path:
            clean_path = "index.html"

        file_path = os.path.join(os.path.dirname(__file__), clean_path)
        if os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            mimetypes = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".json": "application/json; charset=utf-8"
            }
            content_type = mimetypes.get(ext, "application/octet-stream")
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        # Redirect to / for unknown path
        self.send_response(302)
        self.send_header("Location", "/")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path == "/api/auth/send-otp":
            email = body.get("email")
            if not email:
                return self.send_json({"success": False, "error": "กรุณากรอกอีเมล"}, 400)
            db = get_db()
            if any(u.get("email", "").lower() == email.lower() for u in db.get("users", [])):
                return self.send_json({"success": False, "error": "อีเมลนี้ถูกใช้งานลงทะเบียนแล้ว"}, 400)

            code = "".join([str(random.randint(0, 9)) for _ in range(6)])
            expires_at = int(time.time() * 1000) + 600000

            db["otps"] = [o for o in db.get("otps", []) if o.get("email", "").lower() != email.lower()]
            db["otps"].append({"email": email.lower(), "code": code, "expires_at": expires_at})
            save_db(db)
            print(f"\n[OTP] Sent to {email}: {code}\n")
            return self.send_json({"success": True, "simulatedOTP": code})

        elif path == "/api/auth/verify-otp":
            email = body.get("email")
            code = body.get("code")
            if not email or not code:
                return self.send_json({"success": False, "error": "ข้อมูลไม่ครบถ้วน"}, 400)
            db = get_db()
            now = int(time.time() * 1000)
            matched = False
            expired = False
            clean_otps = []
            for o in db.get("otps", []):
                if o.get("email", "").lower() == email.lower():
                    if now > o.get("expires_at", 0):
                        expired = True
                    elif str(o.get("code")).strip() == str(code).strip():
                        matched = True
                else:
                    clean_otps.append(o)

            if matched and not expired:
                db["otps"] = clean_otps
                save_db(db)
                return self.send_json({"success": True})
            else:
                err = "รหัสยืนยันหมดอายุ" if expired else "รหัสยืนยันไม่ถูกต้อง"
                return self.send_json({"success": False, "error": err}, 400)

        elif path == "/api/auth/register":
            username = body.get("username")
            real_name = body.get("real_name", username)
            email = body.get("email")
            password = body.get("password")

            if not username or not email or not password:
                return self.send_json({"success": False, "error": "กรุณากรอกข้อมูลให้ครบถ้วน"}, 400)

            db = get_db()
            users = db.get("users", [])
            if any(u.get("username", "").lower() == username.lower() for u in users):
                return self.send_json({"success": False, "error": "ชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว"}, 400)
            if any(u.get("email", "").lower() == email.lower() for u in users):
                return self.send_json({"success": False, "error": "อีเมลนี้ถูกใช้งานลงทะเบียนแล้ว"}, 400)

            new_user = {
                "id": len(users) + 1,
                "username": username,
                "real_name": real_name,
                "email": email.lower(),
                "password": password,
                "is_verified": 1,
                "level": 1,
                "xp": 0,
                "score": 0,
                "scanned_count": 0,
                "points": 0,
                "tree_state": '{"waterCount":0,"selectedFruit":"apple"}',
                "captcha_stats": '{"played":0,"highscore":0,"totalScore":0}',
                "badge": "1",
                "last_active": int(time.time() * 1000),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            users.append(new_user)
            db["users"] = users
            save_db(db)

            clean_u = dict(new_user)
            clean_u.pop("password", None)
            return self.send_json({"success": True, "user": clean_u})

        elif path == "/api/auth/login":
            identifier = body.get("identifier")
            password = body.get("password")
            if not identifier or not password:
                return self.send_json({"success": False, "error": "กรุณากรอกข้อมูลให้ครบถ้วน"}, 400)

            db = get_db()
            users = db.get("users", [])
            for u in users:
                if (u.get("username", "").lower() == identifier.lower() or u.get("email", "").lower() == identifier.lower()) and u.get("password") == password:
                    u["last_active"] = int(time.time() * 1000)
                    save_db(db)
                    clean_u = dict(u)
                    clean_u.pop("password", None)
                    return self.send_json({"success": True, "user": clean_u})
            return self.send_json({"success": False, "error": "ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง"}, 400)

        elif path == "/api/auth/google-login":
            username = body.get("username")
            real_name = body.get("real_name")
            email = body.get("email")
            if not email:
                return self.send_json({"success": False, "error": "กรุณากรอกอีเมล"}, 400)

            clean_email = email.lower()
            db = get_db()
            users = db.get("users", [])
            for u in users:
                if u.get("email", "").lower() == clean_email:
                    u["last_active"] = int(time.time() * 1000)
                    save_db(db)
                    clean_u = dict(u)
                    clean_u.pop("password", None)
                    return self.send_json({"success": True, "user": clean_u})

            safe_user = username if username else clean_email.split("@")[0]
            safe_real = real_name if real_name else safe_user

            final_user = safe_user
            if any(u.get("username", "").lower() == safe_user.lower() for u in users):
                final_user = f"{safe_user}_{random.randint(100, 999)}"

            new_user = {
                "id": len(users) + 1,
                "username": final_user,
                "real_name": safe_real,
                "email": clean_email,
                "password": "google_oauth_verified",
                "is_verified": 1,
                "level": 1,
                "xp": 0,
                "score": 0,
                "scanned_count": 0,
                "points": 0,
                "tree_state": '{"waterCount":0,"selectedFruit":"apple"}',
                "captcha_stats": '{"played":0,"highscore":0,"totalScore":0}',
                "badge": "1",
                "last_active": int(time.time() * 1000),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            users.append(new_user)
            db["users"] = users
            save_db(db)

            clean_u = dict(new_user)
            clean_u.pop("password", None)
            return self.send_json({"success": True, "user": clean_u})

        elif path == "/api/profile/sync":
            email = body.get("email")
            if not email:
                return self.send_json({"success": False, "error": "Missing email"}, 400)
            db = get_db()
            synced = False
            for u in db.get("users", []):
                if u.get("email", "").lower() == email.lower():
                    if body.get("username"): u["username"] = body.get("username")
                    if body.get("real_name"): u["real_name"] = body.get("real_name")
                    if "level" in body: u["level"] = body.get("level")
                    if "xp" in body: u["xp"] = body.get("xp")
                    if "score" in body: u["score"] = body.get("score")
                    if "scannedCount" in body: u["scanned_count"] = body.get("scannedCount")
                    if "points" in body: u["points"] = body.get("points")
                    if "treeState" in body: u["tree_state"] = json.dumps(body.get("treeState"))
                    if "captchaStats" in body: u["captcha_stats"] = json.dumps(body.get("captchaStats"))
                    if "badge" in body: u["badge"] = str(body.get("badge"))
                    u["last_active"] = int(time.time() * 1000)
                    synced = True
                    break

            if synced:
                save_db(db)
                return self.send_json({"success": True})
            return self.send_json({"success": False, "error": "Profile not found"}, 404)

        elif path == "/api/scanner/log-scan":
            email = body.get("email")
            item_name = body.get("item_name")
            bin_type = body.get("bin_type")
            confidence = body.get("confidence", 1.0)
            if not email or not item_name or not bin_type:
                return self.send_json({"success": False, "error": "Incomplete scan data"}, 400)

            db = get_db()
            scans = db.get("scans", [])
            new_scan = {
                "id": len(scans) + 1,
                "email": email.lower(),
                "item_name": item_name,
                "confidence": confidence,
                "bin_type": bin_type,
                "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            scans.append(new_scan)
            db["scans"] = scans
            save_db(db)
            return self.send_json({"success": True})

        elif path == "/api/admin/login":
            password = body.get("password")
            if password == ADMIN_PASSWORD:
                return self.send_json({"success": True, "token": "admin-session-secure-token"})
            return self.send_json({"success": False, "error": "รหัสผ่านแอดมินไม่ถูกต้อง"}, 401)

        return self.send_json({"success": False, "error": "Endpoint not found"}, 404)

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), EcoRequestHandler)
    print("==================================================")
    print(f"EcoTrash-AR Python Server active!")
    print(f"Local PC: http://localhost:{PORT}")
    print(f"Wi-Fi Network: http://10.7.42.212:{PORT}")
    print(f"Admin Dashboard: http://localhost:{PORT}/admin.html")
    print("==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()
