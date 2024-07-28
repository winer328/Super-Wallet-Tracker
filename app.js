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
        if (response_data[0].type == 'SWAP') {
            const fee_payer = response_data[0].feePayer
            const swap_event = response_data[0].events.swap
            const registered_data = await tokenListModel.find({ wallet_list: { $in: [fee_payer] }, is_active: true })
            console.log(swap_event)
            
        } else if (response_data[0].type == 'TRANSFER') {
        }
        return res.json({})
    } catch (e) {
        console.log('error in webhook response')
        console.log(e)
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