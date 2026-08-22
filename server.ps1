# EcoTrash-AR Native PowerShell Web Server & Database System
# 100% Pure ASCII version to guarantee parser success on all systems!

$port = 3000
$dbFile = Join-Path $PSScriptRoot "database.json"
$adminPassword = "Peachy_4177"

# 1. Initialize Database File if not present
if (-not (Test-Path $dbFile)) {
    $initDb = @{
        users = @()
        scans = @()
        otps = @()
    }
    $initDb | ConvertTo-Json -Depth 10 | Out-File $dbFile -Encoding utf8
    Write-Host "Initialized database.json" -ForegroundColor Green
}

# Helper to read DB
function Get-Database {
    $content = Get-Content $dbFile -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($content)) {
        return @{ users = @(); scans = @(); otps = @() }
    }
    return ConvertFrom-Json $content
}

# Helper to save DB
function Save-Database {
    param($db)
    $db | ConvertTo-Json -Depth 10 | Out-File $dbFile -Encoding utf8
}

# Helper to send JSON Response
function Send-JSON {
    param($response, $obj, $statusCode = 200)
    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $jsonStr = $obj | ConvertTo-Json -Depth 10 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

# Start HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
} catch {
    Write-Host "Error: Could not start server on port $port. Check if port is already in use." -ForegroundColor Red
    exit 1
}

