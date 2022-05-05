const SHA256 = require("crypto-js/sha256")
const crypto = require("crypto")
const Sqlite = require('./sqlite.service')
const fs     = require('fs').promises
const { default: axios } = require("axios")
const PATH_DIFFICULT = process.env.PATH_DIFFICULT
const HARD_DIFFICULT = parseInt(process.env.HARD_DIFFICULT)
const WALLET_PATH    = "lxdoc"
const WALLET_SIZE    = 15
const RAND_PATH      = "abcdefghijkmnlopqrstuvyz0123456789"
const OAEP_PADDING   = "RSA_PKCS1_PADDING"
const ENCRYPT_ALGO   = "rsa"
const MOD_LENGTH     = 4096
const CIPHER         = 'aes-256-cbc'
const FILE_TYPE      = 'pem'
const RETRY_TIMES    = 5
const OEAP_HASH      = "sha256"
const CHAIN_OUTPUT   = 1000
/* 
    Vamos a definir data como el siguiente objeto:

    data: {
        title: "",
        creator: "",
        documentCreator: "",
        body: {...} ~> Sería un JSON libre con el contenido del documento
        signs: [
            {
                name: "",
                verify: "", ~> Sería un base64 de validación (foto, captura de pantalla, firma digital)
                date: ""
            },
            ...
        ]
    }

    Ejemplo de bloque:

    {
        data: {
            title: "Contrato simple!",
            creator: "Alex Casadevall",
            documentCreator: "51008360",
            body: {
                html: "Hola !!"
            },
            signs: [
                {
                    name: "Alex Casadevall",
                    verify: "aG9sYQ==",
                    date: 1568481293771
                }
            ]
        },
        timestamp: 1568481293771,
        previousHash: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    }

*/

