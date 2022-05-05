const sqlite3 = require('sqlite3').verbose();
const SQL_URI = process.env.SQL_URI
global.db = new sqlite3.Database(SQL_URI);

const Sqlite = {
    init: function (){
        global.db = new sqlite3.Database(SQL_URI);
    },
    query: function (sql){
        return new Promise( resolve => {
            db.serialize(function() {
                let rows = []
                db.each(`${sql}`, function(err, row) {
                    rows.push(row)
                }, function (){
                    resolve(rows)
                });
            })
            // db.close();
        })
    },
    insertBlock: async function (block){
        return new Promise( async resolve => {
            // Store if not exist hash
            try {
                
                const existBlock = await this.query(`SELECT * FROM chain WHERE chain_storage LIKE '%${block.hash}%'`)
                
                // Store block only if not exist hash
                if(existBlock.length === 0){
                    db.serialize(function() {
                        db.run("INSERT INTO chain (chain_storage, date) VALUES (?,?)", [ JSON.stringify(block), + new Date() ], function (err, success){
                            resolve({
                                error: err === null ? false : true
                            })
                        });
                    })
                    // To-do: close connection without error
                    // db.close();
                } else {
                    resolve({
                        error: true
                    })
                }
            } catch (e){
                console.log("error: ", e)
            }
        })
    },
    getBlocksFromWallet: async function (wallet){
        return new Promise( async resolve => {
            // Store if not exist hash
            try {
                
                const existBlock = await this.query(`SELECT * FROM chain WHERE chain_storage LIKE '%${wallet}%'`)
                
                // Store block only if not exist hash
                if(existBlock.length === 0){
                    resolve({
                        error: true
                    })
                } else {
                    resolve(existBlock)
                }
            } catch (e){
                console.log("error: ", e)
            }
        })
    },
    verifyWalletExist: async function (wallet){
        return new Promise( async resolve => {
            // Store if not exist hash
            try {
                
                const existBlock = await this.query(`SELECT * FROM chain WHERE chain_storage LIKE '%${wallet}%'`)
                
                // Store block only if not exist hash
                if(existBlock.length === 0){
                    resolve({
                        exist: false
                    })
                } else {
                    resolve({
                        exist: true
                    })
                }
            } catch (e){
                console.log("error: ", e)
            }
        })
    }
}
module.exports = Sqlite