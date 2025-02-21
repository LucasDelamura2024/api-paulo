// api/index.js - Entry point for Vercel serverless functions
const mysql = require('serverless-mysql')({
    config: {
      host: process.env.DB_HOST || 'br808.hostgator.com.br',
      user: process.env.DB_USER || 'dispon40_spxhubs',
      password: process.env.DB_PASSWORD || 'Lucas0909@',
      database: process.env.DB_NAME || 'dispon40_flex_hubs',
      port: parseInt(process.env.DB_PORT || '3306')
    }
  });
  
  // Helper function to clean CPF
  const limparCPF = (cpf) => {
    return cpf.replace(/[^0-9]/g, '');
  };
  
  // Helper function to handle API responses
  const apiResponse = (statusCode, body) => {
    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    };
  };
  
  // API route handler
  module.exports = async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  
    // Set table names based on test mode
    const useTestTables = true;
    const motoristasTable = useTestTables ? 'motoristas_teste' : 'motoristas';
    const flexEntranceTable = useTestTables ? 'flex_entrance_teste' : 'flex_entrance';
  
    try {
      // Route: Test connection
      if (req.method === 'GET' && req.url === '/api/test-connection') {
        await mysql.query('SELECT 1');
        await mysql.end();
        return res.status(200).json({ status: 'success', message: 'Database connection successful' });
      }
  
      // Route: Check driver by CPF
      if (req.method === 'GET' && req.url.startsWith('/api/check-driver')) {
        const cpf = req.query.cpf || '';
        if (!cpf) {
          return res.status(400).json({ status: 'error', message: 'CPF is required' });
        }
  
        const cpfLimpo = limparCPF(cpf);
        
        const motorista = await mysql.query(
          `SELECT cpf, nome, telefone, veiculo, placa, rota, doca, driver_id 
           FROM ${motoristasTable} 
           WHERE cpf = ? OR cpf = ?`,
          [cpf, cpfLimpo]
        );
        
        await mysql.end();
        
        if (!motorista || motorista.length === 0) {
          return res.status(404).json({
            status: 'error',
            message: 'Motorista não encontrado',
            podeRegistrar: false
          });
        }
        
        return res.status(200).json({
          status: 'success',
          data: motorista[0],
          podeRegistrar: true,
          ambiente: useTestTables ? 'teste' : 'producao'
        });
      }
  
      // Route: Register driver entrance
      if (req.method === 'POST' && req.url === '/api/register-entrance') {
        const { cpf, tipo, latitude, longitude, localizacao } = req.body;
        
        if (!cpf || !tipo) {
          return res.status(400).json({ status: 'error', message: 'CPF and tipo are required' });
        }
        
        const cpfLimpo = limparCPF(cpf);
        
        // Get driver info
        const motoristas = await mysql.query(
          `SELECT *, telefone as phone, doca 
           FROM ${motoristasTable} 
           WHERE cpf = ? OR cpf = ?`,
          [cpf, cpfLimpo]
        );
        
        if (!motoristas || motoristas.length === 0) {
          await mysql.end();
          return res.status(404).json({
            status: 'error',
            message: 'Motorista não encontrado'
          });
        }
        
        const driver = motoristas[0];
        
        // Insert entrance record
        await mysql.query(
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
        
        await mysql.end();
        
        return res.status(201).json({
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
      }
  
      // Route: List all test drivers
      if (req.method === 'GET' && req.url === '/api/list-drivers') {
        const motoristas = await mysql.query(`SELECT * FROM ${motoristasTable} LIMIT 50`);
        await mysql.end();
        
        return res.status(200).json({
          status: 'success',
          count: motoristas.length,
          data: motoristas
        });
      }
  
      // Route: List recent entrances
      if (req.method === 'GET' && req.url === '/api/list-entrances') {
        const entradas = await mysql.query(
          `SELECT * FROM ${flexEntranceTable} ORDER BY id DESC LIMIT 50`
        );
        await mysql.end();
        
        return res.status(200).json({
          status: 'success',
          count: entradas.length,
          data: entradas
        });
      }
  
      // Route not found
      return res.status(404).json({ status: 'error', message: 'Route not found' });
    } catch (error) {
      console.error('API Error:', error);
      await mysql.end();
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: error.message
      });
    }
  };