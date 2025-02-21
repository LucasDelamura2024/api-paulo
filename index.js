// api/index.js
const mysql = require('mysql2/promise');

// Create a connection pool
let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'br808.hostgator.com.br',
      user: process.env.DB_USER || 'dispon40_spxhubs',
      password: process.env.DB_PASSWORD || 'Lucas0909@',
      database: process.env.DB_NAME || 'dispon40_flex_hubs',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

// Helper function to clean CPF
const limparCPF = (cpf) => {
  return cpf ? cpf.replace(/[^0-9]/g, '') : '';
};

// Route: Test connection
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Set table names based on test mode
  const useTestTables = true;
  const motoristasTable = useTestTables ? 'motoristas_teste' : 'motoristas';
  const flexEntranceTable = useTestTables ? 'flex_entrance_teste' : 'flex_entrance';

  try {
    const path = req.url.split('?')[0];
    
    // Test connection endpoint
    if (req.method === 'GET' && path === '/api/test-connection') {
      const pool = getPool();
      const [result] = await pool.query('SELECT 1 as test');
      
      res.status(200).json({ 
        status: 'success', 
        message: 'Database connection successful',
        result: result[0]
      });
      return;
    }
    
    // Check driver by CPF
    if (req.method === 'GET' && path === '/api/check-driver') {
      const cpf = req.query.cpf || '';
      if (!cpf) {
        res.status(400).json({ status: 'error', message: 'CPF is required' });
        return;
      }

      const cpfLimpo = limparCPF(cpf);
      const pool = getPool();
      
      const [rows] = await pool.query(
        `SELECT cpf, nome, telefone, veiculo, placa, rota, doca, driver_id 
         FROM ${motoristasTable} 
         WHERE cpf = ? OR cpf = ?`,
        [cpf, cpfLimpo]
      );
      
      if (!rows || rows.length === 0) {
        res.status(404).json({
          status: 'error',
          message: 'Motorista não encontrado',
          podeRegistrar: false
        });
        return;
      }
      
      res.status(200).json({
        status: 'success',
        data: rows[0],
        podeRegistrar: true,
        ambiente: useTestTables ? 'teste' : 'producao'
      });
      return;
    }
    
    // Register driver entrance
    if (req.method === 'POST' && path === '/api/register-entrance') {
      // Parse request body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      await new Promise(resolve => {
        req.on('end', resolve);
      });
      
      const { cpf, tipo, latitude, longitude, localizacao } = JSON.parse(body);
      
      if (!cpf || !tipo) {
        res.status(400).json({ status: 'error', message: 'CPF and tipo are required' });
        return;
      }
      
      const cpfLimpo = limparCPF(cpf);
      const pool = getPool();
      
      // Get driver info
      const [motoristas] = await pool.query(
        `SELECT *, telefone as phone, doca 
         FROM ${motoristasTable} 
         WHERE cpf = ? OR cpf = ?`,
        [cpf, cpfLimpo]
      );
      
      if (!motoristas || motoristas.length === 0) {
        res.status(404).json({
          status: 'error',
          message: 'Motorista não encontrado'
        });
        return;
      }
      
      const driver = motoristas[0];
      
      // Insert entrance record
      await pool.query(
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
        data: {
          driver,
          entrada: {
            tipo,
            status: 'aguardando',
            timestamp: new Date().toISOString()
          }
        }
      });
      return;
    }
    
    // List all test drivers
    if (req.method === 'GET' && path === '/api/list-drivers') {
      const pool = getPool();
      const [rows] = await pool.query(`SELECT * FROM ${motoristasTable} LIMIT 50`);
      
      res.status(200).json({
        status: 'success',
        count: rows.length,
        data: rows
      });
      return;
    }
    
    // List recent entrances
    if (req.method === 'GET' && path === '/api/list-entrances') {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT * FROM ${flexEntranceTable} ORDER BY id DESC LIMIT 50`
      );
      
      res.status(200).json({
        status: 'success',
        count: rows.length,
        data: rows
      });
      return;
    }
    
    // Route not found
    res.status(404).json({ status: 'error', message: 'Route not found' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
};