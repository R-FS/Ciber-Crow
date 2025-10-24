document.addEventListener('DOMContentLoaded', function() {
    const loginBox = document.getElementById('loginBox');
    const signupBox = document.getElementById('signupBox');
    const showLoginBtn = document.getElementById('showLogin');
    const showSignupBtn = document.getElementById('showSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const API_BASE_URL = window.location.origin + '/api/auth';

    // Mostrar formulário de login
    function showLogin() {
        loginBox.style.display = 'block';
        signupBox.style.display = 'none';
        showLoginBtn.classList.add('active');
        showSignupBtn.classList.remove('active');
    }

    // Mostrar formulário de registro
    function showSignup() {
        loginBox.style.display = 'none';
        signupBox.style.display = 'block';
        showLoginBtn.classList.remove('active');
        showSignupBtn.classList.add('active');
    }

    // Exibir mensagem de erro
    function showError(element, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Remover mensagens de erro anteriores
        const existingError = element.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        element.parentElement.appendChild(errorDiv);
        element.focus();
    }

    // Remover mensagem de erro
    function clearError(input) {
        const errorDiv = input.parentElement.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    // Lidar com o login
    async function handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('username').value; // Este campo deve conter o email
        const password = document.getElementById('password').value;
        
        // Validação básica
        if (!email || !password) {
            showError(loginForm, 'Por favor, preencha todos os campos');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email: email, 
                    password: password 
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Credenciais inválidas');
            }
            
            // Armazenar tokens e informações do usuário
            if (data.accessToken && data.refreshToken) {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirecionar para a página inicial
                window.location.href = '/';
            } else {
                throw new Error('Dados de autenticação inválidos');
            }
            
        } catch (error) {
            console.error('Erro no login:', error);
            showError(loginForm, error.message || 'Erro ao fazer login. Verifique suas credenciais.');
        }
    }
    
    // Lidar com o registro
    async function handleSignup(event) {
        event.preventDefault();
        
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        // Validação básica do lado do cliente
        if (!username || !email || !password || !confirmPassword) {
            showError(signupForm, 'Por favor, preencha todos os campos');
            return;
        }
        
        if (password !== confirmPassword) {
            showError(document.getElementById('signup-confirm-password'), 'As senhas não coincidem');
            return;
        }
        
        if (password.length < 6) {
            showError(document.getElementById('signup-password'), 'A senha deve ter pelo menos 6 caracteres');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar conta');
            }
            
            // Mostrar mensagem de sucesso e alternar para o formulário de login
            alert('Conta criada com sucesso! Faça login para continuar.');
            showLogin();
            
        } catch (error) {
            console.error('Erro no registro:', error);
            showError(signupForm, error.message || 'Erro ao criar conta. Tente novamente.');
        }
    }

    // Event listeners
    showLoginBtn.addEventListener('click', showLogin);
    showSignupBtn.addEventListener('click', showSignup);
    
    // Adicionar listeners para limpar erros quando o usuário digitar
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => clearError(input));
    });
    
    // Adicionar listeners para os formulários
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    // Verificar se há parâmetro na URL para mostrar o registro
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('form') === 'signup') {
        showSignup();
    }
});