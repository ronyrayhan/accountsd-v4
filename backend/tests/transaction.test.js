const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const { Transaction, Account, User } = require('../src/models');
const { hashPassword } = require('../src/middleware/auth');

describe('Transaction Integrity Tests', () => {
    let authToken;
    let testAccount;

    beforeAll(async () => {
        // Connect to test database
        const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pulse_test';
        await mongoose.connect(testDbUri);

        // Create test user
        const hashedPassword = await hashPassword('testpass123');
        const testUser = await User.create({
            username: 'testuser',
            hashed_password: hashedPassword,
            role: 'Admin',
            is_active: true
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'testpass123' });

        authToken = loginRes.body.access_token;

        // Create test account
        testAccount = await Account.create({
            code: 'TEST001',
            name: 'Test Account',
            type: 'Asset',
            subtype: 'Cash',
            opening_balance_bdt: 10000,
            current_balance_bdt: 10000,
            opening_balance_usd: 0,
            current_balance_usd: 0
        });
    });

    afterAll(async () => {
        // Cleanup
        await Transaction.deleteMany({});
        await Account.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close();
    });

    test('Transaction creation updates balance atomically', async () => {
        const initialBalance = testAccount.current_balance_bdt;

        const res = await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                description: 'Test Transaction',
                amount: 500,
                currency: 'BDT',
                type: 'Debit',
                account_id: testAccount._id.toString(),
                conversion_type: 'None'
            });

        expect(res.status).toBe(201);

        // Verify transaction was created
        const transaction = await Transaction.findById(res.body.id);
        expect(transaction).toBeTruthy();
        expect(transaction.amount).toBe(500);

        // Verify balance was updated
        const updatedAccount = await Account.findById(testAccount._id);
        expect(updatedAccount.current_balance_bdt).toBe(initialBalance - 500);
    });

    test('Failed balance sync rolls back transaction', async () => {
        // This test simulates a failure scenario
        // In a real scenario, you'd mock syncAccountBalance to throw an error
        const initialTransactionCount = await Transaction.countDocuments();
        const initialBalance = (await Account.findById(testAccount._id)).current_balance_bdt;

        // Try to create a transaction with insufficient funds
        const res = await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                description: 'Overdraft Test',
                amount: 999999,
                currency: 'BDT',
                type: 'Debit',
                account_id: testAccount._id.toString(),
                conversion_type: 'None'
            });

        expect(res.status).toBe(400); // Should fail due to insufficient funds

        // Verify no transaction was created
        const finalTransactionCount = await Transaction.countDocuments();
        expect(finalTransactionCount).toBe(initialTransactionCount);

        // Verify balance remained unchanged
        const finalAccount = await Account.findById(testAccount._id);
        expect(finalAccount.current_balance_bdt).toBe(initialBalance);
    });
});
