document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            
            try {
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
                
                const response = await fetch('/enviar-mensagem', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: formData.get('name'),
                        email: formData.get('email'),
                        subject: formData.get('subject'),
                        message: formData.get('message')
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Show success message
                    showMessage('Mensagem enviada com sucesso!', 'success');
                    // Reset form
                    contactForm.reset();
                } else {
                    // Show error message
                    showMessage(result.message || 'Erro ao enviar a mensagem. Tente novamente.', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showMessage('Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.', 'error');
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
    
    function showMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create and show new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;
        
        // Insert after the form title or at the beginning of the form
        const formTitle = contactForm.querySelector('h2');
        if (formTitle) {
            formTitle.insertAdjacentElement('afterend', messageDiv);
        } else {
            contactForm.insertBefore(messageDiv, contactForm.firstChild);
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 300);
        }, 5000);
    }
});
