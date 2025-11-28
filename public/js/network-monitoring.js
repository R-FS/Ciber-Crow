document.addEventListener('DOMContentLoaded', function () {
    const socket = io(`${window.location.origin}/network-monitoring`, {
        transports: ['websocket', 'polling']
    });

    const speedDisplay = document.getElementById('speed-display');
    const deviceCount = document.getElementById('device-count');
    const deviceList = document.getElementById('device-list');
    const sigmaContainer = document.getElementById('sigma-container');
    let sigmaInstance = null;

    // Speed chart variables
    let speedChart;
    const maxDataPoints = 10;
    const speedData = {
        labels: Array(maxDataPoints).fill(''),
        download: Array(maxDataPoints).fill(null),
        upload: Array(maxDataPoints).fill(null)
    };

    // Initialize the speed chart
    function initSpeedChart() {
        const ctx = document.getElementById('speedChart').getContext('2d');
        
        speedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: speedData.labels,
                datasets: [
                    {
                        label: 'Download',
                        data: speedData.download,
                        borderColor: '#3b82f6', // Blue
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 3
                    },
                    {
                        label: 'Upload',
                        data: speedData.upload,
                        borderColor: '#ef4444', // Red
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw?.toFixed(2) || '0.00'} Mbps`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: function(value) {
                                return value > 0 ? value + ' Mbps' : '';
                            }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Update the speed chart with new data
    function updateSpeedChart(download, upload) {
        // Shift existing data
        speedData.download.shift();
        speedData.upload.shift();
        
        // Add new data
        speedData.download.push(download);
        speedData.upload.push(upload);
        
        // Update chart
        if (speedChart) {
            speedChart.data.datasets[0].data = speedData.download;
            speedChart.data.datasets[1].data = speedData.upload;
            speedChart.update('none');
        }
    }

    // Initialize the chart when the page loads
    initSpeedChart();

    // Handle network speed updates
    socket.on('network-speed', (data) => {
        if (speedDisplay && data.speed) {
            speedDisplay.textContent = `${data.speed.toFixed(2)} Mbps`;
            
            // Update the chart with new speed data
            // If upload speed is not provided, use 30% of download speed as a fallback
            const downloadSpeed = parseFloat(data.speed);
            const uploadSpeed = data.uploadSpeed || (data.speed * 0.3);
            
            updateSpeedChart(downloadSpeed, uploadSpeed);
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
