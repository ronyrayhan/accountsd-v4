const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountsd-v4';

const resetDb = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB at', MONGODB_URI);

        const collections = await mongoose.connection.db.collections();

        if (collections.length === 0) {
            console.log('Database is already empty.');
        } else {
            console.log(`Found ${collections.length} collections. Dropping them now...`);
            for (let collection of collections) {
                await collection.drop();
                console.log(`Dropped collection: ${collection.collectionName}`);
            }
            console.log('All collections dropped successfully.');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error resetting database:', error);
        process.exit(1);
    }
};

resetDb();
