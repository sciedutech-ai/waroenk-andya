// --- 1. IMPORT FIREBASE MODULAR ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- 2. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCF_xyFlqaLi365f5jlb0JY2QfzBgMpqmg",
    authDomain: "waroeng-andya.firebaseapp.com",
    projectId: "waroeng-andya",
    storageBucket: "waroeng-andya.firebasestorage.app",
    messagingSenderId: "754114261796",
    appId: "1:754114261796:web:588599a6404f7f466df9b1",
    measurementId: "G-315NLK3E6J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- KONFIGURASI CLOUDINARY ---
const CLOUDINARY_CLOUD_NAME = "derbaayh5"; 
const CLOUDINARY_UPLOAD_PRESET = "waroenk_preset"; 
const CLOUDINARY_API_KEY = "954237817332249";

// Global Vars
let currentEditingImages = [];
let allOrdersData = []; 
let tempVariants = []; // REVISI: Variabel global untuk menampung varian sementara

// --- 3. SISTEM AUTH ---
onAuthStateChanged(auth, (user) => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (user) {
        if(loginSection) loginSection.style.display = 'none';
        if(dashboardSection) dashboardSection.style.display = 'flex';
        checkRole(user.email);
        
        initRealtimeOrders();
        initMenuList();
        initManagerReport(); 
        
        if(document.getElementById('kitchen-grid')) initKitchenDisplay();
    } else {
        if(loginSection) loginSection.style.display = 'flex';
        if(dashboardSection) dashboardSection.style.display = 'none';
    }
});

window.loginEmail = async function() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Login Gagal: " + error.message);
    }
};

window.logout = () => confirm("Keluar dari sistem?") && signOut(auth);

function checkRole(email) {
    let role = email.toLowerCase().includes('manager') ? "Manager" : "Kasir";
    document.querySelectorAll('.mgr-only').forEach(el => {
        el.style.display = role === "Manager" ? 'flex' : 'none';
    });
    const roleDisplay = document.getElementById('user-role-display');
    if(roleDisplay) roleDisplay.innerText = `${role}: ${email}`;
}

// --- 4. LOGIKA GAMBAR & VARIAN ---

// REVISI: Fungsi Toggle Varian
window.toggleVariantSection = function() {
    const val = document.getElementById('has-variant-toggle').value;
    const wrapper = document.getElementById('variant-section-wrapper');
    if (val === 'yes') {
        wrapper.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
        tempVariants = []; // Reset jika dimatikan
        renderVariantChips();
    }
};

// REVISI: Fungsi Tambah Varian (Chip)
window.addVariantChip = function() {
    const input = document.getElementById('variant-input');
    const val = input.value.trim();
    
    if (val && !tempVariants.includes(val)) {
        tempVariants.push(val);
        renderVariantChips();
        input.value = ''; // Reset input
        input.focus();
    }
};

// Listener Enter di Input Varian
const varInput = document.getElementById('variant-input');
if(varInput) {
    varInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault(); 
            addVariantChip();
        }
    });
}

// REVISI: Fungsi Hapus Varian
window.removeVariantChip = function(index) {
    tempVariants.splice(index, 1);
    renderVariantChips();
};

function renderVariantChips() {
    const container = document.getElementById('variant-chips-container');
    if(!container) return;
    container.innerHTML = '';
    
    tempVariants.forEach((v, i) => {
        const div = document.createElement('div');
        // Styling inline agar langsung jalan tanpa ubah CSS (atau gunakan class .v-chip dari CSS sebelumnya)
        div.style.cssText = "display:inline-flex; align-items:center; background:rgba(0,229,255,0.15); border:1px solid #00E5FF; color:#fff; padding:5px 10px; border-radius:20px; font-size:0.85rem; margin:2px;";
        div.innerHTML = `
            <span>${v}</span>
            <button type="button" onclick="removeVariantChip(${i})" style="background:transparent; border:none; color:#ff5252; margin-left:8px; font-weight:bold; cursor:pointer;">&times;</button>
        `;
        container.appendChild(div);
    });
}

