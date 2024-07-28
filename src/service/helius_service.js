const axios = require('axios');
const web3 = require("@solana/web3.js");
const connection = new web3.Connection(process.env.HTTP_RPC_URL, { wsEndpoint: process.env.WSS_RPC_URL, commitment: 'confirmed' });

const webhook_url = `http://${process.env.WEBHOOK_SERVER}:${process.env.PORT}${process.env.WEBHOOK_URI}`;

exports.addWebhook = async (wallet_addresses, transaction_types = ["SWAP", "TRANSFER"], webhook_id = '', previous_wallet_addresses = []) => {
    if(webhook_id.length > 0) {
        const new_wallet_addresses = [...previous_wallet_addresses, ...wallet_addresses]
        return await this.editWebhook(webhook_id, new_wallet_addresses, transaction_types);
    } else {
        return await this.createWebhook(wallet_addresses, transaction_types);
    }
}

exports.createWebhook = async (wallet_addresses, transaction_types = ["SWAP", "TRANSFER"]) => {
    try {
        const data = {};
        data.webhookURL = webhook_url;
        data.transactionTypes = transaction_types;
        data.accountAddresses = wallet_addresses;
        data.webhookType = 'enhanced';
        data.txnStatus = 'success';
        const create_url = `https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`;
        let result = await axios.post(create_url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return [true, result.data.webhookID];
    } catch (e) {
        console.log('error in webhook register.');
        console.log(e.response.data.error)
        return [false, ` ⚠️ ${e.response.data.error}\n Please try again later.`];
    }
}

exports.editWebhook = async (webhook_id, wallet_addresses, transaction_types = ["SWAP", "TRANSFER"]) => {
    try {
        const data = {};
        data.webhookURL = webhook_url;
        data.transactionTypes = transaction_types;
        data.accountAddresses = wallet_addresses;
        data.webhookType = 'enhanced';
        data.txnStatus = 'success';
        const edit_url = `https://api.helius.xyz/v0/webhooks/${webhook_id}?api-key=${process.env.HELIUS_API_KEY}`;
        let result = await axios.put(edit_url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return [true, result.data.webhookID];
    } catch (e) {
        console.log('error in webhook update.', webhook_id);
        console.log(e.response.data.error)
        return [false, ` ⚠️ ${e.response.data.error}`];
    }
}

exports.removeWebhook = async (wallet_address, webhook_id) => {
    let webhook_data = await this.getWebhook(webhook_id);
    if (webhook_data[0] == true) {
        let wallet_addresses = webhook_data[1].accountAddresses.filter(address => address != wallet_address);
        if (wallet_addresses.length > 0) return await this.editWebhook(webhook_id, wallet_addresses);
        else return await this.deleteWebhook(webhook_id);
    } else {
        return [false, webhook_data[1]];
    }
}

exports.deleteWebhook = async (webhook_id) => {
    try {
        const delete_url = `https://api.helius.xyz/v0/webhooks/${webhook_id}?api-key=${process.env.HELIUS_API_KEY}`;
        let result = await axios.delete(delete_url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return [true, 'Deleted webhook successfully.'];
    } catch (e) {
        console.log('error in webhook delete.', webhook_id);
        console.log(e.response.data.error)
        return [false, ` ⚠️ ${e.response.data.error}`];
    }
}

exports.getWebhook = async (webhook_id) => {
    try {
        const get_url = `https://api.helius.xyz/v0/webhooks/${webhook_id}?api-key=${process.env.HELIUS_API_KEY}`;
        let result = await axios.get(get_url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return [true, result.data];
    } catch (e) {
        console.log('error in webhook delete.', webhook_id);
        console.log(e.response.data.error)
        return [false, ` ⚠️ ${e.response.data.error}`];
    }
}

exports.getTopholders = async (token_mint_address, percent) => {
    try {
        const token_supply_data = await connection.getTokenSupply(new web3.PublicKey(token_mint_address));
        const token_decimal = token_supply_data.value.decimals;
        const token_supply = token_supply_data.value.amount;
        const minimum_amount = token_supply * percent / 100;

        let filtered_holder_list = [];

        const url = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
        let cursor;

        let data = {};
        data.jsonrpc = '2.0';
        data.id = "helius-test";
        data.method = "getTokenAccounts";
        while (true) {
            let params = {
                limit: 1000,
                mint: token_mint_address
            };

            if (cursor != undefined) {
                params.cursor = cursor;
            }

            data.params = params;

            const result = await axios.post(url, data, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!result.data.result || !result.data.result.token_accounts || result.data.result.token_accounts.length === 0) {
                console.log('No more results');
                break;
            }

            cursor = result.data.result.cursor;

            for (i in result.data.result.token_accounts) {
                let token_holder = (result.data.result.token_accounts)[i];
                if (token_holder.amount > minimum_amount) {
                    filtered_holder_list.push({
                        owner: token_holder.owner,
                        amount: token_holder.amount / Math.pow(10, token_decimal),
                        percent: token_holder.amount / token_supply * 100,
                        frozen: token_holder.frozen
                    });
                }
            }

        }

        return [true, { token_detail: token_supply_data.value, holder_list: filtered_holder_list }];
    } catch (e) {
        console.log('error in get top holders.');
        console.log(e)
        return [false, ` ⚠️ ${e}`];
    }
}