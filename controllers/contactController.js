// Armazenamento em memória (temporário)
let contacts = [];

// Obter a próxima ID disponível
const getNextId = () => (contacts.length > 0 
    ? Math.max(...contacts.map(c => parseInt(c.id))) + 1 
    : 1).toString();

// Salvar mensagem de contato (em memória)
exports.submitContactForm = (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        // Validação básica
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
        }

        // Adicionar novo contato ao array em memória
        const newContact = {
            id: getNextId(),
            name,
            email,
            subject,
            message,
            status: 'unread', // Novo campo para controle de status
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        contacts.push(newContact);
        console.log('Nova mensagem de contato recebida:', newContact);
        
        res.status(200).json({ 
            success: true, 
            message: 'Mensagem enviada com sucesso!',
            data: newContact
        });
    } catch (error) {
        console.error('Erro ao processar formulário de contato:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar o formulário' 
        });
    }
};

// Obter todas as mensagens
exports.getAllContacts = (req, res) => {
    try {
        // Ordena por data de atualização (mais recentes primeiro)
        const sortedContacts = [...contacts].sort((a, b) => 
            new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date)
        );
        
        res.status(200).json({ 
            success: true, 
            count: contacts.length,
            data: sortedContacts
        });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao carregar as mensagens' 
        });
    }
};

// Atualizar status de uma mensagem
exports.updateMessageStatus = (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['unread', 'in-progress', 'resolved'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status inválido. Use: unread, in-progress ou resolved' 
            });
        }
        
        const messageIndex = contacts.findIndex(m => m.id === id);
        
        if (messageIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Mensagem não encontrada' 
            });
        }
        
        // Atualiza o status e a data de atualização
        contacts[messageIndex] = {
            ...contacts[messageIndex],
            status,
            updatedAt: new Date().toISOString()
        };
        
        res.status(200).json({ 
            success: true, 
            data: contacts[messageIndex]
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
exports.deleteMessage = (req, res) => {
    try {
        const { id } = req.params;
        const initialLength = contacts.length;
        
        contacts = contacts.filter(message => message.id !== id);
        
        if (contacts.length === initialLength) {
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
