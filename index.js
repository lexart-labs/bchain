require('dotenv').config()
const Blockchain = require('./services/blockchain.service')
const Chain      = require('./routers/chain.router')
const app        = require('express')()
const bodyParser = require('body-parser')
const port       = process.env.PORT

global.chain    = []

app.use(bodyParser.json())
app.use('/chain', Chain)

app.listen(port, async () => {
    // Autorun chain
    // Run genesis block
    const gBlock = Blockchain.addGenesisBlock()
    chain = await Blockchain.storedChain(chain)

    console.log(`Run blockchain - LXDOC ::`, chain)
})