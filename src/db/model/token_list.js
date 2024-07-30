const mongoose = require('mongoose');
const uuid = require('uuid');
const Schema = mongoose.Schema;

let model = new Schema({
    _id: { type: String, default: uuid.v4 },
    chat_id: { type: String },
    mint_address: { type: String },
    symbol: { type: String },
    amount: { type: Number },
    wallet_list: { type: Array },
    wallet_number: { type: Number },
    is_active: { type: Boolean, default: true },
    webhook_id: { type: String, default: '' },
    createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model('token_list', model);