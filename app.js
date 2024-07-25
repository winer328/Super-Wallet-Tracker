// Load env variables
require('dotenv').config()

const mongoConnect = require('./src/db')

mongoConnect(() => {
});