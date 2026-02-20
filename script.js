// --- 1. IMPORT FIREBASE MODULAR ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDoc, getDocs, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- KONFIGURASI API ---
const MIDTRANS_SERVER_URL = "http://localhost:3000/createTransaction"; // Pastikan backend jalan & Ngrok aktif jika perlu

// --- GLOBAL VARIABLES ---
let menuItems = [];
let cart = JSON.parse(localStorage.getItem('waroenkCart')) || [];
let currentItem = null;
let selectedVariant = null; 
let selectedPaymentMethod = 'cash'; 
const ADMIN_WA_NUMBER = "6285748175548"; 

// --- HELPER FUNCTIONS ---
const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

function getDeviceId() {
    let deviceId = localStorage.getItem('waroenk_device_id');
    if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('waroenk_device_id', deviceId);
    }
    return deviceId;
}

// --- 3. INIT HALAMAN ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('meja')) localStorage.setItem('waroenkTable', urlParams.get('meja'));
    
    const displayTable = document.getElementById('display-table-number');
    if(displayTable) displayTable.innerText = localStorage.getItem('waroenkTable') || "Bungkus";

    getDeviceId();

    if (document.getElementById('menu-container')) {
        fetchMenuData(); 
        updateCartDisplay();
        setupSearch();
    } else if (document.getElementById('order-list')) {
        fetchMenuDataForCheckout();
    } else if (document.getElementById('tracking-result') || document.getElementById('history-list')) {
        loadTrackingPage();
    }
});

// --- 4. DATA FETCHING ---
async function fetchMenuData() {
    const container = document.getElementById('menu-container');
    try {
        const q = query(collection(db, "menu"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        menuItems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let imgUrl = data.images?.[0] || data.image || 'https://via.placeholder.com/150';
            menuItems.push({ id: doc.id, ...data, image: imgUrl });
        });
        renderMenu('all');
    } catch (error) {
        if(container) container.innerHTML = `<div style="text-align:center; padding:40px;">Gagal memuat menu.</div>`;
    }
}

async function fetchMenuDataForCheckout() {
    try {
        const q = query(collection(db, "menu"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        menuItems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let imgUrl = data.images?.[0] || data.image || 'https://via.placeholder.com/150';
            menuItems.push({ id: doc.id, ...data, image: imgUrl });
        });
        loadCheckoutPage(); 
    } catch (e) { console.error(e); }
}

function renderMenu(category) {
    const container = document.getElementById('menu-container');
    if(!container) return;
    container.innerHTML = '';
    const filtered = category === 'all' ? menuItems : menuItems.filter(m => m.category === category);
    
    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa; width:100%;">Menu tidak tersedia.</div>`;
        return;
    }

    filtered.forEach(item => {
        const isHabis = item.status === 'empty';
        const card = document.createElement('div');
        card.className = 'menu-card';
        if(isHabis) card.style = 'opacity:0.5; pointer-events:none;';
        
        card.innerHTML = `
            ${isHabis ? '<span class="badge-habis" style="position:absolute; top:8px; left:8px; z-index:10; background:red; color:white; font-size:10px; padding:2px 6px; border-radius:4px;">HABIS</span>' : ''}
            <div class="menu-img-wrapper"><img src="${item.image}" class="menu-img"></div>
            <div class="menu-details">
                <h3 class="menu-title">${item.name}</h3>
                <div class="menu-info-row"><span><i class="ri-restaurant-line"></i> ${item.category || 'Menu'}</span></div>
                <div class="menu-price-tag">${formatRupiah(item.price)}</div>
            </div>
            <div class="menu-action-right"><div class="btn-add-mini"><i class="ri-add-line"></i></div></div>
        `;
        card.onclick = () => { if(!isHabis) openModal(item); };
        container.appendChild(card);
    });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const container = document.getElementById('menu-container');
        container.innerHTML = '';
        const results = menuItems.filter(m => m.name.toLowerCase().includes(val));
        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'menu-card';
            card.innerHTML = `
                <div class="menu-img-wrapper"><img src="${item.image}" class="menu-img"></div>
                <div class="menu-details"><h3 class="menu-title">${item.name}</h3><span class="menu-price-tag">${formatRupiah(item.price)}</span></div>
                <div class="menu-action-right"><div class="btn-add-mini"><i class="ri-add-line"></i></div></div>`;
            card.onclick = () => openModal(item);
            container.appendChild(card);
        });
    });
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderMenu(this.dataset.category);
        });
    });
}

