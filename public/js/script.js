console.log('Script carregado. Aguardando DOM...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando configuração...');
    
    // Elementos da interface
    const startButton = document.getElementById('startButton');
    const resultsDiv = document.getElementById('results');
    const testStatus = document.getElementById('testStatus');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    
    if (!startButton || !resultsDiv || !testStatus || !statusText || !progressBar) {
        console.error('Erro: Elementos da interface não encontrados');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar a interface do teste. Por favor, recarregue a página.</p>
                    <p><small>Elementos da interface não encontrados</small></p>
                </div>`;
        }
        return;
    }
    
    const API_BASE_URL = window.location.origin;
    let testInProgress = false;
    
    // Função para formatar a velocidade
    const formatSpeed = (bitsPerSecond, decimals = 2) => {
        if (bitsPerSecond === 0) return '0 bps';
        const k = 1000; // Usando base 1000 para bits
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
        const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
        return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };
    
    // Função para formatar tempo
    const formatTime = (ms) => {
        return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
    };

    // Função para tentar renovar o token de acesso
    const refreshAccessToken = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                console.warn('Nenhum token de atualização encontrado');
                return false;
            }

            const response = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                return true;
            } else {
                console.warn('Falha ao renovar o token de acesso');
                // Redirecionar para login se o refresh token também estiver inválido
                if (response.status === 403) {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
                }
                return false;
            }
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            return false;
        }
    };

    // Função para salvar os resultados do teste no servidor
    const saveTestResults = async (results) => {
        const accessToken = localStorage.getItem('accessToken');
        
        // Se não houver token, não tenta salvar mas não é um erro
        if (!accessToken) {
            console.log('Usuário não autenticado. Os resultados não serão salvos.');
            return { success: false, requiresLogin: true };
        }

        const makeRequest = async (isRetry = false) => {
            try {
                const response = await fetch('/api/speedtest/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        downloadSpeed: results.download,
                        uploadSpeed: results.upload,
                        ping: results.ping,
                        jitter: results.jitter,
                        serverName: results.server,
                        serverLocation: 'Local',
                        ipAddress: '',
                        isp: ''
                    })
                });

                // Se o token expirou, tenta renovar e fazer a requisição novamente
                if (response.status === 403 && !isRetry) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return makeRequest(true); // Tenta novamente com o novo token
                    }
                }

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    console.warn('Não foi possível salvar os resultados:', error.message || 'Erro desconhecido');
                    return { 
                        success: false, 
                        requiresLogin: response.status === 401 || response.status === 403,
                        message: error.message || 'Erro ao salvar os resultados'
                    };
                }
                
                return { success: true };
            } catch (error) {
                console.error('Erro ao salvar resultados:', error);
                return { 
                    success: false, 
                    requiresLogin: false,
                    message: 'Erro de conexão ao salvar os resultados'
                };
            }
        };

        return await makeRequest();
    };

    // Função para atualizar os resultados
    const updateResults = async (results) => {
        const { download, upload, ping, jitter, server, timestamp } = results;
        
        // Tenta salvar os resultados no servidor
        const isLoggedIn = !!localStorage.getItem('accessToken');
        let saveMessage = '';
        
        if (isLoggedIn) {
            const saved = await saveTestResults(results);
            saveMessage = saved 
                ? '<div class="save-success"><i class="fas fa-check"></i> Resultados salvos no seu histórico</div>'
                : '<div class="save-warning"><i class="fas fa-exclamation-triangle"></i> Não foi possível salvar os resultados</div>';
        } else {
            saveMessage = '<div class="save-info"><i class="fas fa-info-circle"></i> <a href="/login">Faça login</a> para salvar seu histórico de testes</div>';
        }
        
        // Create results HTML
        const resultsHTML = `
            <div class="test-results">
                <h3>Resultados do Teste</h3>
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-download"></i> Download:</span>
                    <span class="result-value">${formatSpeed(download)}</span>
                </div>
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-upload"></i> Upload:</span>
                    <span class="result-value">${formatSpeed(upload)}</span>
                </div>
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-signal"></i> Ping:</span>
                    <span class="result-value">${ping} ms</span>
                </div>
                ${jitter ? `
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-wave-square"></i> Jitter:</span>
                    <span class="result-value">${jitter} ms</span>
                </div>` : ''}
                ${server ? `
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-server"></i> Servidor:</span>
                    <span class="result-value">${server}</span>
                </div>` : ''}
                <div class="result-item">
                    <span class="result-label"><i class="fas fa-clock"></i> Horário:</span>
                    <span class="result-value">${new Date(timestamp).toLocaleString()}</span>
                </div>
                ${saveMessage}
                <div class="history-button-container" style="margin-top: 20px;">
                    <a href="/test-history" class="history-button">
                        <i class="fas fa-history"></i> Ver Histórico de Testes
                    </a>
                </div>
            </div>`;
            
        // Update the results div
        resultsDiv.innerHTML = resultsHTML;
    };

    // Função para medir o ping (média de várias tentativas)
    const measurePing = async (attempts = 5) => {
        const results = [];
        
        for (let i = 0; i < attempts; i++) {
            const start = performance.now();
            try {
                const response = await fetch(`${API_BASE_URL}/api/ping?_=${Date.now() + i}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                
                if (!response.ok) throw new Error('Resposta inválida');
                
                const data = await response.json();
                const ping = performance.now() - start;
                results.push(ping);
                
                // Atualiza a UI com o progresso
                updateTestProgress('ping', i + 1, attempts, ping);
                
                // Pequeno atraso entre as tentativas
                if (i < attempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.error(`Tentativa ${i + 1} falhou:`, error);
                if (i === attempts - 1 && results.length === 0) {
                    throw new Error('Falha ao medir o ping');
                }
            }
        }
        
        // Calcula a média, removendo outliers
        const avg = results.reduce((a, b) => a + b, 0) / results.length;
        const jitter = Math.sqrt(
            results.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / results.length
        );
        
        return {
            ping: Math.round(avg * 10) / 10, // 1 casa decimal
            jitter: Math.round(jitter * 10) / 10
        };
    };
    
    // Função para medir a velocidade de download
    const measureDownloadSpeed = async () => {
        const fileSizes = [
            1 * 1024 * 1024,    // 1MB
            2 * 1024 * 1024,    // 2MB
            5 * 1024 * 1024     // 5MB
        ];
        
        let totalBits = 0;
        let totalTime = 0;
        
        for (let i = 0; i < fileSizes.length; i++) {
            const size = fileSizes[i];
            const startTime = performance.now();
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/download?size=${size}&_=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                
                if (!response.ok) throw new Error('Falha no download');
                
                // Lê os dados em chunks para medir a velocidade em tempo real
                const reader = response.body.getReader();
                let receivedLength = 0;
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    receivedLength += value.length;
                    
                    // Atualiza o progresso em tempo real
                    updateTestProgress('download', receivedLength, size, 0);
                }
                
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000; // segundos
                
                totalBits += size * 8; // bits
                totalTime += duration;
                
            } catch (error) {
                console.error(`Erro no teste de download (${formatSize(size)}):`, error);
                if (i === fileSizes.length - 1 && totalBits === 0) {
                    throw new Error('Falha ao medir a velocidade de download');
                }
            }
        }
        
        return totalTime > 0 ? totalBits / totalTime : 0;
    };
    
    // Função para medir a velocidade de upload
    const measureUploadSpeed = async () => {
        const fileSizes = [
            0.5 * 1024 * 1024,  // 0.5MB
            1 * 1024 * 1024,    // 1MB
            2 * 1024 * 1024     // 2MB
        ];
        
        let totalBits = 0;
        let totalTime = 0;
        
        for (let i = 0; i < fileSizes.length; i++) {
            const size = fileSizes[i];
            const data = new Uint8Array(size);
            const startTime = performance.now();
            
            try {
                // Cria um FormData para simular melhor um upload real
                const formData = new FormData();
                const blob = new Blob([data], { type: 'application/octet-stream' });
                formData.append('file', blob, 'speedtest.bin');
                
                const response = await fetch(`${API_BASE_URL}/api/upload?startTime=${startTime}&_=${Date.now()}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!response.ok) throw new Error('Falha no upload');
                
                const result = await response.json();
                const bitsTransferred = size * 8; // Tamanho em bits
                const durationInSeconds = (performance.now() - startTime) / 1000; // Duração em segundos
                const speedBps = bitsTransferred / durationInSeconds; // Velocidade em bits por segundo
                
                totalBits += bitsTransferred;
                totalTime += durationInSeconds;
                
                // Atualiza o progresso com a velocidade atual
                updateTestProgress('upload', i + 1, fileSizes.length, speedBps);
                
            } catch (error) {
                console.error(`Erro no teste de upload (${formatSize(size)}):`, error);
                if (i === fileSizes.length - 1 && totalBits === 0) {
                    throw new Error('Falha ao medir a velocidade de upload');
                }
            }
        }
        
        // Calcula a velocidade média de upload em bits por segundo
        const averageSpeedBps = totalTime > 0 ? totalBits / totalTime : 0;
        return averageSpeedBps;
    };
    
    // Função auxiliar para formatar tamanhos
    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    // Atualiza a interface durante os testes
    const updateTestProgress = (test, current, total, value) => {
        if (test === 'ping') {
            resultsDiv.innerHTML = `
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${(current / total) * 100}%"></div>
                </div>
                <div class="test-status">
                    <i class="fas fa-sync fa-spin"></i>
                    <span>Testando ping (${current}/${total}): ${Math.round(value)}ms</span>
                </div>`;
        } else if (test === 'download') {
            const percent = Math.min(100, Math.round((current / total) * 100));
            const speed = current > 0 ? formatSpeed((current * 8) / ((performance.now() - window.downloadStartTime) / 1000)) : '0 bps';
            
            resultsDiv.innerHTML = `
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="test-status">
                    <i class="fas fa-download"></i>
                    <span>Download: ${formatSize(current)} de ${formatSize(total)} (${speed})</span>
                </div>`;
        } else if (test === 'upload') {
            const percent = Math.min(100, Math.round((current / total) * 100));
            const speed = value > 0 ? formatSpeed(value) : '0 bps';
            
            resultsDiv.innerHTML = `
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="test-status">
                    <i class="fas fa-upload"></i>
                    <span>Upload: ${current} de ${total} (${speed})</span>
                </div>`;
        }
    };

    // Manipulador do botão de teste
    startButton.addEventListener('click', async () => {
        if (testInProgress) return;
        
        testInProgress = true;
        startButton.disabled = true;
        startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        // Limpa resultados anteriores
        resultsDiv.innerHTML = '<div class="test-status"><i class="fas fa-circle-notch fa-spin"></i> Iniciando teste de velocidade...</div>';
        
        try {
            // 1. Teste de Ping
            resultsDiv.innerHTML = '<div class="test-status"><i class="fas fa-sync fa-spin"></i> Medindo latência (ping)...</div>';
            const { ping, jitter } = await measurePing();
            
            // 2. Teste de Download
            resultsDiv.innerHTML = '<div class="test-status"><i class="fas fa-download"></i> Testando velocidade de download...</div>';
            window.downloadStartTime = performance.now();
            const downloadSpeed = await measureDownloadSpeed();
            
            // 3. Teste de Upload
            resultsDiv.innerHTML = '<div class="test-status"><i class="fas fa-upload"></i> Testando velocidade de upload...</div>';
            const uploadSpeed = await measureUploadSpeed();
            
            // 4. Prepara e exibe os resultados finais
            const testResults = {
                download: downloadSpeed,
                upload: uploadSpeed,
                ping: ping,
                jitter: jitter,
                server: window.location.hostname,
                timestamp: Date.now()
            };
            
            // Atualiza a interface com os resultados
            await updateResults(testResults);
            
            // Tenta salvar os resultados se o usuário estiver autenticado
            const saveResult = await saveTestResults(testResults);
            
            if (saveResult.requiresLogin) {
                // Mostra mensagem que o teste não foi salvo por falta de autenticação
                const saveStatus = document.createElement('div');
                saveStatus.className = 'save-status';
                saveStatus.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <p>Faça <a href="/login?redirect=${encodeURIComponent(window.location.pathname)}" class="alert-link">login</a> para salvar seus resultados no histórico.</p>
                            <small>Você pode fazer o teste sem salvar.</small>
                        </div>
                    </div>
                `;
                resultsDiv.appendChild(saveStatus);
            } else if (!saveResult.success) {
                // Mostra mensagem de erro ao salvar
                const saveStatus = document.createElement('div');
                saveStatus.className = 'save-status';
                saveStatus.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Não foi possível salvar os resultados: ${saveResult.message || 'Erro desconhecido'}</p>
                    </div>
                `;
                resultsDiv.appendChild(saveStatus);
            }
            
        } catch (error) {
            console.error('Erro no teste de velocidade:', error);
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Não foi possível completar o teste de velocidade.</p>
                    <p><small>${error.message || 'Erro desconhecido'}</small></p>
                    <button id="retryButton" class="retry-button">
                        <i class="fas fa-sync-alt"></i> Tentar novamente
                    </button>
                </div>`;
                
            // Adiciona o event listener para o botão de tentar novamente
            document.getElementById('retryButton')?.addEventListener('click', () => {
                startButton.click();
            });
        } finally {
            testInProgress = false;
            startButton.innerHTML = '<i class="fas fa-redo"></i>';
            startButton.disabled = false;
        }
    });
    
    // Inicialização
    const showWelcomeMessage = () => {
        resultsDiv.innerHTML = `
            <div class="welcome-message">
                <h3>Teste de Velocidade</h3>
                <p>Clique no botão para iniciar o teste de velocidade.</p>
                <p>O teste irá medir:</p>
                <ul>
                    <li><i class="fas fa-signal"></i> Latência (Ping)</li>
                    <li><i class="fas fa-download"></i> Velocidade de Download</li>
                    <li><i class="fas fa-upload"></i> Velocidade de Upload</li>
                </ul>
                <div class="history-button-container">
                    <a href="/test-history" class="history-button">
                        <i class="fas fa-history"></i> Ver Histórico de Testes
                    </a>
                </div>
            </div>`;
    };
    
    // Show initial welcome message
    showWelcomeMessage();
});
