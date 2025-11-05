const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, run } = require('../db/database');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../middleware/auth');
const { validationResult } = require('express-validator');

// Tempo de expiração dos tokens (em segundos)
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutos
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 dias

// Registrar um novo usuário
const register = async (req, res) => {
    try {
        // Validar os dados de entrada
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password } = req.body;

        // Verificar se o email já está em uso
        const existingEmail = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: 'Este email já está em uso' });
        }

        // Verificar se o nome de usuário já está em uso
        const existingUsername = await query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUsername.length > 0) {
            return res.status(400).json({ error: 'Este nome de usuário já está em uso' });
        }

        // Criptografar a senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Inserir o novo usuário no banco de dados
        const result = await run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        // Buscar o usuário recém-criado para obter o ID gerado
        const [newUser] = await query('SELECT id, username, email FROM users WHERE id = ?', [result.lastID]);
        
        if (!newUser) {
            throw new Error('Falha ao criar o usuário');
        }

        // Gerar tokens
        const user = { 
            id: newUser.id, 
            username: newUser.username, 
            email: newUser.email 
        };
        const accessToken = generateAccessToken(user);
        const refreshToken = await generateRefreshToken(user);

        res.status(201).json({
            message: 'Usuário registrado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Erro ao registrar usuário');
        res.status(500).json({ error: 'Erro ao processar o registro' });
    }
};

// Fazer login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscar usuário pelo email
        const users = await query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = users[0];

        // Verificar a senha
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Gerar tokens
        const userData = { id: user.id, username: user.username, email: user.email };
        const accessToken = generateAccessToken(userData);
        const refreshToken = await generateRefreshToken(userData);

        res.json({
            user: userData,
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Erro ao processar login');
        res.status(500).json({ error: 'Erro ao processar o login' });
    }
};

// Atualizar token de acesso
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        // Verificar se o token de atualização existe no banco de dados
        const tokens = await query('SELECT * FROM refresh_tokens WHERE token = ?', [refreshToken]);
        if (tokens.length === 0) {
            return res.status(403).json({ error: 'Token de atualização inválido' });
        }

        const tokenData = tokens[0];

        // Verificar se o token expirou
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        if (now > expiresAt) {
            // Remover token expirado
            await run('DELETE FROM refresh_tokens WHERE id = ?', [tokenData.id]);
            return res.status(403).json({ error: 'Token de atualização expirado' });
        }

        // Buscar dados do usuário
        const users = await query('SELECT id, username, email FROM users WHERE id = ?', [tokenData.user_id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = users[0];
        const newAccessToken = generateAccessToken(user);

        res.json({
            accessToken: newAccessToken
        });

    } catch (error) {
        console.error('Erro ao atualizar token');
        res.status(500).json({ error: 'Erro ao atualizar token de acesso' });
    }
};

// Gerar token de acesso
function generateAccessToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

// Gerar e salvar token de atualização
async function generateRefreshToken(user) {
    const refreshToken = jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    
    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias a partir de agora

    // Salvar o token no banco de dados
    await run(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt]
    );

    return refreshToken;
}

// Fazer logout
const logout = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(400).json({ error: 'Token de autenticação não fornecido' });
        }

        // Verificar se o token é válido e obter o ID do usuário
        jwt.verify(token, JWT_SECRET, async (err, user) => {
            if (err) {
                // Token inválido ou expirado, mas continuamos com o logout
                // Não é necessário fazer nada aqui, apenas continuar o fluxo
            }
            
            // Se tivermos um usuário válido, remover todos os tokens de atualização dele
            if (user && user.id) {
                try {
                    await run('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
                } catch (dbError) {
                    console.error('Erro ao remover tokens de atualização');
                    // Não interrompemos o fluxo em caso de erro ao remover tokens
                }
            }
            
            res.status(200).json({ 
                success: true, 
                message: 'Logout realizado com sucesso' 
            })
        });

    } catch (error) {
        console.error('Erro ao processar logout');
        // Em produção, retornamos sucesso mesmo em caso de erro
        res.status(200).json({ 
            success: true, 
            message: 'Sessão finalizada' 
        });
    }
};

// Obter perfil do usuário autenticado
const getProfile = async (req, res) => {
    try {
        const users = await query('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(users[0]);
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário');
        res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    getProfile
};
