const TestSuite = {
    getExampleBlock: () => {
        return {
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
    }
}
module.exports = TestSuite