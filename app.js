// ============================================================
//  KASIR APP - app.js
// ============================================================

// ---- STATE ----
let state = {
  config: {
    urlPenjualan: 'https://script.google.com/macros/s/AKfycbxzVYLtFwkvVwZbWF8dS5YoWArnKjM_myFBLbpPsiiWI_Zf9xAjV1MAnbpDUgNb4TeE/exec',
    urlTutupToko: 'https://script.google.com/macros/s/AKfycbxzVYLtFwkvVwZbWF8dS5YoWArnKjM_myFBLbpPsiiWI_Zf9xAjV1MAnbpDUgNb4TeE/exec',
    sheetLink: ''
  },
  saldo: {
    fazzpay: 0,
    pasar: 0,
    agen: 0
  },
  transaksi: [],       // transaksi hari ini
  riwayatSaldo: [],    // riwayat tambah saldo
  kategoriAktif: '',
  metodeAktif: ''
};

// ---- LOAD dari localStorage ----
function loadState() {
  try {
    const savedConfig = localStorage.getItem('kasir_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Hanya ambil sheetLink dari saved, URL API tetap dari hardcode
      if (parsed.sheetLink) state.config.sheetLink = parsed.sheetLink;
    }
    const savedData = localStorage.getItem('kasir_data');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      state.saldo = parsed.saldo || state.saldo;
      state.transaksi = parsed.transaksi || [];
      state.riwayatSaldo = parsed.riwayatSaldo || [];
    }
  } catch (e) { console.warn('Load state gagal', e); }
}

function saveState() {
  try {
    // Config disimpan terpisah agar tidak hilang saat reset
    localStorage.setItem('kasir_config', JSON.stringify(state.config));
    localStorage.setItem('kasir_data', JSON.stringify({
      saldo: state.saldo,
      transaksi: state.transaksi,
      riwayatSaldo: state.riwayatSaldo
    }));
  } catch (e) { console.warn('Save state gagal', e); }
}

// ---- FORMAT RUPIAH ----
function rupiah(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

// ---- TOAST ----
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 2800);
}

// ---- TANGGAL ----
function getTanggal() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function getWaktu() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getTanggalShort() {
  return new Date().toLocaleDateString('id-ID');
}

// ============================================================
//  NAVIGASI
// ============================================================
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (btn) btn.classList.add('active');
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  if (page === 'tutup') renderTutupSummary();
  if (page === 'transaksi') renderTransaksi();
  if (page === 'saldo') renderSaldoPage();
}

// ============================================================
//  KONFIGURASI SHEET
// ============================================================
function cekConfig() {
  // Hanya tampilkan modal jika belum set sheetLink (sekali saja)
  const sudahSetup = localStorage.getItem('kasir_setup_done');
  if (!sudahSetup) {
    bukaModalConfig();
  }
}

function bukaModalConfig() {
  const modal = document.getElementById('modalConfig');
  modal.classList.remove('hidden');
  if (state.config.sheetLink)
    document.getElementById('cfgSheetLink').value = state.config.sheetLink;
}

document.getElementById('btnEditConfig').addEventListener('click', bukaModalConfig);

document.getElementById('btnSimpanConfig').addEventListener('click', () => {
  const urlL = document.getElementById('cfgSheetLink').value.trim();
  state.config.sheetLink = urlL;
  saveState();
  localStorage.setItem('kasir_setup_done', '1');
  document.getElementById('modalConfig').classList.add('hidden');
  showToast('Siap digunakan!', 'success');
});

document.getElementById('btnBukaSheet').addEventListener('click', () => {
  if (state.config.sheetLink) {
    window.open(state.config.sheetLink, '_blank');
  } else {
    showToast('URL Google Sheet belum dikonfigurasi', 'error');
  }
});

