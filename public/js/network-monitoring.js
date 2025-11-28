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
        
        // Initialize with some default data points to make lines visible
        const initialData = Array(maxDataPoints).fill(0);
        
        speedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(maxDataPoints).fill(''),
                datasets: [
                    {
                        label: 'Download',
                        data: [...initialData],
                        borderColor: '#3b82f6', // Blue
                        borderWidth: 2,
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3
                    },
                    {
                        label: 'Upload',
                        data: [...initialData],
                        borderColor: '#ef4444', // Red
                        borderWidth: 2,
                        tension: 0.1,
                        fill: false,
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
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.parsed.y.toFixed(2) + ' Mbps';
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                elements: {
                    line: {
                        borderWidth: 1.5,
                        tension: 0.6,  // Aumentado para mais suavidade
                        borderJoinStyle: 'round',
                        borderCapStyle: 'round',
                        cubicInterpolationMode: 'monotone'  // Melhor interpolação para dados de série temporal
                    },
                    point: {
                        radius: 0,
                        hitRadius: 10,  // Área maior para interação
                        hoverRadius: 3  // Tamanho ao passar o mouse
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                layout: {
                    padding: 0
                },
                plugins: {
                    legend: false
                }
            }
        });
    }

    // Update the speed chart with new data
    function updateSpeedChart(download, upload) {
        try {
            // Ensure we have valid numbers
            const downloadValue = Number.isFinite(download) ? download : 0;
            const uploadValue = Number.isFinite(upload) ? upload : 0;
            
            // Shift existing data
            speedData.download.shift();
            speedData.upload.shift();
            
            // Add new data
            speedData.download.push(downloadValue);
            speedData.upload.push(uploadValue);
            
            // Update chart if it exists
            if (speedChart) {
                // Update the datasets with new data
                speedChart.data.datasets[0].data = [...speedData.download];
                speedChart.data.datasets[1].data = [...speedData.upload];
                
                // Calculate max value for Y-axis scaling
                const allValues = [...speedData.download, ...speedData.upload].filter(Number.isFinite);
                const maxValue = allValues.length > 0 ? Math.max(...allValues) : 10;
                
                // Set Y-axis max with some padding (minimum 10 Mbps)
                const maxY = Math.max(Math.ceil(maxValue * 1.2 / 10) * 10, 10);
                
                // Update chart options
                speedChart.options.scales.y.max = maxY;
                speedChart.options.scales.y.min = 0;
                
                // Force update the chart
                speedChart.update({
                    duration: 500,
                    easing: 'easeOutQuart',
                    lazy: false
                });
                
                console.log('Chart updated with:', { download: downloadValue, upload: uploadValue });
            }
        } catch (error) {
            console.error('Error updating speed chart:', error);
        }
    }

    // Initialize the chart when the page loads
    initSpeedChart();

    // Handle network speed updates
    socket.on('network-speed', (data) => {
        console.log('Received speed data:', data);
        
        if (data.error) {
            console.error('Speed test error:', data.error);
            return;
        }

        if (speedDisplay) {
            const speed = parseFloat(data.speed || 0);
            speedDisplay.textContent = `${speed.toFixed(2)} Mbps`;
            
            // Update the chart with new speed data
            const downloadSpeed = speed;
            const uploadSpeed = data.uploadSpeed ? parseFloat(data.uploadSpeed) : (speed * 0.3);
            
            updateSpeedChart(downloadSpeed, uploadSpeed);
        }
    });

    // Handle network errors
    socket.on('network-error', (error) => {
        console.error('Network monitoring error:', error.message);
        // You could show an error message to the user here if desired
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
