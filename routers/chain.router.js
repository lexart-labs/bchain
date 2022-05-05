const router     = require('express').Router()
const Blockchain = require('../services/blockchain.service')

router.post('/block/add', async (req, res) => {
    const newBlockData  = req.body.doc
    const publicKey     = req.body.publicKey
    chain = await Blockchain.storedChain(chain)
    const { newBlock } = await Blockchain.addBlock(chain, newBlockData, publicKey); 

    // Output blockchain
    res.send({block: newBlock}).json()
})

router.get('/full/:offset?/:limit?', async (req, res) => {
    chain               = await Blockchain.storedChain(req.params.offset, req.params.limit)
    const { chainSize } = await Blockchain.storedChainSize()
    
    // Output blockchain
    res.send({chain: chain, chainSize}).json()
})

router.get('/sync', async (req, res) => {
    const chain = await Blockchain.fetchFullNodeAndLoad()
    
    // Output sync chain
    res.send(chain).json()
})

router.post('/wallet/address', async (req, res) => {
    const reqWallet = req.body
    const response = await Blockchain.generateWallet(reqWallet.password)
    
    // Output blockchain
    res.send(response).json()
})

router.post('/wallet/me', async (req, res) => {
    const reqWallet = req.body
    const response = await Blockchain.blocksOwner(reqWallet.wallet, reqWallet.password, reqWallet.privateKey)
    
    // Output blockchain
    res.send(response).json()
})

module.exports = router