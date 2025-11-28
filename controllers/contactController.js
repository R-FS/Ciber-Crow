// Armazenamento em banco de dados
const { query } = require('../db/database');

// Obter a próxima ID disponível
const getNextId = async () => {
    const result = await query('SELECT MAX(id) as max_id FROM contacts');
    const maxId = result[0].max_id;
    return (maxId > 0 ? maxId + 1 : 1).toString();
};

// Salvar mensagem de contato
exports.submitContactForm = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        // Validação básica
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos os campos são obrigatórios' 
            });
        }
        
        const result = await query(
            'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)',
            [name, email, subject, message]
        );
        
        const [newMessage] = await query('SELECT * FROM contacts WHERE id = ?', [result.insertId]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Mensagem enviada com sucesso!',
            data: newMessage
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar a mensagem' 
        });
    }
};

// Obter todas as mensagens
exports.getAllContacts = async (req, res) => {
    try {
        const messages = await query('SELECT * FROM contacts ORDER BY created_at DESC');
        res.status(200).json({ 
            success: true, 
            count: messages.length,
            data: messages 
        });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar as mensagens' 
        });
    }
};

// Atualizar status de uma mensagem
exports.updateMessageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['unread', 'in-progress', 'resolved'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status inválido. Use: unread, in-progress ou resolved' 
            });
        }
        
        await query('UPDATE contacts SET status = ? WHERE id = ?', [status, id]);
        const [updatedMessage] = await query('SELECT * FROM contacts WHERE id = ?', [id]);
        
        if (!updatedMessage) {
            return res.status(404).json({ 
                success: false, 
                message: 'Mensagem não encontrada' 
            });
        }
        
        res.status(200).json({ 
            success: true, 
            data: updatedMessage
        });
    } catch (error) {
        console.error('Erro ao atualizar status da mensagem:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao atualizar o status da mensagem' 
        });
    }
};

// Excluir uma mensagem
exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM contacts WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Mensagem não encontrada' 
            });
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Mensagem excluída com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao excluir mensagem:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao excluir a mensagem' 
        });
    }
};
