// Load env variables
require('dotenv').config()

const mongoConnect = require('./src/db')

const botSystem = require('./src/bot')

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = process.env.PORT

const tokenListModel = require('./src/db/model/token_list')

const fs = require('fs')

// Middleware to parse JSON bodies
app.use(bodyParser.json())

app.post(process.env.WEBHOOK_URI, async (req, res) => {
    try {
        console.log('Recieved POST request with body', new Date())
        if(Object.keys(req.body).length == 0) return res.json({});
        const response_data = req.body
        // console.log(response_data[0])
        if (response_data[0].type == 'SWAP') {
            const fee_payer = response_data[0].feePayer
            const registered_data = await tokenListModel.find({ wallet_list: { $in: [fee_payer] } })
            
            const swap_event = response_data[0].events.swap
            
            const input_token_address = swap_event.tokenInputs.length > 0 ?(swap_event.tokenInputs)[0].mint: ''
            const input_token_amount = swap_event.tokenInputs.length > 0 ? (Number((swap_event.tokenInputs)[0].rawTokenAmount.tokenAmount) / Math.pow(10, (swap_event.tokenInputs)[0].rawTokenAmount.decimals) / 1000000).toFixed(2): 0
            
            const output_token_address = swap_event.tokenOutputs.length > 0 ?(swap_event.tokenOutputs)[0].mint: ''
            const output_token_amount = swap_event.tokenOutputs.length > 0 ? (Number((swap_event.tokenOutputs)[0].rawTokenAmount.tokenAmount) / Math.pow(10, (swap_event.tokenOutputs)[0].rawTokenAmount.decimals) / 1000000).toFixed(2): 0

            for (row of registered_data) {
                if (row.mint_address == input_token_address) {
                    // SOLD
                    if (row.is_active == true) {
                        let index = row.wallet_list.lastIndexOf((swap_event.tokenInputs)[0].userAccount)
                        await botSystem.bot.sendMessage(row.chat_id, `<a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index])}">${row.symbol}${index}</a> <a class="text-entity-link" href="https://solscan.io/tx/${response_data[0].signature}">SOLD</a> ${input_token_amount}M tokens`, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                            reply_markup: JSON.stringify({
                                force_reply: false
                            })
                        })
                    }
                    row.amount = (row.amount - Number(input_token_amount)).toFixed(2)
                    await row.save()
                } else if (row.mint_address == output_token_address) {
                    // BOUGHT
                    if (row.is_active == true) {
                        let index = row.wallet_list.lastIndexOf((swap_event.tokenOutputs)[0].userAccount)
                        await botSystem.bot.sendMessage(row.chat_id, `<a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index])}">${row.symbol}${index}</a> <a class="text-entity-link" href="https://solscan.io/tx/${response_data[0].signature}">BOUGHT</a> ${output_token_amount}M tokens`, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                            reply_markup: JSON.stringify({
                                force_reply: false
                            })
                        })
                    }
                    row.amount = (row.amount + Number(output_token_amount)).toFixed(2)
                    await row.save()
                }
            }
            
        } else if (response_data[0].type == 'TRANSFER') {
            let tokenTransfers = response_data[0].tokenTransfers
            if (tokenTransfers.length == 0) return res.json({})

            for (tokenTransfer of tokenTransfers) {
                const fromUserAccount = tokenTransfer.fromUserAccount
                const toUserAccount = tokenTransfer.toUserAccount
                const mint_address = tokenTransfer.mint
                const tokenAmount = (tokenTransfer.tokenAmount / 1000000).toFixed(2)
                const registered_data = await tokenListModel.find({ mint_address: mint_address })

                if (registered_data.length > 0) {
                    for (row of registered_data) {
                        const index1 = row.wallet_list.lastIndexOf(fromUserAccount)
                        const index2 = row.wallet_list.lastIndexOf(toUserAccount)
                        if (index1 > -1) {
                            if (index2 > -1 && row.is_active == true) {
                                await botSystem.bot.sendMessage(row.chat_id, `<a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index1])}">${row.symbol}${index1}</a> <a class="text-entity-link" href="https://solscan.io/tx/${response_data[0].signature}">SENT</a> ${tokenAmount}M tokens to <a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index2])}">${row.symbol}${index2}</a>`, {
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                    reply_markup: JSON.stringify({
                                        force_reply: false
                                    })
                                })
                            } else {
                                if (row.is_active == true) {
                                    await botSystem.bot.sendMessage(row.chat_id, `<a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index1])}">${row.symbol}${index1}</a> <a class="text-entity-link" href="https://solscan.io/tx/${response_data[0].signature}">SENT</a> ${tokenAmount}M tokens to <code>${toUserAccount}</code>`, {
                                        parse_mode: 'HTML',
                                        disable_web_page_preview: true,
                                        reply_markup: JSON.stringify({
                                            force_reply: false
                                        })
                                    })
                                }
                                row.amount = (row.amount - Number(tokenAmount)).toFixed(2)
                                await row.save()
                            }
                        } else if (index2 > -1) {
                            if (row.is_active == true) {
                                await botSystem.bot.sendMessage(row.chat_id, `<a class="text-entity-link" href="https://solscan.io/account/${(row.wallet_list[index2])}">${row.symbol}${index1}</a> <a class="text-entity-link" href="https://solscan.io/tx/${response_data[0].signature}">RECEIVED</a> ${tokenAmount}M tokens from <code>${fromUserAccount}</code>`, {
                                    parse_mode: 'HTML',
                                    disable_web_page_preview: true,
                                    reply_markup: JSON.stringify({
                                        force_reply: false
                                    })
                                })
                            }
                            row.amount = (row.amount + Number(tokenAmount)).toFixed(2)
                            await row.save()
                        }
                    }
                }

            }

        }
        return res.json({})
    } catch (e) {
        console.log('error in webhook response')
        console.log(e)
        return res.json({})
    }
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);

    mongoConnect(async () => {
        await botSystem.start()
    })
})