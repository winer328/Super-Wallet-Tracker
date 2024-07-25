const TelegramBot = require('node-telegram-bot-api')

const { customEditMessage, customSendMessage } = require("./customMessage")

const { BOT_STATE } = require('./constant')

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
                console.log(new Date(message.date * 1000), message.from.username, "started bot.");
                await botSystem.goToFirstPage(message, true);
                return;
            }

            // when user enter the general input
            else {
                const current_bot_state = botSystem.bot_state
                return
            }
        })

        // when command button clicked
        bot.on('callback_query', async (callback_data) => {
            if (!callback_data.data) return
            
            const command = callback_data.data

            switch (command) {
                case 'goto_firstpage':
                    await botSystem.goToFirstPage(callback_data.message, false);
                    break;
                
                default:
                    break;
                
            }

            return
        })
    },

    goToFirstPage: async (message, from_start = true) => {
        botSystem.chat_id = message.chat.id
        botSystem.bot_state = BOT_STATE.START
        const text = `welcome to this bot!`
        const inlineButtons = [
            [{ text: ' button1 ', callback_data: '123' }],
            [{ text: ' button2 ', callback_data: '234' }],
        ]
        botSystem.call_time++
        if (from_start) await customSendMessage(bot, message, text, inlineButtons)
        else await customEditMessage(bot, message, text, inlineButtons)
        return;
    }
}

module.exports = botSystem