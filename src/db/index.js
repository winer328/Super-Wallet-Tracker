const mongoose = require('mongoose')

const mongoConnect = async (callback) => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 90000,
            socketTimeoutMS: 90000,
        })
        
        console.log(' ✅  Database Connected')
        callback()
    } catch (err) {
        console.log(' ❌  Mongodb Connection Error')
        console.error(err);
    }
}

module.exports = mongoConnect