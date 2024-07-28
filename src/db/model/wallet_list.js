const mongoose = require('mongoose');
const uuid = require('uuid');
const Schema = mongoose.Schema;

let model = new Schema({
    _id: { type: String, default: uuid.v4 },
    mint_address: { type: String },
    symbol: { type: String },
    wallet_address: { type: String },
    amount: { type: Number },
    tag: { type: String },
    createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model('wallet_list', model);