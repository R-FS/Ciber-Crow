const find = require('local-devices');
const https = require('https');
const { performance } = require('perf_hooks');

// Function to test download speed
const testDownloadSpeed = async () => {
    const TEST_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const TEST_URL = `https://speed.cloudflare.com/__down?bytes=${TEST_FILE_SIZE}`;
    const TIMEOUT_MS = 10000; // 10s timeout

    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        let byteCount = 0;
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            req.destroy();
            resolve(0);
        }, TIMEOUT_MS);

        const options = new URL(TEST_URL);
        const req = https.get(options, (res) => {
            res.on('data', (chunk) => {
                if (!timedOut) byteCount += chunk.length;
            });

            res.on('end', () => {
                clearTimeout(timer);
                if (timedOut) return resolve(0);
                
                const duration = (performance.now() - startTime) / 1000; // in seconds
                const mbps = (byteCount * 8) / (1024 * 1024) / duration;
                resolve(Math.max(0, mbps));
            });
        });

        req.on('error', () => {
            clearTimeout(timer);
            resolve(0);
        });
    });
};

// Function to test upload speed (simplified - in real world, you'd need an upload endpoint)
const testUploadSpeed = async () => {
    // For simplicity, we'll assume upload is about 30% of download speed
    // In a real application, you'd implement actual upload test
    const downloadSpeed = await testDownloadSpeed();
    return downloadSpeed * 0.3;
};

