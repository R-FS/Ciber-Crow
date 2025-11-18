const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Validação para registro
const validateRegistration = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('O nome de usuário deve ter entre 3 e 30 caracteres'),
    body('email')
        .isEmail()
        .withMessage('Por favor, insira um email válido')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('A senha deve ter pelo menos 6 caracteres')
        .matches(/\d/)
        .withMessage('A senha deve conter pelo menos um número')
];

// Validação para login
const validateLogin = [
    body('email').isEmail().withMessage('Por favor, insira um email válido'),
    body('password').notEmpty().withMessage('A senha é obrigatória')
];

// Rotas de autenticação
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

// Rota protegida para teste
router.get('/profile', authenticateToken, authController.getProfile);

// Rota para verificar autenticação
router.get('/check', authenticateToken, authController.checkAuth);

module.exports = router;