// --- 5. MODAL & CART ---
window.openModal = function(item) {
    currentItem = item;
    selectedVariant = null;
    document.getElementById('modal-title').innerText = item.name;
    document.getElementById('modal-desc').innerText = item.desc || '-';
    document.getElementById('modal-price').innerText = formatRupiah(item.price);
    const modalImg = document.getElementById('modal-img');
    if(modalImg) { modalImg.src = item.image; modalImg.style.display = 'block'; }
    
    const variantSection = document.getElementById('variant-section');
    const variantContainer = document.getElementById('variant-options');
    
    if (variantSection) {
        if (item.variants && item.variants.length > 0) {
            variantSection.style.display = 'block';
            variantContainer.innerHTML = '';
            item.variants.forEach(v => {
                const btn = document.createElement('button');
                btn.className = 'variant-chip';
                btn.innerText = v;
                btn.onclick = (e) => { e.stopPropagation(); selectVariant(btn, v); };
                variantContainer.appendChild(btn);
            });
        } else { variantSection.style.display = 'none'; }
    }
    document.getElementById('product-modal').classList.add('open');
};

window.closeModal = () => document.getElementById('product-modal').classList.remove('open');
window.selectVariant = (btn, name) => {
    document.querySelectorAll('.variant-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedVariant = name;
};

window.addToCart = () => {
    if (currentItem.variants && currentItem.variants.length > 0 && !selectedVariant) return alert("Pilih varian dulu!");
    const note = document.getElementById('modal-note').value;
    const exist = cart.find(x => x.id === currentItem.id && x.variant === selectedVariant && x.note === note);
    if(exist) exist.qty++;
    else cart.push({ id: currentItem.id, name: currentItem.name, price: currentItem.price, variant: selectedVariant, note: note, qty: 1 });
    localStorage.setItem('waroenkCart', JSON.stringify(cart));
    updateCartDisplay();
    closeModal();
};

function updateCartDisplay() {
    const bar = document.getElementById('cart-wrapper');
    if(!bar) return;
    if(cart.length > 0) {
        bar.classList.add('active');
        document.getElementById('cart-count').innerText = cart.length;
        const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
        document.getElementById('cart-total').innerText = formatRupiah(total);
    } else { bar.classList.remove('active'); }
}

window.showCheckout = () => {
    if(cart.length === 0) return alert("Keranjang kosong!");
    window.location.href = 'checkout.html';
};

// --- 6. CHECKOUT & PAYMENT ---
window.selectPayment = (el, method) => {
    document.querySelectorAll('.payment-method').forEach(e => e.classList.remove('selected'));
    if(el) el.classList.add('selected');
    selectedPaymentMethod = method;
};

window.loadCheckoutPage = () => {
    cart = JSON.parse(localStorage.getItem('waroenkCart')) || [];
    const container = document.getElementById('order-list');
    
    const payContainer = document.getElementById('payment-section-container');
    if(payContainer && payContainer.innerHTML.trim() === "") {
        payContainer.innerHTML = `
            <h3 class="payment-section-title">Pilih Pembayaran</h3>
            <div class="payment-method ${selectedPaymentMethod === 'cash' ? 'selected' : ''}" onclick="selectPayment(this, 'cash')">
                <div class="payment-icon-box"><i class="ri-store-2-line"></i></div>
                <div class="payment-info"><span class="payment-name">Bayar di Kasir</span><span class="payment-desc">Tunai / Debit saat pulang</span></div>
                <div class="payment-radio"></div>
            </div>
            <div class="payment-method ${selectedPaymentMethod === 'qris' ? 'selected' : ''}" onclick="selectPayment(this, 'qris')">
                <div class="payment-icon-box"><i class="ri-qr-code-line"></i></div>
                <div class="payment-info"><span class="payment-name">QRIS (Scan & Go)</span><span class="payment-desc">GoPay, Shopee, Dana</span></div>
                <div class="payment-radio"></div>
            </div>`;
    }

    if(!container) return;
    container.innerHTML = '';
    let subtotal = 0;
    cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        const imgUrl = menuItems.find(m => m.id === item.id)?.image || 'https://via.placeholder.com/80';
        container.innerHTML += `
            <div class="checkout-item">
                <div class="checkout-img-box"><img src="${imgUrl}"></div>
                <div class="checkout-details">
                    <h4>${item.name}</h4>
                    ${item.variant ? `<span style="font-size:0.8rem; color:var(--neon-blue); display:block;">Varian: ${item.variant}</span>` : ''}
                    <div class="checkout-price">${formatRupiah(item.price * item.qty)}</div>
                </div>
                <div class="checkout-controls">
                    <div class="qty-pill">
                        <button onclick="changeQty(${index}, -1)">-</button><span>${item.qty}</span><button onclick="changeQty(${index}, 1)">+</button>
                    </div>
                    <button class="btn-remove-checkout" onclick="deleteItem(${index})"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>`;
    });
    
    const tax = subtotal * 0.1;
    if(document.getElementById('subtotal-display')) document.getElementById('subtotal-display').innerText = formatRupiah(subtotal);
    if(document.getElementById('tax-display')) document.getElementById('tax-display').innerText = formatRupiah(tax);
    if(document.getElementById('total-display')) document.getElementById('total-display').innerText = formatRupiah(subtotal + tax);
};