Write-Host "==================================================" -ForegroundColor Green
Write-Host "EcoTrash-AR Native Server runs successfully!" -ForegroundColor Green
Write-Host "Address: http://localhost:$port" -ForegroundColor Green
Write-Host "Admin Dashboard: http://localhost:$port/admin.html" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C in this console window to stop the server.`n" -ForegroundColor Yellow

# Loop for handling incoming HTTP requests
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        $method = $request.HttpMethod

        # CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($method -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.OutputStream.Close()
        } else {
            # Helper to read POST body JSON
            $bodyJson = $null
            if ($method -eq "POST" -and $request.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()
                $bodyJson = ConvertFrom-Json $bodyText -ErrorAction SilentlyContinue
            }

            Write-Host "[$method] $path" -ForegroundColor Cyan

            # --- ROUTING (if/elseif/else on same line) ---
            
            # 1. API - Send OTP
            if ($path -eq "/api/auth/send-otp" -and $method -eq "POST") {
                $email = $bodyJson.email
                if ([string]::IsNullOrEmpty($email)) {
                    Send-JSON $response @{ success = $false; error = "Please enter your email" } 400
                } else {
                    $db = Get-Database
                    $userExists = $false
                    foreach ($u in $db.users) {
                        if ($u.email.ToLower() -eq $email.ToLower()) { $userExists = $true; break }
                    }

                    if ($userExists) {
                        Send-JSON $response @{ success = $false; error = "This email is already registered" } 400
                    } else {
                        # Generate 6-digit OTP
                        $code = ""
                        for ($i = 0; $i -lt 6; $i++) {
                            $code += (Get-Random -Min 0 -Max 10).ToString()
                        }
                        $expiresAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 600000 # 10 minutes

                        # Filter old OTPs for same email
                        $cleanOtps = @()
                        foreach ($o in $db.otps) {
                            if ($o.email.ToLower() -ne $email.ToLower()) { $cleanOtps += $o }
                        }
                        $cleanOtps += @{ email = $email.ToLower(); code = $code; expires_at = $expiresAt }
                        $db.otps = $cleanOtps
                        Save-Database $db

                        # Print to server logs beautifully
                        Write-Host "`n============================================" -ForegroundColor Green
                        Write-Host "[ECOTRASH-AR OTP SERVICE]" -ForegroundColor Green
                        Write-Host "Sent to: $email" -ForegroundColor Green
                        Write-Host "Verification Code: $code" -ForegroundColor Yellow -BackgroundColor Black
                        Write-Host "Expires in 10 minutes" -ForegroundColor Green
                        Write-Host "============================================`n" -ForegroundColor Green

                        Send-JSON $response @{ success = $true; simulatedOTP = $code }
                    }
                }
            } elseif ($path -eq "/api/auth/verify-otp" -and $method -eq "POST") {
                # 2. API - Verify OTP
                $email = $bodyJson.email
                $code = $bodyJson.code
                if ([string]::IsNullOrEmpty($email) -or [string]::IsNullOrEmpty($code)) {
                    Send-JSON $response @{ success = $false; error = "Incomplete details provided" } 400
                } else {
                    $db = Get-Database
                    $matched = $false
                    $expired = $false
                    
                    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    $cleanOtps = @()
                    
                    foreach ($o in $db.otps) {
                        if ($o.email.ToLower() -eq $email.ToLower()) {
                            if ($now -gt $o.expires_at) { $expired = $true }
                            elseif ($o.code -eq $code) { $matched = $true }
                        } else {
                            $cleanOtps += $o
                        }
                    }

                    if ($matched -and -not $expired) {
                        # Save database excluding verified OTP
                        $db.otps = $cleanOtps
                        Save-Database $db
                        Send-JSON $response @{ success = $true }
                    } else {
                        $err = "Invalid verification code"
                        if ($expired) { $err = "Verification code expired" }
                        Send-JSON $response @{ success = $false; error = $err } 400
                    }
                }
            } elseif ($path -eq "/api/auth/register" -and $method -eq "POST") {
                # 3. API - Register Account
                $username = $bodyJson.username
                $email = $bodyJson.email
                $password = $bodyJson.password

                if ([string]::IsNullOrEmpty($username) -or [string]::IsNullOrEmpty($email) -or [string]::IsNullOrEmpty($password)) {
                    Send-JSON $response @{ success = $false; error = "Please fill in all fields" } 400
                } else {
                    $db = Get-Database
                    $usernameExists = $false
                    $emailExists = $false
                    foreach ($u in $db.users) {
                        if ($u.username.ToLower() -eq $username.ToLower()) { $usernameExists = $true }
                        if ($u.email.ToLower() -eq $email.ToLower()) { $emailExists = $true }
                    }

                    if ($usernameExists) {
                        Send-JSON $response @{ success = $false; error = "Username already exists" } 400
                    } elseif ($emailExists) {
                        Send-JSON $response @{ success = $false; error = "Email already registered" } 400
                    } else {
                        # Create User Record
                        $newUser = @{
                            id = $db.users.Count + 1
                            username = $username
                            email = $email.ToLower()
                            password = $password
                            level = 1
                            xp = 0
                            score = 0
                            scanned_count = 0
                            points = 0
                            tree_state = '{"waterCount":0,"selectedFruit":"apple"}'
                            badge = "Lv. 1 BKK Citizen"
                            last_active = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            created_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                        }

                        $db.users += $newUser
                        Save-Database $db

                        # Strip password before returning
                        $userClean = $newUser.Clone()
                        $userClean.Remove("password")

                        Send-JSON $response @{ success = $true; user = $userClean }
                    }
                }
            } elseif ($path -eq "/api/auth/login" -and $method -eq "POST") {
                # 4. API - Login
                $identifier = $bodyJson.identifier
                $password = $bodyJson.password

                if ([string]::IsNullOrEmpty($identifier) -or [string]::IsNullOrEmpty($password)) {
                    Send-JSON $response @{ success = $false; error = "Please fill in all fields" } 400
                } else {
                    $db = Get-Database
                    $foundUser = $null
                    for ($i = 0; $i -lt $db.users.Count; $i++) {
                        $u = $db.users[$i]
                        if (($u.username.ToLower() -eq $identifier.ToLower() -or $u.email.ToLower() -eq $identifier.ToLower()) -and $u.password -eq $password) {
                            # Update active time
                            $u.last_active = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            $db.users[$i] = $u
                            $foundUser = $u
                            break
                        }
                    }

                    if ($foundUser) {
                        Save-Database $db
                        $userClean = $foundUser.Clone()
                        $userClean.Remove("password")
                        Send-JSON $response @{ success = $true; user = $userClean }
                    } else {
                        Send-JSON $response @{ success = $false; error = "Invalid username/email or password" } 400
                    }
                }
            } elseif ($path -eq "/api/auth/google-login" -and $method -eq "POST") {
                # 4.5. API - Google Direct Login / Register
                $username = $bodyJson.username
                $realName = $bodyJson.real_name
                $email = $bodyJson.email
                if ([string]::IsNullOrEmpty($email)) {
                    Send-JSON $response @{ success = $false; error = "Please enter email" } 400
                } else {
                    $cleanEmail = $email.ToLower()
                    $db = Get-Database
                    $existingUser = $null
                    for ($i = 0; $i -lt $db.users.Count; $i++) {
                        if ($db.users[$i].email.ToLower() -eq $cleanEmail) {
                            $db.users[$i].last_active = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            $existingUser = $db.users[$i]
                            break
                        }
                    }

                    if ($existingUser) {
                        Save-Database $db
                        $userClean = $existingUser.Clone()
                        $userClean.Remove("password")
                        Send-JSON $response @{ success = $true; user = $userClean }
                    } else {
                        $safeUsername = if ([string]::IsNullOrEmpty($username)) { $cleanEmail.Split('@')[0] } else { $username }
                        $safeRealName = if ([string]::IsNullOrEmpty($realName)) { $safeUsername } else { $realName }

                        $finalUsername = $safeUsername
                        foreach ($u in $db.users) {
                            if ($u.username.ToLower() -eq $safeUsername.ToLower()) {
                                $finalUsername = $safeUsername + "_" + (Get-Random -Min 100 -Max 999)
                                break
                            }
                        }

                        $newUser = @{
                            id = $db.users.Count + 1
                            username = $finalUsername
                            real_name = $safeRealName
                            email = $cleanEmail
                            password = "google_oauth_verified"
                            is_verified = 1
                            level = 1
                            xp = 0
                            score = 0
                            scanned_count = 0
                            points = 0
                            tree_state = '{"waterCount":0,"selectedFruit":"apple"}'
                            captcha_stats = '{"played":0,"highscore":0,"totalScore":0}'
                            badge = "Lv. 1 BKK Citizen"
                            last_active = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            created_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                        }

                        $db.users += $newUser
                        Save-Database $db

                        $userClean = $newUser.Clone()
                        $userClean.Remove("password")
                        Send-JSON $response @{ success = $true; user = $userClean }
                    }
                }
            } elseif ($path -eq "/api/profile/me" -and $method -eq "GET") {
                # 4.6. API - Fetch Profile by Email
                $email = $request.QueryString["email"]
                if ([string]::IsNullOrEmpty($email)) {
                    Send-JSON $response @{ success = $false; error = "Missing email parameter" } 400
                } else {
                    $db = Get-Database
                    $found = $null
                    foreach ($u in $db.users) {
                        if ($u.email.ToLower() -eq $email.ToLower()) {
                            $found = $u
                            break
                        }
                    }
                    if ($found) {
                        $userClean = $found.Clone()
                        $userClean.Remove("password")
                        Send-JSON $response @{ success = $true; user = $userClean }
                    } else {
                        Send-JSON $response @{ success = $false; error = "User profile not found" } 404
                    }
                }
            } elseif ($path -eq "/api/profile/sync" -and $method -eq "POST") {
                # 5. API - Sync profile stats
                $email = $bodyJson.email
                if ([string]::IsNullOrEmpty($email)) {
                    Send-JSON $response @{ success = $false; error = "Missing user email" } 400
                } else {
                    $db = Get-Database
                    $synced = $false
                    for ($i = 0; $i -lt $db.users.Count; $i++) {
                        if ($db.users[$i].email.ToLower() -eq $email.ToLower()) {
                            # Update stats
                            $db.users[$i].username = $bodyJson.username
                            $db.users[$i].level = $bodyJson.level
                            $db.users[$i].xp = $bodyJson.xp
                            $db.users[$i].score = $bodyJson.score
                            $db.users[$i].scanned_count = $bodyJson.scannedCount
                            $db.users[$i].points = $bodyJson.points
                            $db.users[$i].tree_state = $bodyJson.treeState | ConvertTo-Json -Compress
                            $db.users[$i].badge = $bodyJson.badge
                            $db.users[$i].last_active = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            $synced = $true
                            break
                        }
                    }

                    if ($synced) {
                        Save-Database $db
                        Send-JSON $response @{ success = $true }
                    } else {
                        Send-JSON $response @{ success = $false; error = "User profile not found for syncing" } 404
                    }
                }
            } elseif ($path -eq "/api/scanner/log-scan" -and $method -eq "POST") {
                # 6. API - Log Scan
                $email = $bodyJson.email
                $itemName = $bodyJson.item_name
                $binType = $bodyJson.bin_type
                $confidence = $bodyJson.confidence

                if ([string]::IsNullOrEmpty($email) -or [string]::IsNullOrEmpty($itemName) -or [string]::IsNullOrEmpty($binType)) {
                    Send-JSON $response @{ success = $false; error = "Incomplete scan data" } 400
                } else {
                    $db = Get-Database
                    $newScan = @{
                        id = $db.scans.Count + 1
                        email = $email.ToLower()
                        item_name = $itemName
                        confidence = $confidence
                        bin_type = $binType
                        scanned_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                    }
                    $db.scans += $newScan
                    Save-Database $db
                    
                    Send-JSON $response @{ success = $true }
                }
            } elseif ($path -eq "/api/leaderboard" -and $method -eq "GET") {
                # 7. API - Get Leaderboard
                $db = Get-Database
                
                $leaderboard = @()
                foreach ($u in $db.users) {
                    $leaderboard += @{
                        username = $u.username
                        level = $u.level
                        score = $u.score
                        scanned_count = $u.scanned_count
                        badge = $u.badge
                    }
                }

                # Fallback mock competitors
                $mockCompetitors = @(
                    @{ username = "Somchai_GreenBKK"; level = 6; score = 950; scanned_count = 19; badge = "Lv. 6 BKK Tree Keeper" }
                    @{ username = "Pim_EcoBangkok"; level = 5; score = 720; scanned_count = 14; badge = "Lv. 5 BKK Eco Guardian" }
                    @{ username = "Anan_CleanAir"; level = 4; score = 580; scanned_count = 11; badge = "Lv. 4 BKK Eco Guardian" }
                    @{ username = "Kanya_GreenScout"; level = 3; score = 410; scanned_count = 8; badge = "Lv. 3 BKK Green Scout" }
                    @{ username = "Veera_Recycle"; level = 2; score = 290; scanned_count = 6; badge = "Lv. 2 BKK Green Scout" }
                    @{ username = "Somsak_SaveWater"; level = 2; score = 240; scanned_count = 5; badge = "Lv. 2 BKK Green Scout" }
                    @{ username = "Nattaporn_Eco"; level = 1; score = 130; scanned_count = 3; badge = "Lv. 1 BKK Citizen" }
                    @{ username = "Chai_CleanUp"; level = 1; score = 80; scanned_count = 2; badge = "Lv. 1 BKK Citizen" }
                    @{ username = "BKK_EcoBeginner"; level = 1; score = 50; scanned_count = 1; badge = "Lv. 1 BKK Citizen" }
                )

                # Fill up to top 10 rows
                foreach ($mock in $mockCompetitors) {
                    if ($leaderboard.Count -ge 10) { break }
                    
                    $conflicts = $false
                    foreach ($l in $leaderboard) {
                        if ($l.username.ToLower() -eq $mock.username.ToLower()) { $conflicts = $true; break }
                    }
                    
                    if (-not $conflicts) {
                        $leaderboard += $mock
                    }
                }

                # Sort by score desc
                $sortedLeaderboard = $leaderboard | Sort-Object -Property score -Descending
                Send-JSON $response @{ success = $true; leaderboard = $sortedLeaderboard }
            } elseif ($path -eq "/api/admin/login" -and $method -eq "POST") {
                # 8. API - Admin Login
                $password = $bodyJson.password
                if ($password -eq $adminPassword) {
                    Send-JSON $response @{ success = $true; token = "admin-session-secure-token" }
                } else {
                    Send-JSON $response @{ success = $false; error = "Invalid admin passcode" } 401
                }
            } elseif ($path -eq "/api/admin/stats" -and $method -eq "GET") {
                # 9. API - Admin Stats
                $authHeader = $request.Headers.Get("Authorization")
                if ([string]::IsNullOrEmpty($authHeader) -or $authHeader -ne "Bearer admin-session-secure-token") {
                    Send-JSON $response @{ success = $false; error = "Unauthorized access" } 401
                } else {
                    $db = Get-Database
                    
                    # Active Users (last 24 hours)
                    $oneDayAgo = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 86400000
                    $activeCount = 0
                    foreach ($u in $db.users) {
                        if ($u.last_active -gt $oneDayAgo) { $activeCount++ }
                    }

                    # Scans categorized metrics
                    $recyclingCount = 0
                    $organicCount = 0
                    $hazardousCount = 0
                    $generalCount = 0
                    foreach ($s in $db.scans) {
                        if ($s.bin_type -eq "recycling") { $recyclingCount++ }
                        elseif ($s.bin_type -eq "organic") { $organicCount++ }
                        elseif ($s.bin_type -eq "hazardous") { $hazardousCount++ }
                        elseif ($s.bin_type -eq "general") { $generalCount++ }
                    }

                    # Recent scans (limit 50, sorted desc by scanned_at)
                    $recent = @()
                    $orderedScans = $db.scans | Sort-Object -Property scanned_at -Descending
                    foreach ($s in $orderedScans) {
                        if ($recent.Count -ge 50) { break }
                        
                        # Fetch username for email
                        $username = "Simulator"
                        foreach ($u in $db.users) {
                            if ($u.email.ToLower() -eq $s.email.ToLower()) {
                                $username = $u.username
                                break
                            }
                        }
                        
                        $recent += @{
                            id = $s.id
                            email = $s.email
                            item_name = $s.item_name
                            confidence = $s.confidence
                            bin_type = $s.bin_type
                            scanned_at = $s.scanned_at
                            username = $username
                        }
                    }

                    # Users sorted by score desc
                    $sortedUsers = @()
                    $orderedUsers = $db.users | Sort-Object -Property score -Descending
                    foreach ($u in $orderedUsers) {
                        $userObj = @{
                            id = $u.id
                            username = $u.username
                            email = $u.email
                            level = $u.level
                            score = $u.score
                            scanned_count = $u.scanned_count
                            last_active = $u.last_active
                        }
                        $sortedUsers += $userObj
                    }

                    $stats = @{
                        totalUsers = $db.users.Count
                        totalScans = $db.scans.Count
                        activeUsers = $activeCount
                        recyclingSaved = $recyclingCount
                        scansByCategory = @{
                            recycling = $recyclingCount
                            organic = $organicCount
                            hazardous = $hazardousCount
                            general = $generalCount
                        }
                        users = $sortedUsers
                        recentScans = $recent
                    }

                    Send-JSON $response @{ success = $true; stats = $stats }
                }
            } else {
                # 10. Serve Static Files
                # Translate URL path to local file path
                $cleanPath = $path.Replace("/", "\").TrimStart("\")
                if ([string]::IsNullOrEmpty($cleanPath)) {
                    $cleanPath = "index.html"
                }
                $filePath = Join-Path $PSScriptRoot $cleanPath

                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = "application/octet-stream"
                    switch ($ext) {
                        ".html" { $contentType = "text/html; charset=utf-8" }
                        ".css"  { $contentType = "text/css; charset=utf-8" }
                        ".js"   { $contentType = "application/javascript; charset=utf-8" }
                        ".png"  { $contentType = "image/png" }
                        ".jpg"  { $contentType = "image/jpeg" }
                        ".jpeg" { $contentType = "image/jpeg" }
                        ".json" { $contentType = "application/json; charset=utf-8" }
                    }
                    
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    
                    $response.StatusCode = 200
                    $response.ContentType = $contentType
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.OutputStream.Close()
                } else {
                    # Redirect fallback for SPA routing
                    $response.Redirect("http://localhost:$port/")
                    $response.OutputStream.Close()
                }
            }
        }
        
    } catch {
        Write-Host "Server Error: $_" -ForegroundColor Red
        if ($null -ne $response) {
            try {
                $response.StatusCode = 500
                $response.OutputStream.Close()
            } catch {}
        }
    }
}
