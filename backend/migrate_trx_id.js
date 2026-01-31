const mongoose = require('mongoose');

console.log('Starting TRX ID migration...');
const uri = 'mongodb://127.0.0.1:27017/accounts_v4';

mongoose.connect(uri)
    .then(async () => {
        console.log('Connected to DB');
        const db = mongoose.connection.db;

        console.log('Fetching transactions...');
        const txns = await db.collection('transactions').find().sort({ createdAt: 1 }).toArray();
        console.log('Found ' + txns.length + ' transactions.');

        let seq = 0;
        for (const txn of txns) {
            seq++;
            const trxId = 'TRX' + String(seq).padStart(3, '0');
            await db.collection('transactions').updateOne(
                { _id: txn._id },
                { $set: { trx_id: trxId } }
            );
            if (seq % 5 === 0) console.log('Updated ' + seq + ' with ' + trxId);
        }

        console.log('TRX ID migration complete. Total: ' + seq);
        process.exit(0);
    })
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