const Blockchain = {
    calcHash: function ({prevHash, timestamp, data, nonce = 1}) {
        // Obs: nonce es un número arbitrario que se puede usar una única vez en una comunicación criptográfica 
        return SHA256(prevHash + timestamp + JSON.stringify(data) +  nonce).toString();
    },
    addGenesisBlock: async function () {
        const block = {
            data: {
                title: "hello world",
                creator: "god",
                documentCreator: "0",
                wallet: "lxdoc00000000",
                body: {
                    html: "hello world"
                },
                signs: [
                    {
                        name: "god",
                        verify: "aG9sYQ==",
                        date: 0
                    }
                ]
            },
            timestamp: 0,
            previousHash: "0",
            signBlock: "0"
        }

        const newBlock = {
            ...block,
            hash: this.calcHash(block)
        }

        await Sqlite.insertBlock(newBlock)
        return newBlock
    },
    checkDifficulty: function (difficulty, hash) {
        return hash.substr(0, difficulty) === PATH_DIFFICULT
    },
    nextNonce: function (block) {
        return this.updateHash({ ...block, nonce: block.nonce + 1 })
    },
    updateHash: function (block) {
        return { ...block, hash: this.calcHash(block) }
    },
    trampoline: function (func) {
        let result = func.apply(func, ...arguments);
        while(result && typeof(result) === "function") {
            result = result();
        }
        return result;
    },
    mine: function (difficulty, block) {
        const newBlock = this.nextNonce(block);
        return this.checkDifficulty(difficulty, newBlock.hash)
                ? newBlock
                : () => this.mine(difficulty, this.nextNonce(block));
    },
    mineBlock: function (difficulty, block) {
        return this.trampoline(
                    this.mine(
                        difficulty,
                        this.nextNonce(block)
                    )
                );
    },
    addBlock: async function (chain, data, publickey) {
        const { hash: previousHash } = chain[chain.length - 1];
        const block                  = { timestamp: + new Date(), data, previousHash, nonce: 0, signBlock: ""}
        const newBlock               = this.mineBlock(HARD_DIFFICULT, block);
        let newChain                 = chain

        // sign the block
        newBlock.signBlock = await this.signBlock(newBlock, publickey)
        // dpkg sign
        newBlock.signBlock = newBlock.signBlock.sign

        // Insert block inside database
        const inserted = await Sqlite.insertBlock(newBlock)

        if(!inserted.error){
            newChain = chain.concat(newBlock)
        }

        console.log("newBlock sign :: ", newBlock.signBlock)
        return {
            newBlock: newBlock, 
            newChain: newChain,
            inserted: inserted
        }
    },
    validateChain: function (chain) {
        const tce = (chain, index) => {
            if (index === 0) return true;
            const { hash, ...currentBlockWithoutHash } = chain[index];
            const currentBlock                         = chain[index];
            const previousBlock                        = chain[index - 1];
            const isValidHash         = (hash === this.calcHash(currentBlockWithoutHash));
            const isPreviousHashValid = (currentBlock.previousHash === previousBlock.hash);
            const isValidChain        = (isValidHash && isPreviousHashValid);
        
            if (!isValidChain) return false;
            else return tce(chain, index -1);
        }
        return tce(chain, chain.length - 1)
    },
    storedChain: async function (offset, limit){
        
        if(offset == undefined || limit == undefined){
            offset = 0
            limit  = 5
        }
        
        if(limit > CHAIN_OUTPUT){
            return {
                error: "Chain output to big"
            }
        }

        const dbChain  = await Sqlite.query(`SELECT * FROM chain LIMIT ${offset},${limit}`)
        let chain      = []

        if(dbChain.length > 0){
            dbChain.map( item => {
                const block = JSON.parse(item.chain_storage)
                chain.push(block)
            })
        }
        return chain
    },
    // Get blocks by wallet
    // Sintax behind wallet: lxdocXXXXXXXX
    // Where XXXXXXXX can be [0-9] + [a-z] combination
    // First wallet is: lxdoc00000001
    // To-Do add an algoritm to make this pattern
    // And verify if the wallet not stored in the chain to know that its unique
    generateWallet: async function (password){
        let newWallet = WALLET_PATH

        const generateWalletHash = () => {
            // Generate hash wallet
            for (let i = 0; i <= WALLET_SIZE; i++){
                newWallet += RAND_PATH[ Math.floor( Math.random() * RAND_PATH.length )]
            }
            return newWallet
        }
        generateWalletHash()
        
        // Verify if not exist in chain
        let walletExist = await Sqlite.verifyWalletExist(newWallet)
        let retry       = 0

        // Use RETRY_TIMES to not break 
        // while loop if something wrong in database
        while (walletExist.exist && retry < RETRY_TIMES){
            console.log("while loop - retry ::", retry)
            generateWalletHash()
            walletExist = await Sqlite.verifyWalletExist(newWallet)
            retry++
        }

        // generate passphrase
        const passphrase = newWallet + ':' + password

        // Generate public key, private key
        const { publicKey, privateKey } = crypto.generateKeyPairSync(ENCRYPT_ALGO, {
            // The standard secure default length for RSA keys is 2048 bits
            modulusLength: MOD_LENGTH,
            publicKeyEncoding: {
                type: 'pkcs1',
                format: FILE_TYPE
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: FILE_TYPE,
                cipher: CIPHER,
                passphrase: passphrase
            }
        })

        return {
            walletAdress: newWallet,
            publicKey: publicKey.toString('base64'),
            privateKey: privateKey.toString('base64')
        }
    },
    signBlock: async function (block, publicKey){
        const jsonBlock = JSON.stringify(block)
        console.log("publicKey :: ", block)
        // create file in chain storage
        // with wallet name
        const fileKeyName   = block.data.wallet + '.' + FILE_TYPE
        const publicDirKey  = __dirname + '/../chain_storage/_pub_' + fileKeyName
        await fs.writeFile(publicDirKey, publicKey.trim());

        // read file from chain storage
        const fileKeyPem    = await fs.readFile(publicDirKey, "utf8");
        let encryptedData   = {}
        
        try {
            encryptedData = crypto.publicEncrypt(
                {
                    key: fileKeyPem
                },
                // We convert the data string to a buffer using `Buffer.from`
                Buffer.from(jsonBlock)
            );
        } catch (e){
            console.log("error: ", e)
        }

        // Remove .pem from chain storage
        await fs.unlink(publicDirKey)
        
        // return the sign
        return {
            sign: encryptedData.toString("base64")
        }
    },
    blocksOwner: async function (wallet, password, privateKey){
        // Algorithm desc
        // 1. pickup the wallet blocks
        // 2. Verify if signBlock decrypt with privateKey
        //  2.1 If one block fail return error
        //  2.2 Otherwise verify all blockchain decrypt trace
        // 3. Return only the blocks from the wallet
        const response = await Sqlite.getBlocksFromWallet(wallet)
        let chain      = []

        if(response.length > 0){
            response.map( item => {
                const block = JSON.parse(item.chain_storage)
                chain.push(block)
            })
        }

        let decryptedCount = 0
        // verify one by one
        for (let i = 0; i < chain.length; i++){
            const block = chain[i]

            console.log("privateKey :: ", block.signBlock)

            try {
                const fileKeyName   = block.data.wallet + '.' + FILE_TYPE
                const privateDirKey  = __dirname + '/../chain_storage/_private_' + fileKeyName
                await fs.writeFile(privateDirKey, privateKey.trim());

                // read file from chain storage
                const fileKeyPem    = await fs.readFile(privateDirKey, "utf8");

                // verify decrypt by signBlock
                const decryptedData = crypto.privateDecrypt(
                    {
                    key: fileKeyPem,
                    passphrase: wallet + ':' + password
                    },
                    Buffer.from(block.signBlock, "base64")
                );

                const secretBlock = JSON.parse(decryptedData.toString("utf8"))

                if(secretBlock.hash === block.hash){
                    console.log("decrypted correctly :: ")
                    decryptedCount++
                } else {
                    break;
                }

                // Remove .pem from chain storage
                await fs.unlink(privateDirKey)
                
            } catch (e){
                console.log("err decrypt :: ", e)
                break;
            }
        }

        let res = {
            error: `Corrupted blocks for wallet ${wallet}`
        }

        if(decryptedCount === chain.length){
            res = {
                chain: chain
            }
        }

        return res
    },
    storedChainSize: async function (){
        const dbChain  = await Sqlite.query('SELECT COUNT(*) AS chainSize FROM chain')
        return {
            chainSize: dbChain[0].chainSize
        }
    },
    // Verify and add full node
    // Fetch full node chain and verify if its all correct to blockchain
    fetchFullNodeAndLoad: async function (){
        // Connect with full node and validate chain
        // If chain is to big 
        // need to make by parts
        // to-do implement pager or background load
        const urlNode   = process.env.FULL_NODE + '/chain/full'
        
        const { chainSize } = await this.storedChainSize()

        // Add bulk chain
        let chainFull   = []
        const bulkSize  = 1

        for (let offset = 0; offset < chainSize; offset++){
            const url       = urlNode + '/' + offset + '/' + bulkSize
            const { data }  = await axios.get(url)

            chainFull.push( data.chain[0] )
            console.log("Complete - Bulk loop :: ", offset)
        }

        // Validate chain
        const validChain = await this.validateChain(chainFull)

        // Load to database 
        if(validChain){
            // Insert block inside database
            chainFull.map( async (block, i) => {
                const inserted = await Sqlite.insertBlock(block)

                if(!inserted.error){
                    console.log("Inserted block :: ", i+1)
                } else {
                    console.log("Block is already in database :: ", i+1)
                }
            })
        }

        console.log("validChain ::", validChain)

        return {
            fullNode: chainFull,
            chainSize,
            validChain
        }
    }
}
module.exports = Blockchain