// ============================================================
//  FORM KASIR
// ============================================================
function initFormKasir() {
  // Kategori
  document.querySelectorAll('.btn-kat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-kat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kategoriAktif = btn.dataset.kat;
      state.metodeAktif = '';
      updateFormKasir();
    });
  });

  // Input listener untuk preview profit
  ['inputModal', 'inputJual', 'inputJumlah'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateProfitPreview);
  });
}

function updateFormKasir() {
  const kat = state.kategoriAktif;
  const grpMetode = document.getElementById('grpMetode');
  const btnMetode = document.getElementById('btnMetode');
  const hintModal = document.getElementById('hintModal');

  // Reset metode
  state.metodeAktif = '';
  btnMetode.innerHTML = '';

  if (kat === 'transfer') {
    grpMetode.classList.remove('hidden');
    ['fazzpay'].forEach(m => {
      const b = document.createElement('button');
      b.className = 'btn-met';
      b.dataset.met = m;
      b.textContent = 'Fazzpay';
      b.addEventListener('click', () => pilihMetode(m));
      btnMetode.appendChild(b);
    });
    hintModal.textContent = '(modal dari Fazzpay)';
  } else if (kat === 'elektrik') {
    grpMetode.classList.remove('hidden');
    ['pasar', 'agen'].forEach(m => {
      const b = document.createElement('button');
      b.className = 'btn-met';
      b.dataset.met = m;
      b.textContent = m.charAt(0).toUpperCase() + m.slice(1);
      b.addEventListener('click', () => pilihMetode(m));
      btnMetode.appendChild(b);
    });
    hintModal.textContent = '(modal dari Pasar/Agen)';
  } else {
    grpMetode.classList.add('hidden');
    hintModal.textContent = '(tidak wajib pakai saldo)';
  }
  updateProfitPreview();
}

function pilihMetode(m) {
  state.metodeAktif = m;
  document.querySelectorAll('.btn-met').forEach(b => {
    b.classList.toggle('active', b.dataset.met === m);
  });
}

function updateProfitPreview() {
  const modal  = Number(document.getElementById('inputModal').value) || 0;
  const jual   = Number(document.getElementById('inputJual').value) || 0;
  const jumlah = Number(document.getElementById('inputJumlah').value) || 1;
  const profit = jual - modal;
  const totalProfit = profit * jumlah;
  document.getElementById('previewProfit').textContent = rupiah(profit);
  document.getElementById('previewTotalProfit').textContent = rupiah(totalProfit);
}

// ============================================================
//  SIMPAN PENJUALAN
// ============================================================
document.getElementById('btnSimpan').addEventListener('click', async () => {
  const kat    = state.kategoriAktif;
  const modal  = Number(document.getElementById('inputModal').value) || 0;
  const jual   = Number(document.getElementById('inputJual').value) || 0;
  const jumlah = Number(document.getElementById('inputJumlah').value) || 1;

  if (!kat) { showToast('Pilih kategori terlebih dahulu!', 'error'); return; }
  if (jual <= 0) { showToast('Harga jual harus diisi!', 'error'); return; }

  // Validasi metode saldo
  if (kat === 'transfer') {
    if (!state.metodeAktif) { showToast('Pilih metode saldo (Fazzpay)!', 'error'); return; }
    if (state.saldo.fazzpay < modal * jumlah) {
      showToast('Saldo Fazzpay tidak cukup!', 'error'); return;
    }
  }
  if (kat === 'elektrik') {
    if (!state.metodeAktif) { showToast('Pilih metode saldo (Pasar/Agen)!', 'error'); return; }
    if (state.saldo[state.metodeAktif] < modal * jumlah) {
      showToast(`Saldo ${state.metodeAktif} tidak cukup!`, 'error'); return;
    }
  }

  const profit = (jual - modal) * jumlah;
  const totalModal = modal * jumlah;
  const totalJual  = jual * jumlah;
  const waktu = getWaktu();
  const tanggal = getTanggalShort();

  const trx = {
    id: Date.now().toString(),
    tanggal,
    waktu,
    kategori: kat,
    metode: state.metodeAktif || '-',
    hargaModal: modal,
    hargaJual: jual,
    jumlah,
    totalModal,
    totalJual,
    profit
  };

  // Kurangi saldo jika ada
  if (kat === 'transfer' || kat === 'elektrik') {
    state.saldo[state.metodeAktif] -= totalModal;
    if (state.saldo[state.metodeAktif] < 0) state.saldo[state.metodeAktif] = 0;
  }

  state.transaksi.push(trx);
  saveState();
  updateSaldoUI();
  updateStatKasir();

  // Reset form
  document.getElementById('inputModal').value = '';
  document.getElementById('inputJual').value = '';
  document.getElementById('inputJumlah').value = '1';
  document.querySelectorAll('.btn-kat').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.btn-met').forEach(b => b.classList.remove('active'));
  state.kategoriAktif = '';
  state.metodeAktif = '';
  document.getElementById('grpMetode').classList.add('hidden');
  updateProfitPreview();

  showToast('Penjualan disimpan!', 'success');

  // Kirim ke SheetBest
  kirimKeSheet(trx);
});

