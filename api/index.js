const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'br808.hostgator.com.br',
    user: process.env.DB_USER || 'dispon40_spxhubs',
    password: process.env.DB_PASS || 'Lucas0909@',
    database: process.env.DB_NAME || 'dispon40_flex_hubs',
    port: parseInt(process.env.DB_PORT || '3306')
};

// Criar pool de conexões
const pool = mysql.createPool(dbConfig);

// Tabela fixa
const flexEntranceTable = 'flex_entrance_teste';

// Rota inicial (teste de conexão)
app.get('/', async (req, res) => {
    res.json({ 
      message: 'API de Check-in está funcionando!',
      status: 'online'
    });
});

// Listar entradas
app.get('/list-entrances', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(`
                SELECT * FROM ${flexEntranceTable} 
                ORDER BY timestamp DESC
            `);
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar registros', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Tratamento de rota não encontrada
app.use((req, res) => {
    res.status(404).json({ 
        status: 'error',
        message: 'Rota não encontrada' 
    });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});