// Function to get network speed
const getNetworkSpeed = async (socket) => {
    try {
        console.log('Starting speed test...');
        
        // Run download and upload tests in parallel
        const [downloadMbps, uploadMbps] = await Promise.all([
            testDownloadSpeed(),
            testUploadSpeed()
        ]);

        console.log(`Speed test results - Download: ${downloadMbps.toFixed(2)} Mbps, Upload: ${uploadMbps.toFixed(2)} Mbps`);
        
        // Emit the speed data to the client
        if (socket) {
            socket.emit('network-speed', {
                speed: downloadMbps,
                uploadSpeed: uploadMbps,
                timestamp: new Date().toISOString()
            });
        }

        return { downloadMbps, uploadMbps };
    } catch (error) {
        console.error('Error in getNetworkSpeed:', error);
        
        // Emit error to the client
        if (socket) {
            socket.emit('network-speed', {
                speed: 0,
                uploadSpeed: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        return { downloadMbps: 0, uploadMbps: 0 };
    }
};

// Function to get connected devices
const getConnectedDevices = async (socket) => {
    try {
        const rawDevices = await find();
        console.log('Discovered devices:', rawDevices); // Diagnostic log
        const devices = (rawDevices || []).map((d) => ({ ...d, type: inferDeviceType(d) }));
        socket.emit('network-devices', { devices });

        // Generate and emit topology data
        if (devices && devices.length > 0) {
            const router = findRouter(devices);
            const nodes = [];
            const edges = [];

            // Add router node
            if (router) {
                nodes.push({ id: router.mac, label: `Router (${router.ip})`, x: 0, y: 0, size: 3, color: '#f00' });
            }

            // Add device nodes and edges
            devices.forEach((device, i) => {
                if (!router || device.mac !== router.mac) {
                    const angle = (i / Math.max(1, (devices.length - 1))) * 2 * Math.PI;
                    const type = device.type || 'Device';
                    const color =
                        type === 'Phone' ? '#2ecc71' :
                        type === 'Computer' ? '#3498db' :
                        type === 'TV/Media' ? '#e67e22' :
                        type === 'Printer' ? '#9b59b6' :
                        type === 'IoT' ? '#95a5a6' :
                        '#00f';
                    nodes.push({
                        id: device.mac,
                        label: `${type}: ${(device.name && device.name !== '?') ? device.name : 'Unknown'} (${device.ip})`,
                        x: Math.cos(angle),
                        y: Math.sin(angle),
                        size: 2,
                        color
                    });
                    if (router) {
                        edges.push({ id: `e${i}`, source: router.mac, target: device.mac, color: '#ccc' });
                    }
                }
            });

            socket.emit('network-topology', { nodes, edges });
        }

    } catch (error) {
        console.error('Error getting connected devices:', error.message);
        socket.emit('network-error', { message: 'Failed to get connected devices.' });
    }
};

// Helper to find the router (heuristic)
const findRouter = (devices) => {
    // Common gateway IPs
    const gatewayIPs = ['192.168.1.1', '192.168.0.1', '10.0.0.1'];
    let router = devices.find(d => gatewayIPs.includes(d.ip));
    if (router) return router;

    // Fallback: assume the device with the lowest IP is the router
    if (devices.length > 0) {
        return devices.reduce((prev, curr) => {
            const prevIp = prev.ip.split('.').map(Number);
            const currIp = curr.ip.split('.').map(Number);
            for (let i = 0; i < 4; i++) {
                if (prevIp[i] < currIp[i]) return prev;
                if (currIp[i] < prevIp[i]) return curr;
            }
            return prev;
        });
    }
    return null;
};

// MAC vendor prefixes for device type inference
const MAC_VENDORS = {
    // Phones
    'Apple': ['d0:23:db', 'bc:9f:e4', '90:8d:6c'],
    'Samsung': ['e8:1c:78', 'd0:03:4b', 'bc:a9:20'],
    'Google': ['d8:eb:97', 'bc:3a:ea', '00:1a:11'],
    'OnePlus': ['c8:0c:c8'],
    'Xiaomi': ['6c:40:08', '74:51:8a'],
    // Computers
    'Intel': ['00:16:ea', '00:1e:67'],
    'Dell': ['00:14:22', 'e0:2a:82'],
    'HP': ['00:0b:ca', '3c:d9:2b'],
    'Microsoft': ['00:15:5d'], // Hyper-V, etc.
    // TV/Media
    'Amazon': ['f0:d2:f1', '78:e1:03'], // Fire TV
    'Roku': ['d8:31:34', 'b8:3e:59'],
    // IoT
    'TP-Link': ['b0:95:8e', 'c0:c9:e3'],
    'Tuya': ['10:5a:17', 'c8:2e:47'],
    'Sonoff': ['a4:e5:7c'],
};

// Infer device type using MAC address and name
const inferDeviceType = (device) => {
    if (!device || !device.mac) return 'Device';

    const macPrefix = device.mac.toLowerCase().slice(0, 8);

    for (const vendor in MAC_VENDORS) {
        if (MAC_VENDORS[vendor].some(prefix => macPrefix.startsWith(prefix))) {
            if (['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'].includes(vendor)) return 'Phone';
            if (['Intel', 'Dell', 'HP', 'Microsoft'].includes(vendor)) return 'Computer';
            if (['Amazon', 'Roku'].includes(vendor)) return 'TV/Media';
            if (['TP-Link', 'Tuya', 'Sonoff'].includes(vendor)) return 'IoT';
            return vendor; // Fallback to vendor name
        }
    }

    const name = (device.name || '').toLowerCase();
    if (name.includes('iphone') || name.includes('android') || name.includes('pixel')) return 'Phone';
    if (name.includes('laptop') || name.includes('desktop') || name.includes('pc') || name.includes('macbook')) return 'Computer';
    if (name.includes('tv') || name.includes('chromecast')) return 'TV/Media';
    if (name.includes('printer')) return 'Printer';

    return 'Device';
};

// Main handler for socket connections
// Variável para controlar se um teste já está em andamento
let isSpeedTestRunning = false;

const handleConnection = (socket) => {
    console.log('A user connected to network monitoring.');

    // Função para executar o teste de velocidade com proteção
    const runSpeedTest = async () => {
        if (isSpeedTestRunning) {
            console.log('Speed test already in progress, skipping...');
            return;
        }
        
        isSpeedTestRunning = true;
        try {
            await getNetworkSpeed(socket);
        } catch (error) {
            console.error('Error in speed test:', error);
        } finally {
            isSpeedTestRunning = false;
        }
    };

    // Initial data fetch
    runSpeedTest();
    getConnectedDevices(socket);

    // Set up periodic updates - Agora a cada segundo
    const speedInterval = setInterval(runSpeedTest, 1000); // every 1 second
    const devicesInterval = setInterval(() => getConnectedDevices(socket), 5000); // every 5 seconds

    socket.on('disconnect', () => {
        console.log('User disconnected from network monitoring.');
        clearInterval(speedInterval);
        clearInterval(devicesInterval);
    });
};

module.exports = {
    handleConnection
};