// ============================================================
//  SHEETDB API
// ============================================================
async function kirimKeSheet(data) {
  try {
    const res = await fetch(state.config.urlPenjualan, {
      method: 'POST',
      body: new URLSearchParams({
  type: "penjualan",
  Tanggal: data.tanggal,
  Waktu: data.waktu,
  Kategori: data.kategori,
  Metode: data.metode,
  HargaModal: data.hargaModal,
  HargaJual: data.hargaJual,
  Jumlah: data.jumlah,
  TotalModal: data.totalModal,
  TotalJual: data.totalJual,
  Profit: data.profit
})
    });

    const text = await res.text();
    console.log("RESPON:", text);

    if (!res.ok) throw new Error(text);

  } catch (e) {
    console.error(e);
    showToast("Gagal kirim ke Sheet!", "error");
  }
}

async function kirimTutupTokoKeSheet(data) {
  try {
    const res = await fetch(state.config.urlTutupToko, {
      method: 'POST',
      body: new URLSearchParams({
        type: "tutup",   // 🔥 WAJIB INI
        Tanggal: data.Tanggal,
        TotalTransaksi: data['Total Transaksi'],
        TotalProfit: data['Total Profit'],
  TotalPenjualan: data['Total Penjualan'],
  TotalModal: data['Total Modal'],
  SisaFazzpay: data['Sisa Fazzpay'],
  SisaPasar: data['Sisa Pasar'],
  SisaAgen: data['Sisa Agen']
})
    });

    const result = await res.text();
    console.log("RESPON TUTUP TOKO:", result);

    if (!res.ok) throw new Error(result);

  } catch (e) {
    console.error("ERROR TUTUP TOKO:", e);
    showToast('Gagal kirim ke Sheet Tutup Toko!', 'error');
  }
}

// ============================================================
//  HAPUS TRANSAKSI
// ============================================================
function hapusTransaksi(id) {
  const trx = state.transaksi.find(t => t.id === id);
  if (!trx) return;

  // Kembalikan saldo jika ada
  if (trx.kategori === 'transfer' && trx.metode === 'fazzpay') {
    state.saldo.fazzpay += trx.totalModal;
  } else if (trx.kategori === 'elektrik' && (trx.metode === 'pasar' || trx.metode === 'agen')) {
    state.saldo[trx.metode] += trx.totalModal;
  }

  state.transaksi = state.transaksi.filter(t => t.id !== id);
  saveState();
  updateSaldoUI();
  updateStatKasir();
  renderTransaksi();
  showToast('Transaksi dihapus', '');
}