window.changeQty = (idx, delta) => {
    cart[idx].qty += delta;
    if(cart[idx].qty <= 0) { if(confirm("Hapus?")) cart.splice(idx, 1); else cart[idx].qty = 1; }
    localStorage.setItem('waroenkCart', JSON.stringify(cart));
    loadCheckoutPage();
};
window.deleteItem = (idx) => { if(confirm("Hapus?")) { cart.splice(idx, 1); localStorage.setItem('waroenkCart', JSON.stringify(cart)); loadCheckoutPage(); }};

// --- LOGIKA ORDER & MIDTRANS ---
window.processOrder = async () => {
    const name = document.getElementById('cust-name').value;
    const wa = document.getElementById('cust-wa').value;
    const table = localStorage.getItem('waroenkTable') || "Bungkus";
    
    if(!name || !wa) return alert("Mohon isi Nama & WhatsApp!");
    if(cart.length === 0) return alert("Keranjang kosong!");

    const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const total = subtotal + (subtotal * 0.1);
    const initialStatus = selectedPaymentMethod === 'cash' ? 'process' : 'pending_payment';

    const orderData = {
        customer: { name, wa },
        deviceId: getDeviceId(),
        table: table,
        items: cart,
        total: total,
        paymentMethod: selectedPaymentMethod,
        status: initialStatus,
        createdAt: serverTimestamp()
    };

    const btn = document.querySelector('.btn-pay');
    if(btn) { btn.innerText = "Memproses..."; btn.disabled = true; }

    try {
        const docRef = await addDoc(collection(db, "orders"), orderData);
        const tempCart = [...cart];

        if (selectedPaymentMethod === 'qris') {
            await processMidtransPayment(docRef.id, total, tempCart);
        } else {
            // Tunai -> Tampilkan struk dulu di checkout (bukan auto redirect)
            // Struk checkout.html otomatis muncul jika kita tidak redirect langsung
            // Tapi fungsi finishOrder Anda punya logika isAutoRedirect
            
            // Simpan ID agar struk bisa mengambil data, lalu bersihkan cart
            finishOrder(docRef.id, tempCart, 'TUNAI', false); 
        }
    } catch (e) {
        alert("Gagal: " + e.message);
        if(btn) { btn.innerText = "Konfirmasi Pesanan"; btn.disabled = false; }
    }
};

// --- REVISI: PROSES MIDTRANS (Hanya Redirect, Tidak Update DB) ---
async function processMidtransPayment(orderId, totalAmount, tempCart) {
    try {
        const response = await fetch(MIDTRANS_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId, grossAmount: Math.round(totalAmount) })
        });
        const data = await response.json();

        window.snap.pay(data.token, {
            onSuccess: function(result) {
                console.log("Pembayaran Berhasil via Snap");
                
                // --- PERUBAHAN DISINI ---
                // Kita HAPUS perintah 'updateDoc' dari sini.
                // Karena Rules Firebase melarang Guest mengupdate data.
                // Biarkan Server.js (Webhook) yang mengupdate status jadi 'paid'.
                
                // Langsung Redirect Otomatis
                finishOrder(orderId, tempCart, 'QRIS (PROSES)', true); 
            },
            onPending: function(result) {
                alert("Silakan selesaikan pembayaran QRIS Anda.");
                window.location.href = `track.html?id=${orderId}`;
            },
            onError: function(result) {
                alert("Pembayaran Gagal!");
            },
            onClose: function() {
                alert('Anda menutup jendela pembayaran sebelum selesai.');
                window.location.href = `track.html?id=${orderId}`;
            }
        });
    } catch (e) {
        alert("Gagal memuat pembayaran: " + e.message);
    }
}

