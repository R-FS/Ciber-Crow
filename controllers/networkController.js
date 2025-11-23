const find = require('local-devices');
const https = require('https');
const { performance } = require('perf_hooks');

// Function to get network speed
const getNetworkSpeed = async (socket) => {
    try {
        const TEST_URL = 'https://speed.cloudflare.com/__down?bytes=10000000'; // 10MB
        const TIMEOUT_MS = 10000; // 10s

        const downloadMbps = await new Promise((resolve, reject) => {
            const startTime = performance.now();
            let byteCount = 0;

            const options = {
                hostname: 'speed.cloudflare.com',
                path: '/__down?bytes=10000000',
                method: 'GET',
                rejectUnauthorized: false // Ignore certificate errors
            };

            const req = https.request(options, (res) => {
                res.on('data', (chunk) => {
                    byteCount += chunk.length;
                });

                res.on('end', () => {
                    const duration = (performance.now() - startTime) / 1000;
                    if (duration === 0 || byteCount === 0) return resolve('0.00');
                    const mbps = (byteCount * 8) / (1024 * 1024) / duration;
                    resolve(mbps.toFixed(2));
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Speed test request failed: ${err.message}`));
            });

            req.setTimeout(TIMEOUT_MS, () => {
                req.destroy(new Error('Speed test timed out'));
            });

            req.end();
        });

        socket.emit('network-speed', { speed: parseFloat(downloadMbps) });
    } catch (error) {
        console.error('Detailed speed test error:', error.message);
        socket.emit('network-error', { message: 'Failed to get network speed.' });
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
const handleConnection = (socket) => {
    console.log('A user connected to network monitoring.');

    // Initial data fetch
    getNetworkSpeed(socket);
    getConnectedDevices(socket);

    // Set up periodic updates
    const speedInterval = setInterval(() => getNetworkSpeed(socket), 10000); // every 10 seconds
    const devicesInterval = setInterval(() => getConnectedDevices(socket), 20000); // every 20 seconds

    socket.on('disconnect', () => {
        console.log('User disconnected from network monitoring.');
        clearInterval(speedInterval);
        clearInterval(devicesInterval);
    });
};

module.exports = {
    handleConnection
};
