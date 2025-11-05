const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração da conexão com o banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'CyberCrowDB',
    database: 'cibercrow', // Nome do banco de dados sem a extensão .db
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: false,
    multipleStatements: false
};

// Criar pool de conexões
const pool = mysql.createPool(dbConfig);

// Testar a conexão e inicializar o banco de dados
async function initializeDatabase() {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Selecionar o banco de dados
        await connection.query('USE cibercrow');
        
        // Criar tabelas se não existirem
        await createTables(connection);
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados');
        throw err;
    } finally {
        if (connection) connection.release();
    }
}

// Criar tabelas necessárias
async function createTables(connection) {
    try {
        // Criar banco de dados se não existir
        await connection.query('CREATE DATABASE IF NOT EXISTS `cibercrow`');
        await connection.query('USE `cibercrow`');
        
        // Tabela de usuários
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Tabela de tokens de atualização
        await connection.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Tabela para armazenar os testes de velocidade
        await connection.query(`
            CREATE TABLE IF NOT EXISTS speed_tests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                download_speed DECIMAL(15, 2) NOT NULL COMMENT 'Velocidade de download em Mbps',
                upload_speed DECIMAL(15, 2) NOT NULL COMMENT 'Velocidade de upload em Mbps',
                ping DECIMAL(10, 2) NOT NULL COMMENT 'Latência em ms',
                jitter DECIMAL(10, 2) COMMENT 'Variação de latência em ms',
                server_name VARCHAR(255) COMMENT 'Nome do servidor de teste',
                server_location VARCHAR(255) COMMENT 'Localização do servidor',
                ip_address VARCHAR(45) COMMENT 'Endereço IP do usuário',
                isp VARCHAR(255) COMMENT 'Provedor de Internet',
                test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_test_date (user_id, test_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    } catch (err) {
        console.error('Erro ao configurar o banco de dados');
        throw err;
    }
}

// Função para executar consultas com parâmetros
async function query(sql, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (err) {
        console.error('Erro na consulta ao banco de dados');
        throw err;
    } finally {
        if (connection) connection.release();
    }
}

// Função para executar comandos (INSERT, UPDATE, DELETE)
async function run(sql, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.execute(sql, params);
        return {
            lastID: result.insertId,
            changes: result.affectedRows
        };
    } catch (err) {
        console.error('Erro na execução da operação no banco de dados');
        throw err;
    } finally {
        if (connection) connection.release();
    }
}

// Inicializar a conexão com o banco de dados
initializeDatabase().catch(err => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
});

module.exports = {
    pool,
    query,
    run
}
