const mongoose = require('mongoose');

// Connect to MongoDB
// Note: Using the environment variable or a default localhost string as typically found in these projects
// Assuming local instance for dev based on previous context
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
