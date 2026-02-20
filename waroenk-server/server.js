const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');
const admin = require('firebase-admin');

// --- 1. INISIALISASI FIREBASE ADMIN ---
// Download file JSON Service Account dari Firebase Console:
// Project Settings > Service Accounts > Generate New Private Key
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: 'SB-Mid-server-6rUbZ8-DNSyhYpWbeAgA7cgA' // GANTI DENGAN KEY ANDA
});

// Rute untuk Membuat Transaksi
app.post('/createTransaction', async (req, res) => {
    try {
        const { orderId, grossAmount } = req.body;
        const parameter = {
            transaction_details: { order_id: orderId, gross_amount: grossAmount },
            credit_card: { secure: true }
        };
        const transaction = await snap.createTransaction(parameter);
        res.json({ token: transaction.token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 2. RUTE WEBHOOK (NOTIFIKASI OTOMATIS) ---
// PERBAIKAN: Ubah '/notification' menjadi '/midtrans-notification' sesuai settingan Midtrans Anda
app.post('/midtrans-notification', async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`Notifikasi Diterima! Order ID: ${orderId}. Status: ${transactionStatus}`);

        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            if (fraudStatus == 'accept' || fraudStatus == undefined) {
                // UPDATE FIREBASE JADI PAID
                await db.collection('orders').doc(orderId).update({
                    status: 'paid',
                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                    paymentDetail: statusResponse
                });
                console.log(`SUKSES: Order ${orderId} telah diubah menjadi PAID`);
            }
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            // UPDATE FIREBASE JADI FAILED
            await db.collection('orders').doc(orderId).update({ status: 'failed' });
            console.log(`GAGAL: Order ${orderId} dibatalkan/expired`);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error("Webhook Error:", error.message);
        res.status(500).send(error.message);
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));