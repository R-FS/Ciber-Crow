document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('loadHistory');
    const limitSelect = document.getElementById('limitSelect');
    const historyBody = document.getElementById('historyBody');
    const loadingDiv = document.getElementById('loading');
    const statsContainer = document.getElementById('statsContainer');

    // Format date to local string
    const formatDate = (dateString) => {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleString('pt-BR', options);
    };

    // Format speed with 2 decimal places
    const formatSpeed = (speed) => {
        return parseFloat(speed).toFixed(2);
    };

    // Function to refresh access token
    const refreshAccessToken = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }
            
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }
            return data.accessToken;
        } catch (error) {
            console.error('Error refreshing token:', error);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            throw error;
        }
    };

    // Load test history
    const loadHistory = async (retry = true) => {
        const limit = limitSelect.value;
        loadingDiv.style.display = 'block';
        historyBody.innerHTML = '';
        statsContainer.innerHTML = '';

        // Check if user is logged in
        let token = localStorage.getItem('accessToken');
        if (!token) {
            showLoginPrompt();
            return;
        }

        try {
            // Build the URL
            const url = limit === '0' ? 
                '/api/speedtest/history' : 
                `/api/speedtest/history?limit=${limit}`;

            // First attempt with current token
            let response = await fetchWithToken(url, token);
            
            // If unauthorized, try to refresh token once
            if (response.status === 401 && retry) {
                token = await refreshAccessToken();
                response = await fetchWithToken(url, token);
            }

            // Handle the response
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Falha ao carregar histórico');
            }
            
            const tests = await response.json();
            
            // Display tests in table
            if (tests.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum teste encontrado</td></tr>';
                return;
            }
            
            // Show the tests and stats
            displayTests(tests);
            
        } catch (error) {
            console.error('Error loading history:', error);
            if (error.message.includes('token') || error.message.includes('expired')) {
                if (retry) {
                    // Try one more time after token refresh
                    return loadHistory(false);
                }
                showLoginPrompt('Sessão expirada. Por favor, faça login novamente.');
            } else {
                historyBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #e74c3c;">
                            <i class="fas fa-exclamation-triangle"></i> Erro ao carregar histórico: ${error.message}
                        </td>
                    </tr>`;
            }
        } finally {
            loadingDiv.style.display = 'none';
        }
    };
    
    // Helper function to show login prompt
    const showLoginPrompt = (message = 'Por favor, faça login para visualizar o histórico.') => {
        historyBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #e74c3c; padding: 20px;">
                    <i class="fas fa-exclamation-circle"></i> ${message}
                    <div style="margin-top: 20px;">
                        <a href="/login" class="history-button" style="display: inline-flex; padding: 8px 20px; font-size: 0.9em;">
                            <i class="fas fa-sign-in-alt"></i> Ir para Login
                        </a>
                    </div>
                </td>
            </tr>`;
        loadingDiv.style.display = 'none';
    };
    
    // Helper function to fetch with token
    const fetchWithToken = async (url, token) => {
        return await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
    };

    // Display tests in the table
    function displayTests(tests) {
        // Ensure all numeric values are properly formatted
        const formatNumericValue = (value) => {
            if (value === null || value === undefined) return 'N/A';
            const num = parseFloat(value);
            return isNaN(num) ? 'N/A' : num.toFixed(2);
        };

        // Clear the table
        historyBody.innerHTML = '';

        // Add each test to the table
        tests.forEach(test => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(test.createdAt)}</td>
                <td>${formatNumericValue(test.download)}</td>
                <td>${formatNumericValue(test.upload)}</td>
                <td>${formatNumericValue(test.ping)}</td>
                <td>${formatNumericValue(test.jitter)}</td>
                <td>${test.server || 'N/A'}</td>
            `;
            historyBody.appendChild(row);
        });

        // Calculate and display stats if there are tests
        if (tests.length > 0) {
            const stats = calculateStats(tests);
            statsContainer.innerHTML = `
                <div class="stats-box">
                    <h3>Estatísticas</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Média Download:</span>
                            <span class="stat-value">${formatNumericValue(stats.avgDownload)} Mbps</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Média Upload:</span>
                            <span class="stat-value">${formatNumericValue(stats.avgUpload)} Mbps</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Média Ping:</span>
                            <span class="stat-value">${formatNumericValue(stats.avgPing)} ms</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Média Jitter:</span>
                            <span class="stat-value">${formatNumericValue(stats.avgJitter)} ms</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Testes realizados:</span>
                            <span class="stat-value">${tests.length}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Calculate statistics from test results
    function calculateStats(tests) {
        const stats = {
            avgDownload: 0,
            avgUpload: 0,
            avgPing: 0,
            avgJitter: 0
        };

        if (tests.length === 0) return stats;

        const sum = tests.reduce((acc, test) => {
            acc.download += parseFloat(test.download) || 0;
            acc.upload += parseFloat(test.upload) || 0;
            acc.ping += parseFloat(test.ping) || 0;
            acc.jitter += parseFloat(test.jitter) || 0;
            return acc;
        }, { download: 0, upload: 0, ping: 0, jitter: 0 });

        stats.avgDownload = sum.download / tests.length;
        stats.avgUpload = sum.upload / tests.length;
        stats.avgPing = sum.ping / tests.length;
        stats.avgJitter = sum.jitter / tests.length;

        return stats;
    }

    // Event Listeners
    loadBtn.addEventListener('click', () => loadHistory());
    limitSelect.addEventListener('change', () => loadHistory());

    // Load history when page loads
    loadHistory();
});
