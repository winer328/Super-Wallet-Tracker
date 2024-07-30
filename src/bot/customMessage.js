let customSendMessage = async (bot, msg, text, inlineButtons = [], parse_mode = "HTML") => {
    try {
        let sentMessage = await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', 
        disable_web_page_preview: true, reply_markup: JSON.stringify({ inline_keyboard: inlineButtons, parse_mode: parse_mode })})
        return sentMessage
    } catch(e) {
        console.log(e)
        return
    }
    
}

let customEditMessage = async (bot, msg, text, inlineButtons = [], parse_mode = "HTML") => {
    let sentMessage = await bot.editMessageText(text, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: parse_mode,
        disable_web_page_preview: true,
        reply_markup: JSON.stringify({
            inline_keyboard: inlineButtons            
        })
    })
    return sentMessage
}

module.exports = { customSendMessage, customEditMessage }