window.previewImages = function(event) {
    const files = event.target.files;
    const container = document.getElementById('image-previews');
    
    if (files.length > 3) {
        alert("Maksimal 3 foto!");
        event.target.value = "";
        return;
    }

    renderExistingImages();

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<img src="${e.target.result}" style="border:2px dashed var(--neon-blue);">`;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
};

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800;
                let w = img.width, h = img.height;
                if(w > MAX) { h *= MAX/w; w = MAX; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
            };
        };
    });
}

async function uploadToCloudinary(file) {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("api_key", CLOUDINARY_API_KEY);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
    });
    
    const data = await res.json();
    if (data.secure_url) return data.secure_url; 
    throw new Error("Gagal upload ke Cloudinary: " + (data.error ? data.error.message : "Cek Preset/Cloud Name"));
}

// --- 5. CRUD MENU ---

function initMenuList() {
    const tbody = document.getElementById('menu-list-body');
    if(!tbody) return;
    const q = query(collection(db, "menu"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Belum ada menu.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const id = docSnap.id;
            
            let displayImg = 'https://via.placeholder.com/60/252525/FFFFFF?text=No+Img';
            if (d.images && Array.isArray(d.images) && d.images.length > 0) {
                displayImg = d.images[0];
            } else if (d.image) {
                displayImg = d.image;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="img-container">
                        <img src="${displayImg}" alt="${d.name}" onerror="this.src='https://via.placeholder.com/60/252525/FF0000?text=Error';">
                    </div>
                </td>
                <td><b>${d.name}</b><br><small style="color:var(--text-dim)">${d.category}</small></td>
                <td>Rp ${parseInt(d.price).toLocaleString('id-ID')}</td>
                <td><span class="badge-${d.status || 'ready'}">${d.status === 'empty' ? 'Habis' : 'Ready'}</span></td>
                <td style="white-space: nowrap;">
                    <button onclick="editMenu('${id}')" class="btn-mini btn-edit"><i class="ri-pencil-line"></i></button>
                    <button onclick="deleteMenu('${id}', '${d.name}')" class="btn-mini btn-del"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// REVISI: Save Menu dengan Varian
window.saveMenu = async function(e) {
    if(e) e.preventDefault(); // Mencegah reload form
    const id = document.getElementById('menu-id').value;
    const btn = document.getElementById('btn-save-menu');
    const photoFiles = document.getElementById('new-photos').files;
    const hasVariant = document.getElementById('has-variant-toggle').value === 'yes';

    // Validasi Varian
    if (hasVariant && tempVariants.length === 0) {
        alert("Anda memilih 'Ada Varian', tapi belum mengisi varian satupun!");
        return;
    }

    const menuData = {
        name: document.getElementById('new-name').value,
        price: parseInt(document.getElementById('new-price').value),
        category: document.getElementById('new-cat').value,
        desc: document.getElementById('new-desc').value,
        status: document.getElementById('new-status').value,
        variants: hasVariant ? tempVariants : [], // Simpan array varian
        updatedAt: Date.now()
    };

    if (!menuData.name || !menuData.price) return alert("Nama & Harga wajib diisi!");

    btn.disabled = true;
    btn.innerText = "Memproses...";

    try {
        let finalImages = [...currentEditingImages];

        if (photoFiles.length > 0) {
            btn.innerText = "Uploading ke Cloudinary...";
            const newUrls = await Promise.all(Array.from(photoFiles).map(file => uploadToCloudinary(file)));
            finalImages = newUrls; 
        }

        if (finalImages.length === 0) throw new Error("Wajib ada minimal 1 foto!");
        
        menuData.images = finalImages;
        menuData.image = finalImages[0]; 

        if (id) {
            await updateDoc(doc(db, "menu", id), menuData);
            alert("Berhasil diupdate!");
        } else {
            menuData.createdAt = serverTimestamp();
            await addDoc(collection(db, "menu"), menuData);
            alert("Menu berhasil ditambah!");
        }
        resetMenuForm();
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN PRODUK";
    }
};

// REVISI: Edit Menu (Load Varian)
window.editMenu = async function(id) {
    const docRef = doc(db, "menu", id);
    const snap = await getDoc(docRef); 
    
    if (snap.exists()) {
        const d = snap.data();
        document.getElementById('menu-id').value = id;
        document.getElementById('new-name').value = d.name;
        document.getElementById('new-price').value = d.price;
        document.getElementById('new-cat').value = d.category;
        document.getElementById('new-desc').value = d.desc || '';
        document.getElementById('new-status').value = d.status || 'ready';
        
        currentEditingImages = d.images || (d.image ? [d.image] : []);
        renderExistingImages();

        // Load Varian
        if (d.variants && d.variants.length > 0) {
            document.getElementById('has-variant-toggle').value = 'yes';
            tempVariants = [...d.variants];
        } else {
            document.getElementById('has-variant-toggle').value = 'no';
            tempVariants = [];
        }
        toggleVariantSection();
        renderVariantChips();

        document.getElementById('form-title').innerText = "Edit Menu: " + d.name;
        document.getElementById('btn-save-menu').innerHTML = '<i class="ri-save-line"></i> UPDATE MENU';
        document.getElementById('btn-cancel-edit').style.display = 'inline-block';
        
        const card = document.querySelector('.menu-editor-card');
        if(card) card.scrollIntoView({ behavior: 'smooth' });
        
        // Buka modal (karena form ada di dalam modal sekarang)
        /* document.getElementById('menu-form-modal').classList.add('active'); // Aktifkan baris ini jika form Anda menggunakan modal popup */
    }
};

function renderExistingImages() {
    const container = document.getElementById('image-previews');
    if(!container) return;
    container.innerHTML = '';
    currentEditingImages.forEach((url, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `<img src="${url}"><button class="btn-remove-img" onclick="removeExistingImage(${index})">x</button>`;
        container.appendChild(div);
    });
}

window.removeExistingImage = (index) => {
    currentEditingImages.splice(index, 1);
    renderExistingImages();
};

window.resetMenuForm = () => {
    document.getElementById('menu-id').value = "";
    document.getElementById('new-name').value = "";
    document.getElementById('new-price').value = "";
    document.getElementById('new-desc').value = "";
    document.getElementById('new-photos').value = "";
    document.getElementById('has-variant-toggle').value = "no"; // Reset toggle
    
    currentEditingImages = [];
    tempVariants = []; // Reset varian
    toggleVariantSection(); // Hide section varian
    
    const container = document.getElementById('image-previews');
    if(container) container.innerHTML = '<i class="ri-image-add-line"></i><p>Pilih foto</p>';
    
    document.getElementById('form-title').innerHTML = '<i class="ri-add-circle-line"></i> Form Menu';
    document.getElementById('btn-save-menu').innerHTML = '<i class="ri-save-line"></i> SIMPAN';
    document.getElementById('btn-cancel-edit').style.display = 'none';
};

window.deleteMenu = (id, name) => confirm(`Hapus ${name}?`) && deleteDoc(doc(db, "menu", id));

// --- POS REALTIME (OTOMATIS) ---
function initRealtimeOrders() {
    const grid = document.getElementById('orders-grid');
    if(!grid) return;
    
    // Listener Realtime: Setiap ada perubahan di database, kode ini jalan sendiri
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc")); 
    
    onSnapshot(q, (snapshot) => {
        grid.innerHTML = '';
        if (snapshot.empty) {
            grid.innerHTML = '<div class="empty-state"><i class="ri-cup-line"></i><p>Belum ada pesanan.</p></div>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            let actionButtons = '';
            let statusClass = '';

            // --- LOGIKA STATUS OTOMATIS ---
            
            // 1. QRIS BELUM DIBAYAR (Tampilan Menunggu)
            if (data.status === 'pending_payment') {
                statusClass = 'status-process'; 
                actionButtons = `
                    <div style="background:rgba(255, 165, 0, 0.1); border:1px dashed orange; color:orange; padding:10px; border-radius:8px; text-align:center; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <div class="spinner"></div> Menunggu Pembayaran Customer...
                    </div>`;
                // CSS Spinner ada di bawah
            }
            
            // 2. TUNAI (Menunggu Validasi Kasir)
            else if (data.status === 'process') {
                statusClass = 'status-process';
                actionButtons = `
                    <button onclick="updateStatus('${id}', 'paid')" class="btn-pos btn-pay">
                        <i class="ri-money-dollar-circle-line"></i> Terima Tunai
                    </button>`;
            } 
            
            // 3. SUDAH LUNAS (QRIS Sukses / Tunai Diterima) -> Tombol Muncul Otomatis
            else if (data.status === 'paid') {
                statusClass = 'status-paid';
                actionButtons = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                        <button onclick="printStruk('${id}')" class="btn-pos btn-print">
                            <i class="ri-printer-line"></i> Cetak
                        </button>
                        <button onclick="updateStatus('${id}', 'done')" class="btn-pos btn-done">
                            <i class="ri-check-line"></i> Selesai
                        </button>
                    </div>
                    <div style="text-align:center; font-size:0.7rem; color:#4caf50; margin-top:5px;">
                        <i class="ri-shield-check-line"></i> Lunas Terverifikasi
                    </div>`;
            } 
            
            // 4. SELESAI
            else if (data.status === 'done') {
                statusClass = 'status-done';
                actionButtons = `<div class="badge-completed"><i class="ri-checkbox-circle-line"></i> Selesai</div>`;
            }

            // Render Kartu
            const card = document.createElement('div');
            card.className = `order-card ${statusClass}`;
            card.innerHTML = `
                <div class="card-top">
                    <span class="card-id">#${id.substring(0,5)}</span>
                    <span class="card-table">Meja ${data.table}</span>
                </div>
                <div style="font-size:0.85rem; color:#aaa; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
                    <i class="ri-user-smile-line"></i> ${data.customer.name}
                </div>
                <div class="card-items">
                    ${data.items.map(i => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>${i.qty}x ${i.name} ${i.variant ? `<span style="font-size:0.8em; color:#00E5FF">(${i.variant})</span>` : ''}</span>
                            <span>${(i.price * i.qty).toLocaleString()}</span>
                        </div>
                        ${i.note ? `<small style="color:#d84315; display:block; margin-bottom:4px;">*${i.note}</small>` : ''}
                    `).join('')}
                </div>
                <div class="card-total">Total: Rp ${data.total.toLocaleString()}</div>
                <div class="card-actions">${actionButtons}</div>
            `;
            grid.appendChild(card);
        });
    });
}
// --- FUNGSI UPDATE STATUS ---
window.updateStatus = async (id, newStatus) => {
    let updateData = { status: newStatus };
    
    // Tambahkan timestamp sesuai status
    if (newStatus === 'paid') {
        updateData.paidAt = serverTimestamp();
    } else if (newStatus === 'done') {
        updateData.completedAt = serverTimestamp();
    }
    
    try { 
        await updateDoc(doc(db, "orders", id), updateData); 
    } catch (e) { 
        alert("Gagal update: " + e.message); 
    }
};

// --- FUNGSI KHUSUS MANUAL LUNAS (QRIS) ---
window.forcePay = (id) => {
    if(confirm("Pastikan pelanggan sudah menunjukkan bukti bayar sukses di HP mereka.\n\nUbah status jadi LUNAS secara manual?")) {
        updateStatus(id, 'paid');
    }
};

// --- FUNGSI CETAK STRUK ---
window.printStruk = async (id) => {
    try {
        const snap = await getDoc(doc(db, "orders", id));
        if(!snap.exists()) return alert("Data hilang!");
        const data = snap.data();
        
        // Gunakan paidAt jika ada, jika tidak gunakan createdAt
        const timeVal = data.paidAt ? data.paidAt : data.createdAt;
        const date = timeVal ? new Date(timeVal.seconds * 1000).toLocaleString('id-ID') : '-';
        
        let itemsHtml = '';
        data.items.forEach(i => {
            const variantText = i.variant ? `<br><small style="color:#555;">(${i.variant})</small>` : '';
            itemsHtml += `
                <tr>
                    <td style="padding:5px 0;">${i.qty}x ${i.name} ${variantText}</td>
                    <td style="text-align:right;">${(i.price * i.qty).toLocaleString()}</td>
                </tr>
                ${i.note ? `<tr><td colspan="2" style="font-size:10px; font-style:italic;">Catatan: ${i.note}</td></tr>` : ''}
            `;
        });

        const printArea = document.getElementById('thermal-print-area');
        if(!printArea) return;
        
        printArea.innerHTML = `
            <div class="receipt-box" style="font-family:monospace; width:100%; max-width:300px; padding:10px;">
                <center>
                    <b style="font-size:16px;">WAROENK ANDYA</b><br>
                    Jl. Panjunan, Sidoarjo<br>
                    --------------------------------
                </center>
                <div style="text-align:left; font-size:12px; margin:10px 0;">
                    ID: #${id.substring(0,6).toUpperCase()}<br>
                    Tgl: ${date}<br>
                    Meja: ${data.table}<br>
                    Cust: ${data.customer.name}<br>
                    Pay: ${data.paymentMethod === 'qris' ? 'QRIS' : 'TUNAI'}
                </div>
                <div style="border-bottom:1px dashed #000; margin:5px 0;"></div>
                <table width="100%" style="font-size:12px;">${itemsHtml}</table>
                <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>
                <table width="100%" style="font-size:14px; font-weight:bold;">
                    <tr>
                        <td>TOTAL</td>
                        <td align="right">Rp ${data.total.toLocaleString()}</td>
                    </tr>
                </table>
                <center style="margin-top:20px; font-size:12px;">
                    * LUNAS *<br>
                    Terima Kasih Kak!
                </center>
            </div>`;
            
        window.print();
    } catch (e) { 
        alert("Gagal mencetak: " + e.message); 
    }
};
// --- 7. LAPORAN MANAGER REALTIME ---
function initManagerReport() {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allOrdersData = [];
        snapshot.forEach((doc) => { allOrdersData.push({ id: doc.id, ...doc.data() }); });
        window.renderManagerReport(); 
    });
}

window.renderManagerReport = function() {
    const filterEl = document.getElementById('report-filter');
    const filterType = filterEl ? filterEl.value : 'all';
    const tbody = document.getElementById('rpt-body');
    if(!tbody) return;
    const now = new Date();
    let totalOmzet = 0;
    let totalTrx = 0;
    tbody.innerHTML = '';

    const filteredData = allOrdersData.filter(order => {
        if (!order.createdAt) return false;
        const d = new Date(order.createdAt.seconds * 1000);
        if (filterType === 'today') return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filterType === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return true;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">Belum ada data.</td></tr>';
    } else {
        filteredData.forEach(data => {
            const isRevenue = ['paid', 'done'].includes(data.status);
            if (isRevenue) { totalOmzet += data.total; totalTrx++; }
            const timeString = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('id-ID') : '-';
            let statusColor = data.status === 'process' ? '#f1c40f' : (data.status === 'paid' ? '#2980b9' : '#27ae60');
            tbody.innerHTML += `<tr><td>${timeString}</td><td style="font-family:monospace;">#${data.id.substring(0,6)}</td><td>${data.customer.name}</td><td>Rp ${parseInt(data.total).toLocaleString('id-ID')}</td><td style="color:${statusColor}; font-weight:bold;">${data.status.toUpperCase()}</td></tr>`;
        });
    }

    const revEl = document.getElementById('rpt-revenue');
    const trxEl = document.getElementById('rpt-trx');
    const profEl = document.getElementById('rpt-profit');
    const footEl = document.getElementById('tbl-total-footer');
    if(revEl) revEl.innerText = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    if(trxEl) trxEl.innerText = totalTrx;
    if(profEl) profEl.innerText = `Rp ${(totalOmzet * 0.4).toLocaleString('id-ID')}`;
    if(footEl) footEl.innerText = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    const periodEl = document.getElementById('report-period');
    const signEl = document.getElementById('sign-date');
    if(periodEl) periodEl.innerText = "Periode: " + (filterType === 'today' ? "Hari Ini" : (filterType === 'month' ? "Bulan Ini" : "Semua Data"));
    if(signEl) signEl.innerText = now.toLocaleDateString('id-ID');
};

