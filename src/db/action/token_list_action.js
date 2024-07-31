let tokenListModel = require('../model/token_list')

const getExistWebhookData = async () => {
    let last_field = (await tokenListModel.find().limit(1).sort({createdAt: -1}));
    if(last_field.length > 0) {
        return [last_field[0].webhook_id, last_field[0].wallet_list];
    }
    else return ['', []];
}

const addToken = async (newOne) => {
    let is_exist = await tokenListModel.find({ mint_address: newOne.mint_address, chat_id: newOne.chat_id })
    if (is_exist.length > 0) {
        return ` ⚠️ Your provided URL is already registered.`
    } else {
        let newToken = new tokenListModel()
        newToken.chat_id = newOne.chat_id
        newToken.mint_address = newOne.mint_address
        newToken.symbol = newOne.symbol
        newToken.amount = newOne.amount
        newToken.wallet_list = newOne.wallet_list
        newToken.wallet_number = newOne.wallet_number
        newToken.is_active = newOne.is_active
        newToken.webhook_id = newOne.webhook_id
        await newToken.save()
        return `${newOne.symbol} ${newOne.wallet_number} wallets ${(newOne.amount).toFixed(2)}M tokens holding\n 🎉 It registered successfully and you will get real time notification after 3mins from now.`
    }
}

module.exports = {
    getExistWebhookData,
    addToken
}