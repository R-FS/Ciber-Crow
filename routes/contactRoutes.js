const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Rota pública para envio de mensagens
router.post('/enviar-mensagem', contactController.submitContactForm);

// Rotas de administração (protegidas por autenticação e permissão de admin)
router.get('/api/contacts', authenticateToken, isAdmin, contactController.getAllContacts);
router.patch('/api/contacts/:id/status', authenticateToken, isAdmin, contactController.updateMessageStatus);
router.delete('/api/contacts/:id', authenticateToken, isAdmin, contactController.deleteMessage);

// Rota principal do painel de administração
router.get('/admin', authenticateToken, isAdmin, (req, res) => {
    res.render('admin', { 
        title: 'Painel de Administração',
        user: req.user,
        basePath: '/admin' // Add base path for static files
    });
});

// Rota para a interface de gerenciamento de contatos
router.get('/admin/contacts', authenticateToken, isAdmin, (req, res) => {
    res.render('admin/contacts', { 
        title: 'Gerenciar Mensagens',
        user: req.user
    });
});

module.exports = router;
