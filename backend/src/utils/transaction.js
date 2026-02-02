const mongoose = require('mongoose');
const { logger } = require('./logger');

let isReplicaSet = false;
let replicaSetChecked = false;

/**
 * Check if MongoDB is running as a replica set
 * Transactions only work on replica sets or sharded clusters
 */
const checkReplicaSet = async () => {
    if (replicaSetChecked) return isReplicaSet;

    try {
        const admin = mongoose.connection.db.admin();
        const result = await admin.command({ isMaster: 1 });

        isReplicaSet = !!(result.setName || result.msg === 'isdbgrid');
        replicaSetChecked = true;

        if (isReplicaSet) {
            logger.info('MongoDB replica set detected - transactions enabled');
        } else {
            logger.warn('MongoDB standalone detected - transactions disabled (operations will run without ACID guarantees)');
        }
    } catch (error) {
        logger.error('Failed to check replica set status', { error: error.message });
        isReplicaSet = false;
        replicaSetChecked = true;
    }

    return isReplicaSet;
};

/**
 * Execute a function with or without a transaction based on replica set availability
 * @param {Function} fn - Async function to execute, receives session as parameter
 * @returns {Promise<any>} - Result of the function
 */
const withTransaction = async (fn) => {
    await checkReplicaSet();

    if (isReplicaSet) {
        // Use transactions
        const session = await mongoose.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                result = await fn(session);
            });
            await session.endSession();
            return result;
        } catch (error) {
            await session.endSession();
            throw error;
        }
    } else {
        // Run without transaction (pass null as session)
        return await fn(null);
    }
};

module.exports = {
    checkReplicaSet,
    withTransaction,
    isReplicaSetAvailable: () => isReplicaSet
};
