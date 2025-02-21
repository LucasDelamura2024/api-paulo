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
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

// Criação do pool de conexões
const pool = mysql.createPool(dbConfig);

// Rota de teste da conexão
app.get('/', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ 
            message: 'API do Check-in Flex está funcionando!',
            status: 'online',
            database: 'conectado' 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Erro ao conectar com o banco de dados',
            error: error.message 
        });
    }
});

// Listar entradas
app.get('/list-entrances', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(`
                SELECT * FROM flex_entrance_teste 
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

// ============ ROTAS FLEX_ENTRANCE ============

// Listar todas as entradas
app.get('/entries', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(`
                SELECT * FROM flex_entrance_teste 
                ORDER BY timestamp DESC 
                LIMIT 100
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

// Buscar entrada por CPF
app.get('/entries/driver/:cpf', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT * FROM flex_entrance_teste WHERE cpf = ? ORDER BY timestamp DESC LIMIT 100',
                [req.params.cpf]
            );
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

// Buscar entradas por status
app.get('/entries/status/:status', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT * FROM flex_entrance_teste WHERE status = ? ORDER BY timestamp DESC LIMIT 100',
                [req.params.status]
            );
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

// Nova entrada
app.post('/entries', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'INSERT INTO flex_entrance_teste SET ?',
                [req.body]
            );
            res.status(201).json({ id: result.insertId, message: 'Entrada criada com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar entrada', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// ============ ROTAS MOTORISTAS ============

// Listar todos os motoristas
app.get('/motoristas', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM motoristas_teste ORDER BY last_activity DESC');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar motoristas', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Buscar motorista específico
app.get('/motoristas/:driver_id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT * FROM motoristas_teste WHERE driver_id = ?',
                [req.params.driver_id]
            );
            if (rows.length === 0) {
                res.status(404).json({ message: 'Motorista não encontrado' });
            } else {
                res.json(rows[0]);
            }
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar motorista', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Novo motorista
app.post('/motoristas', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'INSERT INTO motoristas_teste SET ?',
                [req.body]
            );
            res.status(201).json({ id: result.insertId, message: 'Motorista cadastrado com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao cadastrar motorista', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Atualizar motorista
app.put('/motoristas/:driver_id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'UPDATE motoristas_teste SET ? WHERE driver_id = ?',
                [req.body, req.params.driver_id]
            );
            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Motorista não encontrado' });
            } else {
                res.json({ message: 'Motorista atualizado com sucesso' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar motorista', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// ============ ROTAS STATUS_ONTIME ============

// Listar todos os status
app.get('/status-ontime', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM status_ontime_teste ORDER BY timestamp DESC');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar status', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Buscar status por motorista
app.get('/status-ontime/driver/:driver_id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT * FROM status_ontime_teste WHERE driver_id = ? ORDER BY timestamp DESC',
                [req.params.driver_id]
            );
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar status', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Novo status
app.post('/status-ontime', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'INSERT INTO status_ontime_teste SET ?',
                [req.body]
            );
            res.status(201).json({ id: result.insertId, message: 'Status registrado com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao registrar status', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Atualizar status
app.put('/status-ontime/:id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'UPDATE status_ontime_teste SET ? WHERE id = ?',
                [req.body, req.params.id]
            );
            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Status não encontrado' });
            } else {
                res.json({ message: 'Status atualizado com sucesso' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar status', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// ============ ROTAS STATUS_DOCA ============

// Listar status de todas as docas
app.get('/status-doca', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM status_doca_teste ORDER BY data_alteracao DESC');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar status das docas', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Buscar status de uma doca específica
app.get('/status-doca/:doca', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT * FROM status_doca_teste WHERE doca = ?',
                [req.params.doca]
            );
            if (rows.length === 0) {
                res.status(404).json({ message: 'Doca não encontrada' });
            } else {
                res.json(rows[0]);
            }
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar status da doca', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Novo status de doca
app.post('/status-doca', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'INSERT INTO status_doca_teste SET ?',
                [req.body]
            );
            res.status(201).json({ id: result.insertId, message: 'Status da doca registrado com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao registrar status da doca', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Atualizar status de doca
app.put('/status-doca/:doca', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'UPDATE status_doca_teste SET ? WHERE doca = ?',
                [req.body, req.params.doca]
            );
            if (result.affectedRows === 0) {
                res.status(404).json({ message: 'Doca não encontrada' });
            } else {
                res.json({ message: 'Status da doca atualizado com sucesso' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar status da doca', details: error.message });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro de conexão', details: error.message });
    }
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});