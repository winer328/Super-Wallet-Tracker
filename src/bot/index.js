const TelegramBot = require('node-telegram-bot-api')

const { customEditMessage, customSendMessage } = require("./customMessage")

const { BOT_STATE } = require('./constant')

const { scrapeWebsite } = require('../service/scrap_url')

const tokenListModel = require('../db/model/token_list')

const { getExistWebhookData, addToken } = require('../db/action/token_list_action')
const { addWebhook } = require('../service/helius_service')
const { getTokenBalances } = require('../service/token_balance')

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
            { command: 'start', description: 'Start the bot' }
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

            if (text === '/start') {
                console.log(new Date(message.date * 1000), message.from.username, "started bot.")
                await botSystem.goToFirstPage(message, true)
                return
            } 
            else if (text.lastIndexOf('/add') > -1) {
                await botSystem.addSeperateWallet(message)
                return
            }

            // when user enter the general input
            else {
                const current_bot_state = botSystem.bot_state
                switch (current_bot_state) {
                    case BOT_STATE.ADD_WALLET_LIST:
                        await botSystem.addWalletList(message);
                        break;
                }
                return
            }
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
            text += ` ${active_symbol} <a class="text-entity-link" href="https://degen.fund/${row.mint_address}">${row.symbol}</a> ${row.wallet_number} wallets ${(row.amount).toFixed(2)}M tokens holding\n`
        }
        const inlineButtons = [
            [{ text: ' Add wallet list from url ', callback_data: 'add_wallet_list' }],
            [{ text: ' Add seperate wallet address ', callback_data: 'add_seperate_wallet' }],
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
        const text = `Enter url for fetch wallet list and token info.\n\nex: <code>https://www.degen.fund/DxmmzbTX8vSRnPmKzJsDnkaRUTbuzxYiDh1ExFvwydoK</code>`
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
        let text = `You can add seperate wallet address to token holder list.\n Once you add wallet to token holder list, you can receive real time notification when that wallet swap/transfer that token.\n You should add token address like /add wallet_address token_symbol\n\nex. <code>/add EZNTdLmX4BmDVgaqnSxhFE48eNRsybrjMvyS9CQsQqeh DARKBLUE</code>\n\nThere are registered token symbols that you can select.\n`
        const registered_data = await tokenListModel.find({ chat_id: message.chat.id })
        for (row of registered_data) {
            text += ` - <code>${row.symbol}</code> ${row.wallet_number} wallet ${(row.amount).toFixed(2)}M tokens holding\n`
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
        const degen_url = message.text
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

        if (result_register[0] == true) {
            const totalBalance = await getTokenBalances(wallet_list, mint_address)
            const webhook_id = result_register[1]
            let newOne = {}
            newOne.chat_id = message.chat.id
            newOne.mint_address = mint_address
            newOne.symbol = token_name
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
        const token_symbol = text.replace(wallet_address, '').trim()

        const exist_token_row = await tokenListModel.find({ chat_id: message.chat.id, symbol: token_symbol })

        if (exist_token_row.length > 0) {

            const update_one = exist_token_row[0]
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
                const balance = await getTokenBalances([wallet_address], update_one.mint_address)
                update_one.wallet_list = [...update_one.wallet_list, wallet_address]
                update_one.wallet_number++
                update_one.amount += balance/1000000
                await update_one.save()
                await bot.sendMessage(message.chat.id, ` 🎉 <code>${wallet_address}</code> is registered in ${update_one.symbol} token holder list\nYou will get real time notification after 3mins from now.`, {
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