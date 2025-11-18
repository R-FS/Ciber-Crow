const { query, run } = require('../db/database');

// Save speed test result
const saveTestResult = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            downloadSpeed,
            uploadSpeed,
            ping,
            jitter,
            serverName,
            serverLocation,
            ipAddress,
            isp
        } = req.body;

        // Validate required fields
        if (downloadSpeed === undefined || uploadSpeed === undefined || ping === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Convert from bps to Mbps (1 Mbps = 1,000,000 bps)
        const downloadSpeedMbps = downloadSpeed / 1000000;
        const uploadSpeedMbps = uploadSpeed / 1000000;

        // Insert the test result
        const result = await run(
            `INSERT INTO speed_tests 
             (user_id, download_speed, upload_speed, ping, jitter, server_name, server_location, ip_address, isp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, 
                downloadSpeedMbps.toFixed(2), 
                uploadSpeedMbps.toFixed(2), 
                ping, 
                jitter || null, 
                serverName || null, 
                serverLocation || null, 
                ipAddress || null, 
                isp || null
            ]
        );

        res.status(201).json({
            success: true,
            testId: result.lastID
        });

    } catch (error) {
        console.error('Error saving speed test result:', error);
        res.status(500).json({ error: 'Failed to save test result' });
    }
};

// Get user's test history
const getTestHistory = async (req, res) => {
    console.log('Fetching test history for user:', req.user);
    
    if (!req.user || !req.user.id) {
        console.error('No user ID found in request');
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10; // Default to 10 results
    
    try {
        console.log(`Fetching up to ${limit} test results for user ${userId}`);
        
        // First, verify the user exists
        const userCheck = await query('SELECT id FROM users WHERE id = ?', [userId]);
        if (userCheck.length === 0) {
            console.error(`User with ID ${userId} not found`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Build the query
        let queryStr = `
            SELECT 
                id, 
                download_speed as downloadSpeed, 
                upload_speed as uploadSpeed, 
                ping, 
                jitter, 
                server_name as serverName, 
                server_location as serverLocation, 
                test_date as testDate
            FROM speed_tests 
            WHERE user_id = ? 
            ORDER BY test_date DESC`;
            
        const params = [userId];
        
        // Add LIMIT if specified
        if (limit > 0) {
            queryStr += ' LIMIT ?';
            params.push(limit);
        }
        
        console.log('Executing query:', queryStr, 'with params:', params);
        
        const tests = await query(queryStr, params);
        console.log(`Found ${tests.length} test results`);
        
        // Format dates to ISO string for consistency
        const formattedTests = tests.map(test => ({
            ...test,
            testDate: test.testDate ? new Date(test.testDate).toISOString() : null
        }));

        return res.json(formattedTests);

    } catch (error) {
        console.error('Error fetching test history:', {
            message: error.message,
            stack: error.stack,
            userId,
            limit
        });
        
        res.status(500).json({ 
            error: 'Falha ao carregar o histórico de testes',
            ...(process.env.NODE_ENV === 'development' && { 
                details: error.message,
                stack: error.stack
            })
        });
    }
};

// Get test statistics
const getTestStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30; // Default to last 30 days

        const [stats] = await query(
            `SELECT 
                COUNT(*) as totalTests,
                AVG(download_speed) as avgDownload,
                AVG(upload_speed) as avgUpload,
                AVG(ping) as avgPing,
                AVG(jitter) as avgJitter,
                MAX(download_speed) as maxDownload,
                MAX(upload_speed) as maxUpload,
                MIN(ping) as minPing
             FROM speed_tests 
             WHERE user_id = ? 
             AND test_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [userId, days]
        );

        // Format numbers to 2 decimal places
        const formatNumber = num => num ? Number(num).toFixed(2) : null;
        
        const formattedStats = {
            totalTests: stats.totalTests,
            avgDownload: formatNumber(stats.avgDownload),
            avgUpload: formatNumber(stats.avgUpload),
            avgPing: formatNumber(stats.avgPing),
            avgJitter: formatNumber(stats.avgJitter),
            maxDownload: formatNumber(stats.maxDownload),
            maxUpload: formatNumber(stats.maxUpload),
            minPing: formatNumber(stats.minPing)
        };

        res.json(formattedStats);

    } catch (error) {
        console.error('Error fetching test statistics:', error);
        res.status(500).json({ error: 'Failed to fetch test statistics' });
    }
};

module.exports = {
    saveTestResult,
    getTestHistory,
    getTestStats
};
