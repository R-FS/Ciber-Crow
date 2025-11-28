const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

// Chave secreta para assinar os tokens (em produção, use uma variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'seu_outro_segredo_super_secreto';

// Middleware para verificar o token JWT
const authenticateToken = (req, res, next) => {
    // Tenta obter o token do cabeçalho de autorização
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Se não encontrou no cabeçalho, tenta obter do cookie
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        // Se for uma requisição de API, retorna erro JSON
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Token de autenticação não fornecido' });
        }
        // Se for uma requisição de página, redireciona para o login
        return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Se o token estiver inválido, limpa o cookie e redireciona
            res.clearCookie('token');
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Token inválido ou expirado' });
            }
            return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
        }
        
        // Token válido, adiciona o usuário à requisição
        req.user = user;
        res.locals.user = user; // Disponibiliza o usuário para as views
        next();
    });
};

// Middleware para verificar o token de atualização
const verifyRefreshToken = (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Token de atualização não fornecido' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token de atualização inválido' });
        }

        try {
            // Verificar se o token de atualização ainda é válido no banco de dados
            const tokens = await query('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")', [refreshToken]);
            
            if (tokens.length === 0) {
                return res.status(403).json({ error: 'Token de atualização expirado' });
            }

            req.user = user;
            req.refreshToken = refreshToken;
            next();
        } catch (error) {
            console.error('Erro ao verificar token de atualização:', error);
            res.status(500).json({ error: 'Erro ao processar autenticação' });
        }
    });
};

// Middleware para verificar se o usuário é administrador
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Não autenticado' });
            }
            return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
        }

        // Busca o usuário no banco de dados para verificar se é admin
        const [user] = await query('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        
        if (!user || !user.is_admin) {
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
            }
            return res.status(403).render('403', { 
                title: 'Acesso Negado', 
                message: 'Você não tem permissão para acessar esta página.' 
            });
        }

        // Atualiza o objeto do usuário na requisição
        req.user.isAdmin = true;
        res.locals.user = req.user;
        
        next();
    } catch (error) {
        console.error('Erro ao verificar permissões de administrador:', error);
        if (req.path.startsWith('/api/')) {
            return res.status(500).json({ error: 'Erro ao verificar permissões' });
        }
        res.status(500).render('500', { 
            title: 'Erro do Servidor',
            message: 'Ocorreu um erro ao verificar suas permissões.'
        });
    }
};

module.exports = {
    JWT_SECRET,
    JWT_REFRESH_SECRET,
    authenticateToken,
    verifyRefreshToken,
    isAdmin
};
