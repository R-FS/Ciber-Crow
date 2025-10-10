document.addEventListener('DOMContentLoaded', function() {
    const loginBox = document.getElementById('loginBox');
    const signupBox = document.getElementById('signupBox');
    const showLoginBtn = document.getElementById('showLogin');
    const showSignupBtn = document.getElementById('showSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const API_BASE_URL = window.location.origin;

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
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include' // Importante para enviar/armazenar cookies
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }
            
            // Armazenar tokens e redirecionar
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            
            // Redirecionar para a página inicial ou painel
            window.location.href = '/';
            
        } catch (error) {
            showError(loginForm, error.message || 'Erro ao fazer login. Verifique suas credenciais.');
        }
    }
    
    // Lidar com o registro
    async function handleSignup(event) {
        event.preventDefault();
        
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validação básica do lado do cliente
        if (password !== confirmPassword) {
            showError(document.getElementById('confirm-password'), 'As senhas não coincidem');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
                credentials: 'include' // Importante para enviar/armazenar cookies
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar conta');
            }
            
            // Login automático após registro
            await handleLogin({
                preventDefault: () => {},
                target: {
                    elements: {
                        'login-email': { value: email },
                        'login-password': { value: password }
                    }
                }
            });
            
        } catch (error) {
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