window.downloadPDF = function() {
    const element = document.getElementById('report-printable');
    if(element) html2pdf().from(element).save(`Laporan_Waroenk_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- 8. KITCHEN DISPLAY SYSTEM (KDS) ---
function initKitchenDisplay() {
    const grid = document.getElementById('kitchen-grid');
    const countEl = document.getElementById('pending-count'); 
    if(!grid) return;
    const q = query(collection(db, "orders"), where("status", "==", "paid"), orderBy("paidAt", "asc"));
    onSnapshot(q, (snapshot) => {
        if(countEl) countEl.innerText = snapshot.size;
        grid.innerHTML = '';
        if (snapshot.empty) { grid.innerHTML = '<div class="empty-state"><p>Dapur bersih! Belum ada pesanan masuk.</p></div>'; return; }
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const paidTime = d.paidAt ? new Date(d.paidAt.seconds * 1000) : new Date();
            const now = new Date();
            const waitMinutes = Math.floor((now - paidTime) / 60000);
            const timeColor = waitMinutes > 15 ? '#ff5252' : 'var(--neon-gold)';
            const card = document.createElement('div');
            card.className = 'kitchen-card';
            
            // Render Items dengan Varian
            const itemsHtml = d.items.map(i => `
                <div class="k-item-row" style="margin-bottom:15px; border-bottom:1px solid #2a2a2a; padding-bottom:10px;">
                    <div style="display:flex; gap:12px; align-items:flex-start;">
                        <span class="k-qty" style="background:var(--neon-gold); color:#000; min-width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:800;">${i.qty}</span>
                        <div style="flex:1;">
                            <span class="k-name" style="font-size:1.15rem; font-weight:700; color:#fff; display:block;">${i.name}</span>
                            ${i.variant ? `<span class="k-variant" style="color:var(--neon-blue); font-size:0.85rem; font-weight:600; display:block; margin-top:2px;">Varian: ${i.variant}</span>` : ''}
                            ${i.note ? `<div class="k-note" style="margin-top:8px; background:rgba(216, 67, 21, 0.15); padding:6px 10px; border-radius:6px; border-left:3px solid var(--primary); font-size:0.85rem; color:#ff8a65; font-style:italic;"><strong>Catatan:</strong> "${i.note}"</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="k-header">
                    <div style="display:flex; flex-direction:column;">
                        <span class="k-table">MEJA ${d.table}</span>
                        <span style="font-size:0.8rem; color:#aaa; margin-top:2px;">#${id.substring(0,8)}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="display:block; font-size:1rem; font-weight:700; color:${timeColor};"><i class="ri-time-line"></i> ${waitMinutes}m</span>
                        <span style="font-size:0.75rem; color:#888;">${paidTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
                <div class="k-customer-bar" style="background:#252525; padding:8px 15px; border-bottom:1px solid #333;">
                    <span style="font-size:0.9rem; font-weight:600; color:var(--neon-blue);"><i class="ri-user-smile-line"></i> ${d.customer.name.toUpperCase()}</span>
                </div>
                <div class="k-body" style="padding:15px; flex:1;">${itemsHtml}</div>
                <div class="k-footer" style="padding:15px; background:#151515;">
                    <button onclick="updateStatus('${id}', 'done')" class="btn-ready" style="width:100%; padding:14px; background:var(--neon-green); color:#000; border:none; border-radius:8px; font-weight:800; font-size:1rem; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">PESANAN SELESAI <i class="ri-check-double-line"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

// --- EXPOSE FUNCTIONS ---
window.showPage = (p) => {
    document.querySelectorAll('.page-section').forEach(e => e.style.display = 'none');
    const page = document.getElementById('page-'+p);
    if(page) page.style.display = 'block';
    if (p === 'report') window.renderManagerReport();
};
window.updateStatus = updateStatus;
window.printStruk = printStruk;
window.editMenu = editMenu;
window.deleteMenu = deleteMenu;
window.saveMenu = saveMenu;
window.resetMenuForm = resetMenuForm;
window.removeExistingImage = removeExistingImage;