// ============================================================
//  RENDER TRANSAKSI
// ============================================================
function renderTransaksi(filter = '') {
  const filterVal = filter || document.getElementById('filterKat').value;
  const list = document.getElementById('listTransaksi');
  let data = [...state.transaksi].reverse();
  if (filterVal) data = data.filter(t => t.kategori === filterVal);

  if (data.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada transaksi.</div>';
    return;
  }

  list.innerHTML = data.map(t => `
    <div class="trx-item">
      <div class="trx-left">
        <span class="trx-kat kat-${t.kategori}">${t.kategori.toUpperCase()}</span>
        <span class="trx-info">
          Jual: ${rupiah(t.hargaJual)} × ${t.jumlah} &nbsp;|&nbsp; Modal: ${rupiah(t.hargaModal)}
          ${t.metode !== '-' ? `&nbsp;|&nbsp; via <strong>${t.metode}</strong>` : ''}
        </span>
        <span class="trx-meta">
          Total Jual: ${rupiah(t.totalJual)} &nbsp;|&nbsp; Total Modal: ${rupiah(t.totalModal)}
        </span>
      </div>
      <div class="trx-right">
        <span class="trx-profit">+${rupiah(t.profit)}</span>
        <span class="trx-waktu">${t.waktu}</span>
        <button class="btn-hapus" onclick="hapusTransaksi('${t.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('filterKat').addEventListener('change', () => renderTransaksi());

// ============================================================
//  SALDO
// ============================================================
function updateSaldoUI() {
  ['fazzpay', 'pasar', 'agen'].forEach(k => {
    const val = rupiah(state.saldo[k]);
    const els = document.querySelectorAll(
      `#strip-${k}, #sc-${k}, #ts-${k}`
    );
    els.forEach(el => { if (el) el.textContent = val; });
  });
}

function renderSaldoPage() {
  updateSaldoUI();
  const list = document.getElementById('listSaldo');
  const data = [...state.riwayatSaldo].reverse();
  if (data.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada riwayat tambah saldo.</div>';
    return;
  }
  list.innerHTML = data.map(r => `
    <div class="saldo-riwayat-item">
      <div class="sri-left">
        <span class="sri-name">${r.nama.charAt(0).toUpperCase() + r.nama.slice(1)}</span>
        <span class="sri-ket">${r.keterangan || '-'}</span>
      </div>
      <div class="sri-right">
        <div class="sri-jumlah">+${rupiah(r.jumlah)}</div>
        <div class="sri-waktu">${r.tanggal} ${r.waktu}</div>
      </div>
    </div>
  `).join('');
}

document.getElementById('btnTambahSaldo').addEventListener('click', () => {
  const nama   = document.getElementById('pilihanSaldo').value;
  const jumlah = Number(document.getElementById('inputTambahSaldo').value) || 0;
  const ket    = document.getElementById('inputKetSaldo').value.trim();

  if (jumlah <= 0) { showToast('Jumlah harus lebih dari 0!', 'error'); return; }

  state.saldo[nama] += jumlah;
  state.riwayatSaldo.push({
    nama,
    jumlah,
    keterangan: ket,
    tanggal: getTanggalShort(),
    waktu: getWaktu()
  });
  saveState();
  updateSaldoUI();
  renderSaldoPage();

  document.getElementById('inputTambahSaldo').value = '';
  document.getElementById('inputKetSaldo').value = '';
  showToast(`Saldo ${nama} berhasil ditambah!`, 'success');
});

// ============================================================
//  STATISTIK KASIR
// ============================================================
function updateStatKasir() {
  const trx = state.transaksi;
  const totalProfit = trx.reduce((a, t) => a + t.profit, 0);
  const totalJual   = trx.reduce((a, t) => a + t.totalJual, 0);
  const totalModal  = trx.reduce((a, t) => a + t.totalModal, 0);

  document.getElementById('statProfit').textContent = rupiah(totalProfit);
  document.getElementById('statJual').textContent   = rupiah(totalJual);
  document.getElementById('statModal').textContent  = rupiah(totalModal);
  document.getElementById('statJumlahTrx').textContent = trx.length;
}

