document.addEventListener('DOMContentLoaded', function () {
    const socket = io(`${window.location.origin}/network-monitoring`, {
        transports: ['websocket', 'polling']
    });

    const speedDisplay = document.getElementById('speed-display');
    const deviceCount = document.getElementById('device-count');
    const deviceList = document.getElementById('device-list');
    const sigmaContainer = document.getElementById('sigma-container');
    let sigmaInstance = null;

    // Handle network speed updates
    socket.on('network-speed', (data) => {
        if (speedDisplay && data.speed) {
            speedDisplay.textContent = `${data.speed.toFixed(2)} Mbps`;
        }
    });

    // Handle connected devices updates
    socket.on('network-devices', (data) => {
        if (deviceCount && data.devices) {
            deviceCount.textContent = data.devices.length;
        }
        if (deviceList && data.devices) {
            deviceList.innerHTML = ''; // Clear previous list
            const table = document.createElement('table');
            table.className = 'devices-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>IP Address</th>
                        <th>MAC Address</th>
                        <th>Name</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            const tbody = table.querySelector('tbody');
            data.devices.forEach(device => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${device.ip}</td>
                    <td>${device.mac}</td>
                    <td>${(device.name && device.name !== '?') ? device.name : 'Unknown'} (${device.ip})</td>
                    <td>${device.type || 'Device'}</td>
                `;
                tbody.appendChild(row);
            });
            deviceList.appendChild(table);
        }
    });

    // Handle network topology updates
    socket.on('network-topology', (data) => {
        if (sigmaContainer && data.nodes && data.edges) {
            // Clear any existing instance
            if (sigmaInstance) {
                sigmaInstance.graph.clear();
                sigmaInstance.kill();
                sigmaInstance = null;
            }
            
            // Create a new Sigma instance
            sigmaInstance = new sigma({
                graph: data,
                renderer: {
                    container: sigmaContainer,
                    type: 'canvas'
                },
                settings: {
                    minNodeSize: 2,
                    maxNodeSize: 10,
                    minEdgeSize: 0.1,
                    maxEdgeSize: 2,
                    defaultNodeColor: '#00f',
                    defaultEdgeColor: '#ccc',
                    edgeColor: 'default',
                    labelThreshold: 0,
                    defaultLabelColor: '#fff',
                    defaultLabelSize: 12
                }
            });
        }
    });

    // Handle errors
    socket.on('network-error', (error) => {
        console.error('Network monitoring error:', error.message);
        // Optionally display this error to the user in the UI
    });

    // Handle connection events
    socket.on('connect', () => {
        console.log('Connected to network monitoring service.');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from network monitoring service.');
    });
});
