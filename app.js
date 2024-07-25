// Load env variables
require('dotenv').config()

const mongoConnect = require('./src/db')

const botSystem = require('./src/bot')

mongoConnect(() => {
    botSystem.start()
})