// ============================================================
//  TUTUP TOKO
// ============================================================
function renderTutupSummary() {
  const trx = state.transaksi;
  const totalProfit = trx.reduce((a, t) => a + t.profit, 0);
  const totalJual   = trx.reduce((a, t) => a + t.totalJual, 0);
  const totalModal  = trx.reduce((a, t) => a + t.totalModal, 0);

  document.getElementById('ts-profit').textContent = rupiah(totalProfit);
  document.getElementById('ts-jual').textContent   = rupiah(totalJual);
  document.getElementById('ts-modal').textContent  = rupiah(totalModal);
  document.getElementById('ts-trx').textContent    = trx.length;
  document.getElementById('ts-fazzpay').textContent = rupiah(state.saldo.fazzpay);
  document.getElementById('ts-pasar').textContent   = rupiah(state.saldo.pasar);
  document.getElementById('ts-agen').textContent    = rupiah(state.saldo.agen);
  document.getElementById('tanggalTutup').textContent = getTanggal();
}

document.getElementById('btnTutupToko').addEventListener('click', async () => {
  const trx = state.transaksi;
  if (trx.length === 0) {
    showToast('Tidak ada transaksi hari ini.', '');
    return;
  }

  const konfirmasi = confirm(
    `Tutup toko?\n\nTotal ${trx.length} transaksi akan dikirim ke sheet.\nData penjualan website akan direset.\n\nLanjutkan?`
  );
  if (!konfirmasi) return;

  const totalProfit = trx.reduce((a, t) => a + t.profit, 0);
  const totalJual   = trx.reduce((a, t) => a + t.totalJual, 0);
  const totalModal  = trx.reduce((a, t) => a + t.totalModal, 0);

  const dataTutup = {
    Tanggal: getTanggalShort(),
    'Total Transaksi': trx.length,
    'Total Profit': totalProfit,
    'Total Penjualan': totalJual,
    'Total Modal': totalModal,
    'Sisa Fazzpay': state.saldo.fazzpay,
    'Sisa Pasar': state.saldo.pasar,
    'Sisa Agen': state.saldo.agen
  };

  showToast('Mengirim data ke sheet...', '');
  await kirimTutupTokoKeSheet(dataTutup);

  // Reset data transaksi, riwayat saldo, tapi simpan saldo & config
  state.transaksi = [];
  state.riwayatSaldo = [];
  localStorage.setItem('kasir_data', JSON.stringify({
    saldo: state.saldo,
    transaksi: [],
    riwayatSaldo: []
  }));
  updateSaldoUI();
  updateStatKasir();
  renderTutupSummary();

  showToast('Toko berhasil ditutup! Data sudah terkirim.', 'success');
  setTimeout(() => navigateTo('kasir'), 1500);
});

// ============================================================
//  TANGGAL UI
// ============================================================
function updateTanggalUI() {
  const tgl = getTanggal();
  ['tanggalHari', 'tanggalTrx', 'tanggalTutup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = tgl;
  });
}

// ============================================================
//  INIT
// ============================================================
function init() {
  loadState();
  initNav();
  initFormKasir();
  updateTanggalUI();
  updateSaldoUI();
  updateStatKasir();
  cekConfig();
}

document.addEventListener('DOMContentLoaded', init);
type: "penjualan"
type: "tutup"
function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  if (data.type === "penjualan") {
    return ContentService.createTextOutput("penjualan ok");
  }

  if (data.type === "tutup") {
    return ContentService.createTextOutput("tutup ok");
  }
}
function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify(e));
}
function doPost(e) {
  const data = e.parameter; // 🔥 bukan JSON

  if (data.type === "penjualan") {
    Logger.log(data);
  }

  if (data.type === "tutup") {
    Logger.log(data);
  }

  return ContentService
    .createTextOutput("OK");
}
Logger.log(JSON.stringify(data));