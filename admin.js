let adminToken = sessionStorage.getItem('admin_token') || null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind Buttons
  const btnUnlock = document.getElementById('btn-unlock');
  const btnLockHeader = document.getElementById('btn-lock-header');
  const passcodeField = document.getElementById('admin-passcode');

  if (btnUnlock) btnUnlock.addEventListener('click', attemptUnlock);
  if (btnLockHeader) btnLockHeader.addEventListener('click', lockConsole);
  if (passcodeField) {
    passcodeField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        attemptUnlock();
      }
    });
  }

  // Auto-login check
  if (adminToken) {
    showDashboard();
  }
});

/**
 * Sends entered passcode to server for unlock validation
 */
async function attemptUnlock() {
  const passcode = document.getElementById('admin-passcode').value;
  const errorDiv = document.getElementById('lock-error');
  
  if (errorDiv) errorDiv.textContent = "";

  if (!passcode) {
    if (errorDiv) errorDiv.textContent = "กรุณากรอกรหัสผ่าน";
    return;
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: passcode })
    });
    const data = await res.json();

    if (res.ok && data.success && data.token) {
      adminToken = data.token;
      sessionStorage.setItem('admin_token', adminToken);
      showDashboard();
    } else {
      if (errorDiv) errorDiv.textContent = data.error || "รหัสผ่านไม่ถูกต้อง";
    }
  } catch (err) {
    console.error("Auth server connection failed:", err);
    if (errorDiv) errorDiv.textContent = "การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว";
  }
}

/**
 * Transitions view into dashboard metrics display
 */
function showDashboard() {
  const lockOverlay = document.getElementById('lock-overlay');
  const dashboardMain = document.getElementById('dashboard-main');

  if (lockOverlay) lockOverlay.style.display = 'none';
  if (dashboardMain) dashboardMain.style.display = 'block';

  // Load initial statistics
  fetchStats();

  // Set up stats polling every 5 seconds for live telemetry feel
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(fetchStats, 5000);
}

/**
 * Logs administrator session out and blocks view
 */
function lockConsole() {
  adminToken = null;
  sessionStorage.removeItem('admin_token');
  if (pollInterval) clearInterval(pollInterval);
  window.location.reload();
}

/**
 * Fetches analytics stats dataset from Express API
 */
async function fetchStats() {
  if (!adminToken) return;

  try {
    const res = await fetch('/api/admin/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (res.status === 401) {
      // Session expired or invalid token
      lockConsole();
      return;
    }

    const data = await res.json();
    if (data.success && data.stats) {
      renderStats(data.stats);
    }
  } catch (e) {
    console.error("Failed to poll server stats:", e);
  }
}

/**
 * Renders statistical metrics, progress bars and logs on screen
 */
function renderStats(stats) {
  // 1. Overall Metrics Cards
  document.getElementById('val-total-users').textContent = stats.totalUsers;
  document.getElementById('val-total-scans').textContent = stats.totalScans;
  document.getElementById('val-active-users').textContent = stats.activeUsers;
  document.getElementById('val-recycling-saved').textContent = stats.recyclingSaved;

  // 2. Category Distribution Charts
  const total = stats.totalScans || 1;
  const recyclingCount = stats.scansByCategory.recycling || 0;
  const organicCount = stats.scansByCategory.organic || 0;
  const hazardousCount = stats.scansByCategory.hazardous || 0;
  const generalCount = stats.scansByCategory.general || 0;

  // Calculate percentages
  const recyclingPct = (recyclingCount / total) * 100;
  const organicPct = (organicCount / total) * 100;
  const hazardousPct = (hazardousCount / total) * 100;
  const generalPct = (generalCount / total) * 100;

  // Set Bar widths
  document.getElementById('bar-fill-recycling').style.width = `${recyclingPct}%`;
  document.getElementById('bar-fill-organic').style.width = `${organicPct}%`;
  document.getElementById('bar-fill-hazardous').style.width = `${hazardousPct}%`;
  document.getElementById('bar-fill-general').style.width = `${generalPct}%`;

  // Set Bar descriptions
  document.getElementById('val-bar-recycling').textContent = `${recyclingCount} ชิ้น (${Math.round(recyclingPct)}%)`;
  document.getElementById('val-bar-organic').textContent = `${organicCount} ชิ้น (${Math.round(organicPct)}%)`;
  document.getElementById('val-bar-hazardous').textContent = `${hazardousCount} ชิ้น (${Math.round(hazardousPct)}%)`;
  document.getElementById('val-bar-general').textContent = `${generalCount} ชิ้น (${Math.round(generalPct)}%)`;

  // 3. Registered Users Table
  const usersBody = document.getElementById('table-users-body');
  if (usersBody) {
    usersBody.innerHTML = "";
    if (stats.users.length === 0) {
      usersBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#666;">ยังไม่มีผู้ใช้งานสมัครสมาชิก</td></tr>`;
    } else {
      stats.users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;">👤 ${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td><span class="badge-cell">Lv. ${user.level}</span></td>
          <td style="font-family:'Chakra Petch',monospace; font-weight:700;">${user.score} XP</td>
        `;
        usersBody.appendChild(tr);
      });
    }
  }

  // 4. Scans Log Table
  const scansBody = document.getElementById('table-scans-body');
  if (scansBody) {
    scansBody.innerHTML = "";
    if (stats.recentScans.length === 0) {
      scansBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;">ยังไม่พบบันทึกกิจกรรมสแกนขยะ</td></tr>`;
    } else {
      stats.recentScans.forEach(scan => {
        const binLabels = {
          recycling: 'รีไซเคิล',
          organic: 'อินทรีย์',
          hazardous: 'อันตราย',
          general: 'ทั่วไป'
        };
        const label = binLabels[scan.bin_type] || scan.bin_type;
        const confidencePct = Math.round(scan.confidence * 100);
        const scanTime = formatTime(scan.scanned_at);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;">${escapeHtml(scan.username || 'ระบบจำลอง')}</td>
          <td>🗑️ ${escapeHtml(scan.item_name)}</td>
          <td><span class="bin-badge bin-badge-${scan.bin_type}">${label}</span></td>
          <td class="confidence-val" style="color: ${scan.confidence > 0.8 ? 'green' : 'orange'}">${confidencePct}%</td>
          <td style="color:#555; font-size:12px;">${scanTime}</td>
        `;
        scansBody.appendChild(tr);
      });
    }
  }

  // Re-create icons if Lucide is available
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Helper to escape HTML tags to prevent XSS injections in console tables
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

/**
 * Formats database ISO time strings into localized friendly displays
 */
function formatTime(isoStr) {
  try {
    const d = new Date(isoStr);
    // Adjust for Local/Thai Time format
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           " (" + d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ")";
  } catch (e) {
    return isoStr;
  }
}
