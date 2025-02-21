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

// Definir se deve usar tabelas de teste
const useTestTables = true;
const motoristasTable = useTestTables ? 'motoristas_teste' : 'motoristas';
const flexEntranceTable = useTestTables ? 'flex_entrance_teste' : 'flex_entrance';

// Função para limpar o CPF (remover pontos e traços)
function limparCPF(cpf) {
    return cpf ? cpf.replace(/[^0-9]/g, '') : '';
}

// Rota inicial (teste de conexão)
// Rota inicial (teste de conexão)
app.get('/', async (req, res) => {
    res.json({ 
      message: 'API de Check-in está funcionando!',
      status: 'online'
    });
  });

// Criar tabelas de teste (clone das tabelas originais)
app.post('/setup-test-tables', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Criar tabela motoristas_teste
            await connection.query(`
                CREATE TABLE IF NOT EXISTS motoristas_teste LIKE motoristas;
                TRUNCATE TABLE motoristas_teste;
                INSERT INTO motoristas_teste SELECT * FROM motoristas;
            `);
            
            // Criar tabela flex_entrance_teste
            await connection.query(`
                CREATE TABLE IF NOT EXISTS flex_entrance_teste LIKE flex_entrance;
                TRUNCATE TABLE flex_entrance_teste;
                INSERT INTO flex_entrance_teste SELECT * FROM flex_entrance;
            `);
            
            res.json({ 
                message: 'Tabelas de teste criadas com sucesso!',
                tables: [motoristasTable, flexEntranceTable]
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Erro ao criar tabelas de teste', 
                details: error.message 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro de conexão', 
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
                data: rows[0],
                ambiente: useTestTables ? 'teste' : 'produção'
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
                `SELECT *, telefone as phone, doca FROM ${motoristasTable} 
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
                    driver.phone,
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
app.get('/list-entrances', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${flexEntranceTable} ORDER BY id DESC LIMIT 50`
            );
            
            res.json({
                status: 'success',
                count: rows.length,
                data: rows
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error',
                message: 'Erro ao listar entradas',
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
    console.log(`Ambiente: ${useTestTables ? 'TESTE' : 'PRODUÇÃO'}`);
    console.log(`Tabelas: ${motoristasTable}, ${flexEntranceTable}`);
});