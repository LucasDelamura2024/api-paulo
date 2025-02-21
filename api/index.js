// index.js - API simplificada para check-in de motoristas
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

const path = require('path');

app.get('/teste', (req, res) => {
  res.sendFile(path.join(__dirname, 'teste-api.html'));
});

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

// Tabelas fixas
const motoristasTable = 'motoristas_teste';
const flexEntranceTable = 'flex_entrance_teste';

// Função para limpar o CPF (remover pontos e traços)
function limparCPF(cpf) {
    return cpf ? cpf.replace(/[^0-9]/g, '') : '';
}

// Rota inicial (teste de conexão)
app.get('/', async (req, res) => {
    res.json({ 
      message: 'API de Check-in está funcionando!',
      status: 'online'
    });
});

// Listar todas as entradas
app.get('/list-all-entrances', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Adicionar parâmetros de paginação
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 1000;
            const offset = (page - 1) * limit;
            
            // Consulta com paginação
            const [allRegisters] = await connection.query(`
                SELECT * FROM ${flexEntranceTable}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            
            // Contar total de registros
            const [countResult] = await connection.query(`
                SELECT COUNT(*) as total FROM ${flexEntranceTable}
            `);
            
            res.json({
                status: 'success',
                pagination: {
                    page,
                    limit,
                    total_registros: countResult[0].total
                },
                registros: allRegisters
            });
        } catch (error) {
            console.error('Erro na consulta:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Erro ao listar todos os registros',
                details: error.message
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Erro de conexão',
            details: error.message
        });
    }
});

// Verificar motorista por CPF
app.get('/check-driver', async (req, res) => {
    const cpf = req.query.cpf;
    if (!cpf) {
        return res.status(400).json({ 
            status: 'error',
            message: 'CPF é obrigatório' 
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const cpfLimpo = limparCPF(cpf);
            
            const [rows] = await connection.query(
                `SELECT *, telefone as phone FROM ${motoristasTable} 
                 WHERE cpf = ? OR cpf = ?`,
                [cpf, cpfLimpo]
            );
            
            if (rows.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Motorista não encontrado',
                    podeRegistrar: false
                });
            }
            
            res.json({
                status: 'success',
                message: 'Motorista encontrado',
                podeRegistrar: true,
                data: rows[0]
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: 'Erro ao verificar motorista',
                error: error.message 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: 'Erro de conexão com o banco de dados',
            error: error.message 
        });
    }
});

// Registrar entrada de motorista
app.post('/register-entrance', async (req, res) => {
    const { cpf, tipo, latitude, longitude, localizacao } = req.body;
    
    if (!cpf || !tipo) {
        return res.status(400).json({ 
            status: 'error',
            message: 'CPF e tipo são obrigatórios' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const cpfLimpo = limparCPF(cpf);
            
            // Buscar informações do motorista
            const [motoristas] = await connection.query(
                `SELECT * FROM ${motoristasTable} 
                 WHERE cpf = ? OR cpf = ?`,
                [cpf, cpfLimpo]
            );
            
            if (motoristas.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Motorista não encontrado'
                });
            }
            
            const driver = motoristas[0];
            
            // Inserir registro de entrada
            const [result] = await connection.query(
                `INSERT INTO ${flexEntranceTable} 
                 (driver_id, nome, veiculo, placa, tipo, status, 
                 saida, view, latitude, longitude, localizacao, rota, cpf, phone, doca) 
                 VALUES (?, ?, ?, ?, ?, 'aguardando', '1', 'online', ?, ?, ?, ?, ?, ?, ?)`,
                [
                    driver.driver_id,
                    driver.nome,
                    driver.veiculo,
                    driver.placa,
                    tipo,
                    latitude || null,
                    longitude || null,
                    localizacao || null,
                    driver.rota,
                    driver.cpf,
                    driver.telefone,
                    driver.doca
                ]
            );
            
            res.status(201).json({
                status: 'success',
                message: 'Motorista registrado com sucesso!',
                id: result.insertId,
                data: {
                    driver,
                    entrada: {
                        tipo,
                        status: 'aguardando',
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: 'Erro ao registrar entrada',
                error: error.message 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: 'Erro de conexão',
            error: error.message 
        });
    }
});

// Listar motoristas
app.get('/list-drivers', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${motoristasTable} LIMIT 50`
            );
            
            res.json({
                status: 'success',
                count: rows.length,
                data: rows
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: 'Erro ao listar motoristas',
                error: error.message 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: 'Erro de conexão',
            error: error.message 
        });
    }
});

// Listar entradas
// Listar entradas
// Listar todas as entradas
app.get('/entries', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(`
                SELECT * FROM ${flexEntranceTable} 
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
                `SELECT * FROM ${flexEntranceTable} WHERE cpf = ? ORDER BY timestamp DESC LIMIT 100`,
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

// Buscar entradas por status
app.get('/entries/status/:status', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${flexEntranceTable} WHERE status = ? ORDER BY timestamp DESC LIMIT 100`,
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
    console.log(`Tabelas: ${motoristasTable}, ${flexEntranceTable}`);
});