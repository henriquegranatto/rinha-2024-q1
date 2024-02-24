const http = require('http');
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);

server.listen(3000);

app.set('port', 3000);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let database;
const initialClients = [
    {id: 1, limite: 100000, saldo: 0, transacoes: []},
    {id: 2, limite: 80000, saldo: 0, transacoes: []},
    {id: 3, limite: 1000000, saldo: 0, transacoes: []},
    {id: 4, limite: 10000000, saldo: 0, transacoes: []},
    {id: 5, limite: 500000, saldo: 0, transacoes: []}
];

(async function() {
    const mongo = new MongoClient("mongodb://root:root@mongo:27017/app?authSource=admin");
    await mongo.connect();
    database = mongo.db("app")
    await database.collection("clientes").insertMany(initialClients);
})();

app.post('/clientes/:id/transacoes', async (request, response) => {
    const { id } = request.params;
    const cliente = await database.collection('clientes').findOne({ id: parseInt(id) });

    if (!cliente) 
        return response.status(404).send();

    const { valor, tipo, descricao } = request.body;

    if (tipo === 'd' && cliente.saldo - valor < -cliente.limite) 
        return response.status(422).send();

    if (typeof valor !== 'number' || valor <= 0 || !['c', 'd'].includes(tipo) || typeof descricao !== 'string' || descricao.length > 10) 
        return response.status(400).send({ error: "Parâmetros inválidos" });

    const updatedSaldo = tipo === 'c' ? cliente.saldo + valor : cliente.saldo - valor;
    const transacao = { valor, tipo, descricao, realizada_em: new Date().toISOString() };

    await database.collection('clientes').updateOne({ id: parseInt(id) }, {
        $set: { saldo: updatedSaldo },
        $push: { transacoes: transacao },
    });

    response.status(200).send({ limite: cliente.limite, saldo: updatedSaldo });
});

app.get('/clientes/:id/extrato', async (request, response) => {
    const { id } = request.params;
    const cliente = await database.collection('clientes').findOne({ id: parseInt(id) });

    if (!cliente) 
        return response.status(404).send();

    response.status(200).send({
        saldo: {
        total: cliente.saldo,
        data_extrato: new Date().toISOString(),
        limite: cliente.limite
        },
        ultimas_transacoes: cliente.transacoes.slice(-10).reverse()
    });
});

module.exports = app;