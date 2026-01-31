const mongoose = require('mongoose');

console.log('Starting migration...');
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
            // Update to number
            await db.collection('transactions').updateOne(
                { _id: txn._id },
                { $set: { serial_number: seq } }
            );
            if (seq % 10 === 0) console.log('Updated ' + seq);
        }

        console.log('Updating counter...');
        await db.collection('counters').updateOne(
            { _id: 'transaction_serial' },
            { $set: { seq: seq } },
            { upsert: true }
        );

        console.log('Resequencing complete. Total: ' + seq);
        process.exit(0);
    })
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
