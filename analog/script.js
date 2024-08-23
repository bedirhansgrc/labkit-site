document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    createChart();

    const autoScaleButton = document.getElementById('autoScale');
    autoScaleButton.addEventListener('click', toggleAutoScale);

    const readAnalogButton = document.getElementById('readAnalog');
    readAnalogButton.addEventListener('click', startReading);

    const stopReadingButton = document.getElementById('stopReading');
    stopReadingButton.addEventListener('click', stopReading);
});

let socket;
let chart;
let isAutoScale = false; 
let readInterval;

function createChart() {
    const ctx = document.getElementById('signalCanvas').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [{
                label: 'Analog Signal',
                data: [], 
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    },
                    min: -5,
                    max: 5
                }
            }
        }
    });
}

function updateChart(data) {
    console.log('Updating chart with data:', data);
    chart.data.labels = data.map((_, index) => index);
    chart.data.datasets[0].data = data;

    if (isAutoScale) {
        const minY = Math.min(...data);
        const maxY = Math.max(...data);
        chart.options.scales.y.min = minY;
        chart.options.scales.y.max = maxY;
    } else {
        chart.options.scales.y.min = -5;
        chart.options.scales.y.max = 5;
    }

    chart.update();
}

function initializeWebSocket() {
    const gatewayIP = localStorage.getItem('gatewayIP');
    if (!gatewayIP) {
        console.error('No gateway IP found in localStorage.');
        return;
    }

    socket = new WebSocket(`ws://${gatewayIP}/ws`);

    socket.onmessage = function(event) {
        if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = function() {
                const arrayBuffer = reader.result;
                console.log('Blob data received:', arrayBuffer);
                const uint16Array = new Uint16Array(arrayBuffer);
                console.log('Uint16Array:', uint16Array);
                updateChart(Array.from(uint16Array));
            };
            reader.readAsArrayBuffer(event.data);
        } else {
            const signalData = JSON.parse(event.data);
            console.log('Received data:', signalData);
            updateChart(signalData);
        }
    };

    socket.onopen = function() {
        console.log('WebSocket connection opened');
    };

    socket.onclose = function() {
        console.log('WebSocket connection closed');
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function toggleAutoScale() {
    isAutoScale = !isAutoScale;
    console.log('Auto Scale:', isAutoScale);
    updateChart(chart.data.datasets[0].data);
}

function startReading() {
    if (readInterval) return; 
    readInterval = setInterval(() => {
        socket.send('read_analog(256)');
    }, 1500);
    document.getElementById('readAnalog').style.display = 'none';
    document.getElementById('stopReading').style.display = 'inline-block';
}

function stopReading() {
    clearInterval(readInterval);
    readInterval = null;
    document.getElementById('readAnalog').style.display = 'inline-block';
    document.getElementById('stopReading').style.display = 'none';
}