function finishOrder(orderId, tempCart, payMethodText, isAutoRedirect = false) {
    localStorage.removeItem('waroenkCart');
    cart = [];
    const link = `track.html?id=${orderId}`;
    
    if (isAutoRedirect) {
        window.location.href = link;
    } else {
        // Mode Tunai: Tampilkan Modal Struk di Checkout Page
        const dummyData = {
            table: localStorage.getItem('waroenkTable') || "-",
            total: tempCart.reduce((s, i) => s + (i.price * i.qty), 0) * 1.1,
            paymentMethod: selectedPaymentMethod
        };
        showReceiptModal(dummyData, orderId, link, tempCart);
    }
}

function showReceiptModal(data, id, link, itemsList) {
    const modal = document.getElementById('receipt-modal');
    if(!modal) return;
    
    const payText = data.paymentMethod === 'qris' ? 'QRIS' : 'TUNAI';
    document.getElementById('receipt-meta').innerHTML = `ID : #${id.substring(0,6).toUpperCase()}<br>Meja: ${data.table}<br>Pay : ${payText}`;
    
    const container = document.getElementById('receipt-items');
    container.innerHTML = '';
    itemsList.forEach(i => {
        container.innerHTML += `<div class="receipt-item-row"><span>${i.qty}x ${i.name}</span><span>${formatRupiah(i.price * i.qty)}</span></div>`;
    });
    
    document.getElementById('receipt-total-display').innerText = formatRupiah(data.total);
    const waMsg = `Order Baru! ID:${id} Total:${formatRupiah(data.total)}`;
    document.getElementById('receipt-actions').innerHTML = `
        <div class="receipt-btn-group">
            <a href="https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(waMsg)}" target="_blank" class="btn-wa">Kirim ke WA</a>
            <button onclick="location.href='track.html?id=${id}'" class="btn-track">Pantau</button>
        </div>`;
    modal.classList.add('active');
}

