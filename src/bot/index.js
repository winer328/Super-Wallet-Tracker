const TelegramBot = require('node-telegram-bot-api')

const { customEditMessage, customSendMessage } = require("./customMessage")

const { BOT_STATE } = require('./constant')

const { scrapeWebsite } = require('../service/scrap_url')

const tokenListModel = require('../db/model/token_list')

const { getExistWebhookData, addToken } = require('../db/action/token_list_action')
const { addWebhook, removeWebhook, deleteWebhook } = require('../service/helius_service')
const { getTokenBalances, getTokenNativePrice } = require('../service/token_balance')

const bot = new TelegramBot(process.env.BOT_TOKEN)

var botSystem = {
    bot: bot,
    call_time: 1,
    bot_state: BOT_STATE.START,
    chat_id: '',

    start: () => {
        bot.startPolling()
        console.log(` 🔌 ${process.env.BOT_MASTER} BOT Connected Polling ...`)

        bot.on('polling_error', (error) => {
            console.log('polling error: ', error); // => 'EFATAL'
            return;
        })

        // Set custom commands 
        const commands = [
            { command: 'start', description: 'Start the bot' },
            { command: 'add_wallet_list', description: 'Add wallet list from url' },
            { command: 'add_seperate_wallet', description: 'Add seperate wallet address'},
            { command: 'delete_wallet_list', description: 'Delete wallet list from token symbol'},
            { command: 'delete_seperate_wallet', description: 'Delete seperate wallet address from token'}
        ]
      
        // Set custom commands when the bot starts up
        botSystem.bot.setMyCommands(commands).then(() => {
            console.log('Custom commands set successfully!');
        }).catch((error) => {
            console.error('Error setting custom commands:', error);
        })

        // when command is entered like /start
        bot.onText(/.*/, async (message) => {
            const text = message.text
            if (!text) return

            if (text === '/start' || text === `/start${process.env.BOT_MASTER}`) {
                console.log(new Date(message.date * 1000), message.from.username, "started bot.")
                await botSystem.goToFirstPage(message, true)
                return
            } 
            else if (text === '/add_wallet_list' || text === `/add_wallet_list${process.env.BOT_MASTER}`) {
                console.log(new Date(message.date * 1000), message.from.username, "started add_wallet_list bot.")
                await botSystem.goToAddWalletListPage(message, true)
                return
            }
            else if (text === '/add_seperate_wallet' || text === `/add_seperate_wallet${process.env.BOT_MASTER}`) {
                console.log(new Date(message.date * 1000), message.from.username, "started add_seperate_wallet bot.")
                await botSystem.goToAddSeperateWalletPage(message, true)
                return
            }
            else if (text === '/delete_wallet_list' || text === `/delete_wallet_list${process.env.BOT_MASTER}`) {
                console.log(new Date(message.date * 1000), message.from.username, "started delete_wallet_list bot.")
                await botSystem.goToDeleteWalletListPage(message, true)
                return
            }
            else if (text === '/delete_seperate_wallet' || text === `/delete_seperate_wallet${process.env.BOT_MASTER}`) {
                console.log(new Date(message.date * 1000), message.from.username, "started delete_seperate_wallet bot.")
                await botSystem.goToDeleteSeperateWalletPage(message, true)
                return
            }
            else if (text.lastIndexOf('/add') > -1) {
                await botSystem.addSeperateWallet(message)
                return
            }
            else if (text.lastIndexOf('/delete_wallet') > -1) {
                await botSystem.deleteSeperateWallet(message)
                return
            }
            else if (text.lastIndexOf('/delete') > -1) {
                await botSystem.deleteWalletList(message)
                return
            }
            else if (text.lastIndexOf('/enter') > -1) {
                await botSystem.addWalletList(message)
                return
            }

            // when user enter the general input
            // else {
            //     const current_bot_state = botSystem.bot_state
            //     switch (current_bot_state) {
            //         case BOT_STATE.ADD_WALLET_LIST:
            //             await botSystem.addWalletList(message);
            //             break;
            //     }
            //     return
            // }
        })

        // when command button clicked
        bot.on('callback_query', async (callback_data) => {
            if (!callback_data.data) return
            
            const command = callback_data.data

            switch (command) {
                case 'goto_firstpage':
                    await botSystem.goToFirstPage(callback_data.message, false)
                    break

                case 'add_wallet_list':
                    await botSystem.goToAddWalletListPage(callback_data.message, false)
                    break
                
                case 'add_seperate_wallet':
                    await botSystem.goToAddSeperateWalletPage(callback_data.message, false)
                    break
                
                case 'delete_wallet_list':
                    await botSystem.goToDeleteWalletListPage(callback_data.message, false)
                    break
            
                case 'delete_seperate_wallet':
                    await botSystem.goToDeleteSeperateWalletPage(callback_data.message, false)
                    break
                
                case 'manage_notification':
                    await botSystem.goToManageNotificationPage(callback_data.message, false)
                    break
                
                default:
                    break
                
            }

            if (command.startsWith('notification')) {
                await botSystem.setNotification(command, callback_data.message)
            }

            return
        })
    },

    goToFirstPage: async (message, from_start = true) => {

        // const exist_data = await getExistWebhookData()
        // let result_register
        // if (exist_data[0].length > 0) {
        //     result_register = await addWebhook(['EZNTdLmX4BmDVgaqnSxhFE48eNRsybrjMvyS9CQsQqeh'], ["SWAP", "TRANSFER"], exist_data[0], exist_data[1])
        // } else {
        //     result_register = await addWebhook(['EZNTdLmX4BmDVgaqnSxhFE48eNRsybrjMvyS9CQsQqeh'], ["SWAP", "TRANSFER"])
        // }

        // console.log(result_register)

        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.START
        let text = `welcome to the wallet tracking bot!\n 🟢 - You will get notification when transfer and swap transaction in registered wallet with that token\n 🟡 - You paused notification when transfer and swap transaction in registered wallet with that token\n\n`
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        text += `Registered tokens : ${registered_data.length}\n`
        for (row of registered_data) {
            const totalBalance = await getTokenBalances(row.wallet_list, row.mint_address)
            row.amount = totalBalance / 1000000
            await row.save()
            const active_symbol = row.is_active == true? '🟢': '🟡'
            text += ` ${active_symbol} <a class="text-entity-link" href="https://degen.fund/${row.mint_address}">${row.symbol_index}$${row.symbol}</a> ${row.wallet_number} wallets, ${(row.amount).toFixed(2)}M tokens, ${row.moved_sol_balance} SOL\n`
        }
        const inlineButtons = [
            [{ text: ' Add wallet list from url ', callback_data: 'add_wallet_list' }],
            [{ text: ' Add seperate wallet address ', callback_data: 'add_seperate_wallet' }],
            [{ text: ' Delete wallet list from token symbol ', callback_data: 'delete_wallet_list' }],
            [{ text: ' Delete seperate wallet address ', callback_data: 'delete_seperate_wallet' }],
            [{ text: ' Manage notification ', callback_data: 'manage_notification' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return;
    },

    goToAddWalletListPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.ADD_WALLET_LIST
        const text = `Enter url for fetch wallet list and token info.\n\nex: <code>/enter https://www.degen.fund/DxmmzbTX8vSRnPmKzJsDnkaRUTbuzxYiDh1ExFvwydoK</code>`
        const inlineButtons = [
            [{ text: ' Back to the First Page ', callback_data: 'goto_firstpage' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return
    },

    goToAddSeperateWalletPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.ADD_SEPERATE_WALLET
        let text = `You can add seperate wallet address to token holder list.\n Once you add wallet to token holder list, you can receive real time notification when that wallet swap/transfer that token.\n You should add token address like /add wallet_address token_symbol\n\nex. <code>/add EZNTdLmX4BmDVgaqnSxhFE48eNRsybrjMvyS9CQsQqeh 1$DARKBLUE</code>\n\nThere are registered token symbols that you can select.\n`
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        for (row of registered_data) {
            text += ` - <code>${row.symbol_index}$${row.symbol}</code> ${row.wallet_number} wallet ${(row.amount).toFixed(2)}M tokens holding\n`
        }
        const inlineButtons = [
            [{ text: ' Back to the First Page ', callback_data: 'goto_firstpage' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return
    },

    goToDeleteWalletListPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.DELETE_WALLET_LIST
        let text = `You can delete wallet address from token symbol.\n\nex. <code>/delete 1$DARKBLUE</code>\n\nThere are registered token symbols that you can select.\n`
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        for (row of registered_data) {
            text += ` - <code>${row.symbol_index}$${row.symbol}</code> ${row.wallet_number} wallet ${(row.amount).toFixed(2)}M tokens holding\n`
        }
        const inlineButtons = [
            [{ text: ' Back to the First Page ', callback_data: 'goto_firstpage' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return
    },

    goToDeleteSeperateWalletPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.DELETE_SEPERATE_WALLET
        let text = `You can delete seperate wallet address in token holder list.\nOnce you delete wallet to token holder list, you can't receive real time notification when that wallet swap/transfer that token.\n You should delete token address like /delete_wallet wallet_address token_symbol\n\nex. <code>/delete_wallet EZNTdLmX4BmDVgaqnSxhFE48eNRsybrjMvyS9CQsQqeh 1$DARKBLUE</code>\n\nThere are registered token symbols that you can select.\n`
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        for (row of registered_data) {
            text += ` - <code>${row.symbol_index}$${row.symbol}</code> ${row.wallet_number} wallet ${(row.amount).toFixed(2)}M tokens holding\n`
        }
        const inlineButtons = [
            [{ text: ' Back to the First Page ', callback_data: 'goto_firstpage' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return
    },

    goToManageNotificationPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.MANAGE_NOTIFICATION
        let text = `You can active or pause notification from the wallets in token by click the button.\n\n 🟢 - You will get notification when transfer and swap transaction in registered wallet with that token\n 🟡 - You paused notification when transfer and swap transaction in registered wallet with that token\n\n`
        let inlineButtons = []
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        for (row of registered_data) {
            const active_symbol = row.is_active == true? ' 🟢 ': ' 🟡 '
            const additional_action = row.is_active == true? 'off': 'on'
            inlineButtons.push([{ text: `${active_symbol}${row.symbol} ${row.wallet_number} wallets`, callback_data: `notification/${row.mint_address}/${additional_action}` }])
        }
        inlineButtons.push([{ text: ' Back to the First Page ', callback_data: 'goto_firstpage' }])
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return
    },

    addWalletList: async (message) => {
        let text = message.text
        const degen_url = text.replace('/enter', '').trim()
        let prev_message = await bot.sendMessage(message.chat.id, 'fetching url ...', {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify({
                force_reply: false
            })
        })
        const {success, msg, token_name, mint_address, wallet_list} = await scrapeWebsite(degen_url)
        console.log(success, msg)
        await bot.deleteMessage(message.chat.id, prev_message.message_id)

        if (success == false) {
            await bot.sendMessage(message.chat.id, msg, {
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
            return
        }

        prev_message = await bot.sendMessage(message.chat.id, 'registering in Helius webhook ...', {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify({
                force_reply: false
            })
        })

        const exist_data = await getExistWebhookData()
        let result_register
        if (exist_data[0].length > 0) {
            result_register = await addWebhook(wallet_list, ["SWAP", "TRANSFER"], exist_data[0], exist_data[1])
        } else {
            result_register = await addWebhook(wallet_list, ["SWAP", "TRANSFER"])
        }

        let existSameTokenList = await tokenListModel.find({ symbol: token_name });

        if (result_register[0] == true) {
            const totalBalance = await getTokenBalances(wallet_list, mint_address)
            const webhook_id = result_register[1]
            let newOne = {}
            newOne.chat_id = message.chat.id
            newOne.mint_address = mint_address
            newOne.symbol = token_name
            newOne.symbol_index = existSameTokenList.length + 1;
            newOne.amount = totalBalance / 1000000;
            newOne.wallet_list = wallet_list
            newOne.wallet_number = wallet_list.length
            newOne.is_active = true
            newOne.webhook_id = webhook_id
            const result = await addToken(newOne)
            console.log(result)
            await bot.deleteMessage(message.chat.id, prev_message.message_id)
            await bot.sendMessage(message.chat.id, result, {
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
        } else {
            await bot.deleteMessage(message.chat.id, prev_message.message_id)
            console.log(result_register[1])
            await bot.sendMessage(message.chat.id, result_register[1], {
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
        }
        
        return;
    },

    addSeperateWallet: async (message) => {
        text = message.text
        text = text.replace('/add', '').trim()
        const wallet_address = (text.split(' '))[0]
        const token_symbol_str = text.replace(wallet_address, '').trim()
        const token_symbol_index = (token_symbol_str.split('$'))[0]
        const token_symbol = (token_symbol_str.split('$'))[1]

        const exist_token_row = await tokenListModel.find({ chat_id: message.chat.id, symbol: token_symbol, symbol_index: token_symbol_index })

        if (exist_token_row.length > 0) {

            let update_one = exist_token_row[0]
            if (update_one.wallet_list.lastIndexOf(wallet_address) > -1) {
                await bot.sendMessage(message.chat.id, ` ⚠️ <code>${wallet_address}</code> is already registered`, {
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
                return
            }
            result_register = await addWebhook([wallet_address], ["SWAP", "TRANSFER"], update_one.webhook_id, update_one.wallet_list)

            if (result_register[0] === true) {
                // const balance = await getTokenBalances([wallet_address], update_one.mint_address)
                update_one.wallet_list = [...update_one.wallet_list, wallet_address]
                update_one.wallet_number++
                // update_one.amount += balance/1000000
                await update_one.save()
                await bot.sendMessage(message.chat.id, ` 🎉 <code>${wallet_address}</code> is registered in ${update_one.symbol_index}$${update_one.symbol} token holder list\nYou will get real time notification after 3mins from now.`, {
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            } else {
                console.log(result_register[1])
                await bot.sendMessage(message.chat.id, result_register[1], {
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            }

        } else {
            await bot.sendMessage(message.chat.id, ' ⚠️ The token symbol that you provide does not registered yet.\n Please register the token from url first.', {
                reply_markup: 'HTML',
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
        }
        return
    },

    deleteWalletList: async (message) => {
        text = message.text
        text = text.replace('/delete', '').trim()
        const token_symbol_index = (text.split('$'))[0]
        const token_symbol = (text.split('$'))[1]

        const exist_token_row = await tokenListModel.find({ chat_id: message.chat.id, symbol: token_symbol, symbol_index: token_symbol_index })

        if (exist_token_row.length > 0) {
            const exist_token_list = await tokenListModel.find()
            try {
                if (exist_token_list.length  == 1) {
                    const exist_webhook_id = exist_token_list[0].webhook_id
                    await deleteWebhook(exist_webhook_id)
                }
                await tokenListModel.deleteOne({ chat_id: message.chat.id, symbol: token_symbol, symbol_index: token_symbol_index })
                await bot.sendMessage(message.chat.id, ` The wallet list in 🎉 <code>${text}</code> is deleted\nYou will not get real time notification after 3mins from now.`, {
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            } catch (e) {
                await bot.sendMessage(message.chat.id, ` ⚠️ During delete token list the error occured. ${e}`, {
                    reply_markup: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            }
        } else {
            await bot.sendMessage(message.chat.id, ` ⚠️ The token symbol that you provide does not registered. <code>${text}</code>`, {
                reply_markup: 'HTML',
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
        }
        return
    },

    deleteSeperateWallet: async (message) => {
        text = message.text
        text = text.replace('/delete_wallet', '').trim()
        wallet_address = (text.split(' '))[0]
        token_arr = (text.split(' '))[1]
        const token_symbol_index = (token_arr.split('$'))[0]
        const token_symbol = (token_arr.split('$'))[1]

        const exist_token_row = await tokenListModel.find({ chat_id: message.chat.id, symbol: token_symbol, symbol_index: token_symbol_index })

        if (exist_token_row.length > 0) {
            try {

                let update_one = exist_token_row[0]
                if (update_one.wallet_list.lastIndexOf(wallet_address) < 0) {
                    await bot.sendMessage(message.chat.id, ` ⚠️ <code>${wallet_address}</code> isn't registered in <code>${token_symbol_index}$${token_symbol}</code>`, {
                        parse_mode: 'HTML',
                        reply_markup: JSON.stringify({
                            force_reply: false
                        })
                    })
                    return
                }

                update_one.wallet_list = update_one.wallet_list.filter(address => address != wallet_address);
                update_one.wallet_number--
                await update_one.save()
                await bot.sendMessage(message.chat.id, ` 🎉 <code>${wallet_address}</code> is deleted in ${update_one.symbol_index}$${update_one.symbol} token holder list\nYou will get real time notification after 3mins from now.`, {
                    parse_mode: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            } catch (e) {
                await bot.sendMessage(message.chat.id, ` ⚠️ During delete seperate wallet the error occured. ${e}`, {
                    reply_markup: 'HTML',
                    reply_markup: JSON.stringify({
                        force_reply: false
                    })
                })
            }
        } else {
            await bot.sendMessage(message.chat.id, ` ⚠️ The token symbol that you provide does not registered. <code>${text}</code>`, {
                reply_markup: 'HTML',
                reply_markup: JSON.stringify({
                    force_reply: false
                })
            })
        }
        return
    },

    setNotification: async (command, message) => {
        const splited_command = command.split('/')
        const mint_address = splited_command[1]
        const flag = splited_command[2] == 'on'? true: false
        let row = await tokenListModel.findOne({ chat_id: message.chat.id, mint_address: mint_address })
        row.is_active = flag
        row.save()
        await botSystem.goToManageNotificationPage(message, false)
        return
    }
}

module.exports = botSystem