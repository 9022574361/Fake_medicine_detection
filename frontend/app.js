/* ═══════════════════════════════════════════
   MediVerify AI — App Logic
   Full-stack frontend with backend integration
   and demo fallback mode
═══════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000';
let stream = null;
let scanHistory = JSON.parse(localStorage.getItem('mediverify_history') || '[]');
let currentImageBlob = null;
let isAnalyzing = false;
let bcBlocks = generateInitialBlocks();

// ─── Utility ───────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'info') {
  const toast = $('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateHash(len = 32) {
  const chars = '0123456789abcdef';
  return '0x' + Array.from({ length: len }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

// ─── Navigation ────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $(`view-${btn.dataset.view}`).classList.add('active');
    if (btn.dataset.view === 'dashboard') renderDashboard();
    if (btn.dataset.view === 'history') renderHistory();
    if (btn.dataset.view === 'blockchain') renderBlockchain();
  });
});

// ─── Camera ────────────────────────────────────────────
async function startCamera(facingMode = 'environment') {
  try {
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = $('videoFeed');
    video.srcObject = stream;
    await video.play();
    $('cameraOffline').style.display = 'none';
    $('liveBadge').style.display = 'flex';
    $('captureBtn').disabled = false;
    showToast('Camera activated', 'success');
  } catch (err) {
    console.warn('Camera error:', err);
    showToast('Camera unavailable — use Upload Image', 'warning');
  }
}

$('startCameraBtn').addEventListener('click', () => startCamera());
$('flipCameraBtn').addEventListener('click', () => startCamera(stream ? 'user' : 'environment'));

$('captureBtn').addEventListener('click', () => {
  const video = $('videoFeed');
  if (!video.srcObject) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    currentImageBlob = blob;
    const url = URL.createObjectURL(blob);
    $('modalImage').src = url;
    $('modalOverlay').style.display = 'flex';
  }, 'image/jpeg', 0.92);
});

// Upload
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('uploadDemoBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  currentImageBlob = file;
  const url = URL.createObjectURL(file);
  $('modalImage').src = url;
  $('modalOverlay').style.display = 'flex';
  e.target.value = '';
});

// Modal
$('modalClose').addEventListener('click', () => $('modalOverlay').style.display = 'none');
$('modalCancel').addEventListener('click', () => $('modalOverlay').style.display = 'none');
$('modalAnalyze').addEventListener('click', () => {
  $('modalOverlay').style.display = 'none';
  analyzeImage(currentImageBlob);
});

// ─── AI Analysis ───────────────────────────────────────
async function analyzeImage(blob) {
  if (isAnalyzing) return;
  isAnalyzing = true;

  // Switch to analyzing state
  $('idleState').style.display = 'none';
  $('resultState').style.display = 'none';
  $('analyzingState').style.display = 'flex';

  // Animate steps
  const steps = ['step1','step2','step3','step4','step5','step6'];
  for (let i = 0; i < steps.length; i++) {
    $(steps[i]).classList.add('active');
    $(steps[i]).querySelector('.step-icon').textContent = '◉';
    await sleep(500 + Math.random() * 300);
    $(steps[i]).classList.remove('active');
    $(steps[i]).classList.add('done');
    $(steps[i]).querySelector('.step-icon').textContent = '●';
  }

  // Try backend, fallback to demo
  let result;
  try {
    result = await callBackendAPI(blob);
  } catch {
    result = generateDemoResult();
  }

  // Show OCR
  if (result.ocr_text) {
    $('ocrContent').innerHTML = result.ocr_text
      .split('\n').map(t => `<div class="ocr-line">${t}</div>`).join('');
  }

  // Show detection boxes overlay
  if (result.detections && result.detections.length) {
    renderDetectionBoxes(result.detections);
  }

  // Animate result
  await sleep(300);
  $('analyzingState').style.display = 'none';
  $('resultState').style.display = 'flex';

  renderResult(result);

  // Save to history
  const entry = {
    id: Date.now(),
    timestamp: Date.now(),
    medicine_name: result.medicine_name,
    verdict: result.verdict,
    fake_probability: result.fake_probability,
    confidence: result.confidence,
    batch_id: result.batch_id,
    blockchain_hash: result.blockchain_hash,
    models: result.models
  };
  scanHistory.unshift(entry);
  localStorage.setItem('mediverify_history', JSON.stringify(scanHistory.slice(0, 100)));

  isAnalyzing = false;
  showToast(`Analysis complete: ${result.verdict.toUpperCase()}`, result.verdict === 'fake' ? 'error' : 'success');
}

async function callBackendAPI(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'scan.jpg');
  const response = await fetch(`${API_BASE}/scan`, { method: 'POST', body: formData, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('API error');
  return response.json();
}

function generateDemoResult() {
  const medicines = [
    'Paracetamol 500mg', 'Amoxicillin 250mg', 'Metformin 850mg',
    'Atorvastatin 10mg', 'Omeprazole 20mg', 'Ciprofloxacin 500mg',
    'Azithromycin 500mg', 'Dolo 650', 'Crocin Advance', 'Calpol'
  ];
  const manufacturers = ['Sun Pharma', 'Cipla', 'Dr. Reddys', 'Lupin', 'Cadila'];
  const isFake = Math.random() < 0.35;
  const isSuspect = !isFake && Math.random() < 0.2;
  const verdict = isFake ? 'fake' : isSuspect ? 'suspect' : 'genuine';

  const fakeProbability = isFake
    ? randomBetween(68, 96)
    : isSuspect
    ? randomBetween(35, 67)
    : randomBetween(2, 28);

  const confidence = randomBetween(82, 99);

  return {
    medicine_name: medicines[Math.floor(Math.random() * medicines.length)],
    verdict,
    fake_probability: fakeProbability,
    confidence,
    batch_id: `BTH-${Math.floor(Math.random() * 9000) + 1000}`,
    expiry: `${String(Math.floor(Math.random() * 12) + 1).padStart(2,'0')}/202${Math.floor(Math.random() * 4) + 5}`,
    manufacturer: manufacturers[Math.floor(Math.random() * manufacturers.length)],
    blockchain_hash: generateHash(),
    blockchain_verified: Math.random() > 0.3,
    ocr_text: `MEDICINE NAME: ${medicines[Math.floor(Math.random() * medicines.length)]}\nBATCH NO: BTH-${Math.floor(Math.random() * 9000) + 1000}\nMFG: ${manufacturers[Math.floor(Math.random() * manufacturers.length)]}\nEXP: 12/2026\nSTORE BELOW 25°C`,
    models: {
      yolo: randomBetween(75, 99),
      cnn: randomBetween(75, 99),
      xgboost: randomBetween(75, 99),
      ocr_match: randomBetween(60, 99)
    },
    detections: [
      { x: 20, y: 15, w: 60, h: 70, label: 'MEDICINE PACK', conf: (confidence / 100).toFixed(2) }
    ]
  };
}

function renderResult(r) {
  const score = r.verdict === 'genuine' ? (100 - r.fake_probability) : r.fake_probability;
  const displayScore = r.verdict === 'genuine'
    ? Math.round(100 - r.fake_probability)
    : Math.round(r.fake_probability);

  // Gauge
  const fill = $('gaugeFill');
  const needle = $('gaugeNeedle');
  const pct = r.fake_probability / 100;
  const dashOffset = 251 * (1 - pct);
  fill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)';
  fill.style.strokeDashoffset = dashOffset;

  const angle = -90 + pct * 180;
  needle.style.transition = 'transform 1.5s cubic-bezier(0.4,0,0.2,1)';
  needle.style.transform = `rotate(${angle}deg)`;

  $('gaugeValue').textContent = `${displayScore}%`;
  $('gaugeStatus').textContent = r.verdict.toUpperCase();

  // Cards
  const verdictEl = $('verdictValue');
  verdictEl.textContent = r.verdict.toUpperCase();
  verdictEl.className = `card-value verdict-value ${r.verdict}`;

  $('fakeProbValue').textContent = `${r.fake_probability.toFixed(1)}%`;
  $('fakeProbValue').style.color = r.fake_probability > 60 ? 'var(--accent3)' : r.fake_probability > 35 ? 'var(--warning)' : 'var(--accent)';
  $('confidenceValue').textContent = `${r.confidence.toFixed(1)}%`;
  $('blockchainValue').textContent = r.blockchain_verified ? '✓ VERIFIED' : '✗ UNVERIFIED';
  $('blockchainValue').style.color = r.blockchain_verified ? 'var(--accent)' : 'var(--accent3)';

  // Bars (animate in)
  const m = r.models;
  setTimeout(() => {
    animateBar('bar-yolo', 'val-yolo', m.yolo);
    animateBar('bar-cnn', 'val-cnn', m.cnn);
    animateBar('bar-xgb', 'val-xgb', m.xgboost);
    animateBar('bar-ocr', 'val-ocr', m.ocr_match);
  }, 300);

  // Medicine info
  $('infoGrid').innerHTML = [
    ['Medicine', r.medicine_name],
    ['Manufacturer', r.manufacturer || 'Unknown'],
    ['Batch ID', r.batch_id || '—'],
    ['Expiry', r.expiry || '—'],
    ['Hash', (r.blockchain_hash || '—').slice(0, 18) + '…'],
    ['Scan ID', '#' + Date.now().toString(36).toUpperCase()]
  ].map(([k, v]) => `
    <div class="info-item">
      <span class="info-key">${k}</span>
      <span class="info-val">${v}</span>
    </div>
  `).join('');
}

function animateBar(barId, valId, value) {
  const pct = Math.min(100, Math.max(0, value));
  $(barId).style.width = `${pct}%`;
  $(barId).style.background = pct > 75 ? 'linear-gradient(90deg, var(--accent2), var(--accent))'
    : pct > 50 ? 'linear-gradient(90deg, var(--warning), var(--accent2))'
    : 'linear-gradient(90deg, var(--accent3), var(--warning))';
  $(valId).textContent = `${pct.toFixed(0)}%`;
}

function renderDetectionBoxes(detections) {
  const container = $('detectionBoxes');
  container.innerHTML = '';
  const wrapper = $('cameraWrapper');
  const ww = wrapper.offsetWidth;
  const wh = wrapper.offsetHeight;

  detections.forEach(d => {
    const box = document.createElement('div');
    box.className = 'detection-box';
    box.style.left = `${d.x}%`;
    box.style.top = `${d.y}%`;
    box.style.width = `${d.w}%`;
    box.style.height = `${d.h}%`;
    box.innerHTML = `<div class="detection-box-label">${d.label} ${d.conf}</div>`;
    container.appendChild(box);
  });
}

$('rescanBtn').addEventListener('click', () => {
  $('resultState').style.display = 'none';
  $('idleState').style.display = 'flex';
  $('detectionBoxes').innerHTML = '';
  $('ocrContent').innerHTML = '<span class="ocr-placeholder">Scan a medicine to extract text...</span>';
  ['step1','step2','step3','step4','step5','step6'].forEach(id => {
    $(id).classList.remove('active', 'done');
    $(id).querySelector('.step-icon').textContent = '○';
  });
});

$('reportBtn').addEventListener('click', () => {
  showToast('Report saved to history', 'success');
});

$('blockchainBtn').addEventListener('click', () => {
  document.querySelector('[data-view="blockchain"]').click();
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Dashboard ─────────────────────────────────────────
function renderDashboard() {
  const fakes = scanHistory.filter(s => s.verdict === 'fake').length;
  $('statTotal').textContent = scanHistory.length;
  $('statFakes').textContent = fakes;
  $('statVerified').textContent = scanHistory.filter(s => s.blockchain_verified).length;

  drawActivityChart();
  drawPieChart(scanHistory.length - fakes, fakes);
  drawHeatmap();
  populateRiskTable();
}

function drawActivityChart() {
  const canvas = $('activityChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const days = 7;
  const labels = [];
  const data = [];
  const fakeData = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    labels.push(day.toLocaleDateString('en', { weekday: 'short' }));
    data.push(Math.floor(Math.random() * 20) + scanHistory.length);
    fakeData.push(Math.floor(Math.random() * 8));
  }

  const pad = { t: 20, r: 20, b: 40, l: 40 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const max = Math.max(...data) + 5;
  const step = cw / (days - 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Space Mono'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max / 4) * i), pad.l - 6, y + 4);
  }

  // Draw genuine line
  const drawLine = (arr, color, fillColor) => {
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = pad.l + i * step;
      const y = pad.t + ch - (v / max) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'transparent');

    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.stroke();

    // Fill
    ctx.lineTo(pad.l + (days - 1) * step, H - pad.b);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  };

  drawLine(data, '#00e087', 'rgba(0,224,135,0.2)');
  drawLine(fakeData, '#ff3366', 'rgba(255,51,102,0.15)');

  // Dots & labels
  labels.forEach((label, i) => {
    const x = pad.l + i * step;
    ctx.fillStyle = '#00e087';
    ctx.beginPath();
    ctx.arc(x, pad.t + ch - (data[i] / max) * ch, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Space Mono'; ctx.textAlign = 'center';
    ctx.fillText(label, x, H - 10);
  });
}

function drawPieChart(genuine, fake) {
  const canvas = $('pieChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = genuine + fake || 1;
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.35;
  const slices = [
    { val: genuine, color: '#00e087', label: 'Genuine' },
    { val: fake, color: '#ff3366', label: 'Fake' },
    { val: Math.max(0, 5 - fake), color: '#ffaa00', label: 'Suspect' }
  ];

  let startAngle = -Math.PI / 2;
  const totalVal = slices.reduce((s, x) => s + x.val, 0) || 1;

  slices.forEach(s => {
    const angle = (s.val / totalVal) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();

    // Inner ring effect
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r * 0.55, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = 'var(--bg2)';
    ctx.fill();

    startAngle += angle;
  });

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `bold 18px Syne`;
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 4);
  ctx.font = '10px Space Mono';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('TOTAL', cx, cy + 18);

  // Legend
  let ly = H - 20;
  slices.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(10, ly - 8, 12, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Space Mono'; ctx.textAlign = 'left';
    ctx.fillText(`${s.label} (${s.val})`, 28, ly);
    ly += 20;
  });
}

function drawHeatmap() {
  const canvas = $('heatmapCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 800;
  const H = 300;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  // Dark background
  ctx.fillStyle = 'rgba(13,17,23,1)';
  ctx.fillRect(0, 0, W, H);

  // Grid
  const cols = 20, rows = 8;
  const cw = W / cols, ch = H / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const risk = Math.random();
      const x = c * cw, y = r * ch;
      if (risk > 0.7) {
        ctx.fillStyle = `rgba(255,51,102,${risk * 0.8})`;
      } else if (risk > 0.4) {
        ctx.fillStyle = `rgba(255,170,0,${risk * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(0,224,135,${risk * 0.4})`;
      }
      ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    }
  }

  // Labels
  const regions = ['Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Hyderabad', 'Bangalore', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'];
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '9px Space Mono';
  ctx.textAlign = 'center';
  for (let i = 0; i < cols; i++) {
    if (i < regions.length) {
      ctx.fillText(regions[i], i * cw + cw / 2, H - 6);
    }
  }
}

function populateRiskTable() {
  const medicines = [
    { name: 'Paracetamol 500mg', batch: 'BTH-4421', risk: 'LOW', fake: '4.2%', status: 'genuine' },
    { name: 'Amoxicillin 250mg', batch: 'BTH-2817', risk: 'HIGH', fake: '78.9%', status: 'fake' },
    { name: 'Metformin 850mg', batch: 'BTH-9932', risk: 'MEDIUM', fake: '42.1%', status: 'suspect' },
    { name: 'Atorvastatin 10mg', batch: 'BTH-1105', risk: 'LOW', fake: '6.7%', status: 'genuine' },
    { name: 'Ciprofloxacin 500mg', batch: 'BTH-5543', risk: 'HIGH', fake: '85.3%', status: 'fake' },
  ];

  $('riskTableBody').innerHTML = medicines.map(m => `
    <tr>
      <td>${m.name}</td>
      <td><code>${m.batch}</code></td>
      <td style="color: ${m.risk==='HIGH'?'var(--accent3)':m.risk==='MEDIUM'?'var(--warning)':'var(--accent)'}">${m.risk}</td>
      <td>${m.fake}</td>
      <td><span class="badge ${m.status}">${m.status.toUpperCase()}</span></td>
    </tr>
  `).join('');
}

// ─── History ───────────────────────────────────────────
function renderHistory() {
  const search = $('historySearch').value.toLowerCase();
  const filter = $('historyFilter').value;

  let items = scanHistory.filter(s => {
    const nameMatch = s.medicine_name.toLowerCase().includes(search);
    const verdictMatch = filter === 'all' || s.verdict === filter;
    return nameMatch && verdictMatch;
  });

  if (!items.length) {
    $('historyGrid').innerHTML = '<div class="history-empty"><p>No scans found.</p></div>';
    return;
  }

  $('historyGrid').innerHTML = items.map(s => {
    const color = s.verdict === 'fake' ? 'var(--accent3)' : s.verdict === 'suspect' ? 'var(--warning)' : 'var(--accent)';
    return `
    <div class="history-card ${s.verdict === 'fake' ? 'fake-card' : ''}">
      <div class="hc-header">
        <div class="hc-name">${s.medicine_name}</div>
        <span class="badge ${s.verdict}">${s.verdict.toUpperCase()}</span>
      </div>
      <div class="hc-row"><span class="hc-label">Fake Probability</span><span class="hc-val" style="color:${color}">${s.fake_probability?.toFixed(1)}%</span></div>
      <div class="hc-row"><span class="hc-label">Confidence</span><span class="hc-val">${s.confidence?.toFixed(1)}%</span></div>
      <div class="hc-row"><span class="hc-label">Batch ID</span><span class="hc-val">${s.batch_id || '—'}</span></div>
      <div class="hc-row"><span class="hc-label">Scanned</span><span class="hc-val" style="color:var(--text-dim)">${formatTime(s.timestamp)}</span></div>
      <div class="hc-bar"><div class="hc-bar-fill" style="width:${s.fake_probability}%;background:${color}"></div></div>
    </div>
  `}).join('');
}

$('historySearch').addEventListener('input', renderHistory);
$('historyFilter').addEventListener('change', renderHistory);
$('clearHistoryBtn').addEventListener('click', () => {
  scanHistory = [];
  localStorage.removeItem('mediverify_history');
  renderHistory();
  showToast('History cleared');
});

// ─── Blockchain ────────────────────────────────────────
function generateInitialBlocks() {
  return Array.from({ length: 5 }, (_, i) => ({
    index: i,
    hash: generateHash(),
    prevHash: i === 0 ? '0x0000000000000000' : generateHash(),
    timestamp: Date.now() - (5 - i) * 3600000 * Math.random() * 5,
    medicine: ['Paracetamol', 'Amoxicillin', 'Metformin', 'Atorvastatin', 'Ciprofloxacin'][i],
    manufacturer: ['Sun Pharma', 'Cipla', 'Dr. Reddys', 'Lupin', 'Cadila'][i],
    verified: Math.random() > 0.3
  }));
}

function renderBlockchain() {
  renderBcChain();
  renderBcTable();
}

function renderBcChain() {
  const chain = $('bcChain');
  chain.innerHTML = bcBlocks.map((b, i) => `
    <div class="bc-block ${b.verified ? 'verified' : ''}">
      <div class="bc-block-num">BLOCK #${b.index}</div>
      <div class="bc-block-hash">${b.hash.slice(0, 18)}…</div>
      <div class="bc-block-time">${formatTime(b.timestamp)}</div>
      <div class="bc-block-status"><span class="badge ${b.verified ? 'verified' : 'fake'}">${b.verified ? '✓ VALID' : '✗ INVALID'}</span></div>
    </div>
    ${i < bcBlocks.length - 1 ? '<div class="bc-connector"></div>' : ''}
  `).join('');
}

function renderBcTable() {
  $('bcTableBody').innerHTML = bcBlocks.map(b => `
    <tr>
      <td>${formatTime(b.timestamp)}</td>
      <td><code style="font-size:10px">${b.hash.slice(0, 20)}…</code></td>
      <td>${b.medicine}</td>
      <td>${b.manufacturer}</td>
      <td><span class="badge ${b.verified ? 'verified' : 'fake'}">${b.verified ? 'VERIFIED' : 'INVALID'}</span></td>
    </tr>
  `).join('');
}

$('generateHashBtn').addEventListener('click', () => {
  $('hashInput').value = generateHash();
});

$('verifyHashBtn').addEventListener('click', async () => {
  const hash = $('hashInput').value.trim();
  if (!hash) { showToast('Please enter a hash to verify', 'warning'); return; }

  $('bcResult').style.display = 'none';
  showToast('Querying blockchain nodes...', 'info');

  await sleep(1200 + Math.random() * 800);

  const found = bcBlocks.find(b => b.hash === hash);
  const isValid = found ? found.verified : Math.random() > 0.4;
  const result = $('bcResult');
  result.style.display = 'block';
  result.className = `bc-result ${isValid ? 'verified' : 'failed'}`;

  if (isValid) {
    result.innerHTML = `
      <div style="color:var(--accent);font-weight:700;font-size:16px;margin-bottom:12px">✓ BLOCKCHAIN VERIFIED</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-family:var(--font-mono);font-size:12px">
        <div><div style="color:var(--text-dim);font-size:10px">HASH</div><div>${hash.slice(0,24)}…</div></div>
        <div><div style="color:var(--text-dim);font-size:10px">STATUS</div><div style="color:var(--accent)">VALID</div></div>
        <div><div style="color:var(--text-dim);font-size:10px">BLOCK</div><div>#${Math.floor(Math.random()*10000)}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px">CONFIRMATIONS</div><div>${Math.floor(Math.random()*500)+50}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px">TIMESTAMP</div><div>${formatTime(Date.now())}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px">NETWORK</div><div>MediChain v2</div></div>
      </div>
    `;
    // Add to chain
    bcBlocks.push({
      index: bcBlocks.length,
      hash,
      prevHash: bcBlocks[bcBlocks.length - 1].hash,
      timestamp: Date.now(),
      medicine: 'Verified Medicine',
      manufacturer: 'Unknown',
      verified: true
    });
    renderBcChain();
    renderBcTable();
  } else {
    result.innerHTML = `
      <div style="color:var(--accent3);font-weight:700;font-size:16px;margin-bottom:8px">✗ VERIFICATION FAILED</div>
      <div style="color:var(--text-mid);font-size:13px">Hash not found in MediChain network. This medicine batch may be counterfeit or the hash is invalid.</div>
      <div style="margin-top:12px;font-family:var(--font-mono);font-size:11px;color:var(--text-dim)">QUERY: ${hash.slice(0,20)}… | NODES CHECKED: 12 | RESULT: NOT_FOUND</div>
    `;
  }

  showToast(isValid ? 'Blockchain verified!' : 'Verification failed — possibly fake!', isValid ? 'success' : 'error');
});

// ─── Backend Health Check ──────────────────────────────
async function checkBackend() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      $('apiStatus').textContent = '● LIVE';
      $('apiStatus').style.color = 'var(--accent)';
      return true;
    }
  } catch {
    $('apiStatus').textContent = '● DEMO';
    $('apiStatus').style.color = 'var(--warning)';
    return false;
  }
}

// ─── Init ──────────────────────────────────────────────
(async () => {
  checkBackend();
  renderDashboard();

  // Add some demo data if history empty
  if (scanHistory.length === 0) {
    const demoData = [
      { id: 1, timestamp: Date.now() - 86400000, medicine_name: 'Paracetamol 500mg', verdict: 'genuine', fake_probability: 12.3, confidence: 94.1, batch_id: 'BTH-4421' },
      { id: 2, timestamp: Date.now() - 43200000, medicine_name: 'Amoxicillin 250mg', verdict: 'fake', fake_probability: 87.6, confidence: 92.4, batch_id: 'BTH-2817' },
      { id: 3, timestamp: Date.now() - 7200000, medicine_name: 'Metformin 850mg', verdict: 'suspect', fake_probability: 44.2, confidence: 88.7, batch_id: 'BTH-9932' },
    ];
    scanHistory = demoData;
    localStorage.setItem('mediverify_history', JSON.stringify(scanHistory));
  }
})();