// --- 7. TRACKING & HISTORY ---
window.loadTrackingPage = () => {
    const trackingContainer = document.getElementById('tracking-result');
    const historyContainer = document.getElementById('history-list');
    const deviceId = getDeviceId();

    // Query tanpa orderBy jika index belum dibuat akan error
    // Tambahkan error catching
    const q = query(
        collection(db, "orders"), 
        where("deviceId", "==", deviceId), 
        orderBy("createdAt", "desc"), 
        limit(20)
    );

    onSnapshot(q, (snapshot) => {
        if(trackingContainer) trackingContainer.innerHTML = '';
        if(historyContainer) historyContainer.innerHTML = '';

        if (snapshot.empty) {
            trackingContainer.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.7;"><p>Belum ada riwayat.</p><a href="index.html" class="btn-home">Pesan</a></div>`;
            return;
        }

        const orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

        // Render Latest Order (Top)
        renderTrackingCard(orders[0].id, orders[0]);

        // Render History (Bottom)
        if (orders.length > 1) {
            for (let i = 1; i < orders.length; i++) renderHistoryItem(orders[i], historyContainer);
        } else {
            historyContainer.innerHTML = '<p style="text-align:center; font-size:0.8rem; color:#555; padding:20px;">Belum ada riwayat lama.</p>';
        }
        
        // Alarm 10 Detik
        if (orders[0].status === 'done' && !localStorage.getItem('notified_' + orders[0].id)) {
            playLongAlarm();
            localStorage.setItem('notified_' + orders[0].id, 'true');
        }
    }, (error) => {
        console.error("Error fetching history:", error);
        if (trackingContainer) trackingContainer.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Gagal memuat riwayat. Pastikan Index Firestore sudah dibuat (Cek Console).</div>`;
    });
};

function renderHistoryItem(data, container) {
    const timeStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('id-ID') : '-';
    const payText = data.paymentMethod === 'qris' ? 'QRIS' : 'Tunai';
    let menuHtml = '';
    data.items.forEach(item => menuHtml += `<div class="history-item-row" style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem; color:#eceff1;"><span>${item.qty}x ${item.name}</span></div>`);

    container.innerHTML += `
        <div class="history-card" style="background:var(--bg-card); border:1px solid #333; border-radius:15px; padding:15px; margin-bottom:15px;">
            <div class="history-header" style="display:flex; justify-content:space-between; border-bottom:1px dashed #444; padding-bottom:8px; margin-bottom:10px;">
                <div><div style="font-family:monospace; color:var(--text-dim); font-size:0.8rem;">#${data.id.substring(0,6).toUpperCase()}</div><div style="font-weight:bold;">${data.customer.name}</div></div>
                <div style="text-align:right;"><div style="font-size:0.75rem; color:var(--wood);">${timeStr}</div><div style="font-size:0.75rem; color:var(--neon-green); text-transform:uppercase;">${data.status}</div></div>
            </div>
            <div class="history-items">${menuHtml}</div>
            <div class="history-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #444; padding-top:10px;">
                <div><div style="font-size:0.8rem; color:var(--text-dim);">${payText}</div><div style="color:var(--neon-gold); font-weight:bold;">${formatRupiah(data.total)}</div></div>
                <button onclick='triggerReorder(${JSON.stringify(data.items)})' style="background:rgba(0, 229, 255, 0.1); color:var(--neon-blue); border:1px solid var(--neon-blue); padding:6px 12px; border-radius:50px; cursor:pointer;">Pesan Lagi</button>
            </div>
        </div>`;
}

function renderTrackingCard(id, data) {
    const container = document.getElementById('tracking-result');
    if(!container) return;
    const steps = { 'pending_payment': 1, 'process': 1, 'paid': 2, 'done': 3 };
    const current = steps[data.status] || 1;
    const formatTimeLocal = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

    container.innerHTML = `
        <div class="status-card ${data.status === 'done' ? 'order-done' : ''}">
            <span class="order-id">#${id.substring(0,6)}</span>
            <p style="color:#aaa; margin-bottom:20px;">Meja ${data.table} • ${data.customer.name}</p>
            <div class="status-step ${current >= 1 ? 'active' : ''}"><div class="step-icon"><i class="ri-file-list-3-line"></i></div><div class="step-text"><div style="display:flex; justify-content:space-between;"><h4>Pesanan Masuk</h4><small>${formatTimeLocal(data.createdAt)}</small></div></div></div>
            <div class="status-step ${current >= 2 ? 'active' : ''}"><div class="step-icon"><i class="ri-fire-line"></i></div><div class="step-text"><div style="display:flex; justify-content:space-between;"><h4>Diproses</h4><small>${formatTimeLocal(data.paidAt)}</small></div></div></div>
            <div class="status-step ${current >= 3 ? 'active done-step' : ''}"><div class="step-icon"><i class="ri-check-double-line"></i></div><div class="step-text"><div style="display:flex; justify-content:space-between;"><h4>SIAP</h4><small>${formatTimeLocal(data.completedAt)}</small></div></div></div>
            <a href="index.html" class="btn-home" style="margin-top:20px; display:block; text-align:center;">Kembali ke Menu</a>
        </div>`;
}

function playLongAlarm() {
    const audio = document.getElementById('bell-sound') || new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.loop = true; audio.play().catch(() => {});
    setTimeout(() => { audio.pause(); audio.currentTime = 0; audio.loop = false; }, 10000);
}

window.triggerReorder = (itemsData) => {
    if(!confirm("Pesan lagi?")) return;
    localStorage.setItem('waroenkCart', JSON.stringify(itemsData));
    window.location.href = 'checkout.html';
};

window.reorderItems = async (event, orderId) => {
    event.stopPropagation();
    try {
        const docSnap = await getDoc(doc(db, "orders", orderId));
        if(docSnap.exists()) triggerReorder(docSnap.data().items);
    } catch (e) { alert("Error"); }
};

// --- EXPOSE ---
window.addToCart = addToCart;
window.closeModal = closeModal;
window.changeQty = changeQty;
window.deleteItem = deleteItem;
window.processOrder = processOrder;
window.showCheckout = showCheckout;
window.selectVariant = selectVariant;
window.reorderItems = reorderItems;
window.selectPayment = selectPayment;
window.triggerReorder = triggerReorder;