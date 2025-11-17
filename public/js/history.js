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
                historyBody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum teste encontrado</td></tr>';
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
                        <td colspan="6" class="text-center text-danger">
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
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-circle"></i> ${message}
                    <div class="mt-3">
                        <a href="/login" class="btn btn-primary">
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
    
    // Function to display tests in the table
    function displayTests(tests) {
        // Ensure all numeric values are properly formatted
        const formatNumericValue = (value) => {
            if (value === null || value === undefined) return 'N/A';
            const num = parseFloat(value);
            return isNaN(num) ? 'N/A' : num.toFixed(2);
        };

        // Display tests in table
        historyBody.innerHTML = tests.map(test => `
            <tr>
                <td>${formatDate(test.testDate)}</td>
                <td>${formatSpeed(test.downloadSpeed)}</td>
                <td>${formatSpeed(test.uploadSpeed)}</td>
                <td>${formatNumericValue(test.ping)}</td>
                <td>${test.jitter ? formatNumericValue(test.jitter) : 'N/A'}</td>
                <td>${test.serverName || 'N/A'}</td>
            </tr>
        `).join('');
        
        // Calculate and display statistics
        const stats = calculateStats(tests);
        displayStats(stats);
    }

    // Calculate statistics from test results
    const calculateStats = (tests) => {
        if (tests.length === 0) return {};

        const stats = {
            count: tests.length,
            avgDownload: 0,
            avgUpload: 0,
            avgPing: 0,
            maxDownload: -Infinity,
            maxUpload: -Infinity,
            minPing: Infinity
        };

        let totalDownload = 0;
        let totalUpload = 0;
        let totalPing = 0;

        tests.forEach(test => {
            totalDownload += parseFloat(test.downloadSpeed) || 0;
            totalUpload += parseFloat(test.uploadSpeed) || 0;
            totalPing += parseFloat(test.ping) || 0;

            if (test.downloadSpeed > stats.maxDownload) stats.maxDownload = test.downloadSpeed;
            if (test.uploadSpeed > stats.maxUpload) stats.maxUpload = test.uploadSpeed;
            if (test.ping < stats.minPing) stats.minPing = test.ping;
        });

        stats.avgDownload = totalDownload / tests.length;
        stats.avgUpload = totalUpload / tests.length;
        stats.avgPing = totalPing / tests.length;

        return stats;
    };

    // Display statistics
    const displayStats = (stats) => {
        if (!stats || stats.count === 0) return;

        statsContainer.innerHTML = `
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Média Download</h5>
                        <h2 class="text-primary">${formatSpeed(stats.avgDownload)} <small class="text-muted">Mbps</small></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Média Upload</h5>
                        <h2 class="text-primary">${formatSpeed(stats.avgUpload)} <small class="text-muted">Mbps</small></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Média Ping</h5>
                        <h2 class="text-primary">${formatSpeed(stats.avgPing)} <small class="text-muted">ms</small></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Melhor Download</h5>
                        <h2 class="text-success">${formatSpeed(stats.maxDownload)} <small class="text-muted">Mbps</small></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Melhor Upload</h5>
                        <h2 class="text-success">${formatSpeed(stats.maxUpload)} <small class="text-muted">Mbps</small></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Menor Ping</h5>
                        <h2 class="text-success">${formatSpeed(stats.minPing)} <small class="text-muted">ms</small></h2>
                    </div>
                </div>
            </div>
        `;
    };

    // Event listeners
    loadBtn.addEventListener('click', loadHistory);
    limitSelect.addEventListener('change', loadHistory);

    // Initial load
    loadHistory();
});
