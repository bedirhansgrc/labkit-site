let socket;
let selectionAllowed = false;
const indexLabels = {};
let lineLength = 0; // Start line length counter
let isReadingData = true;
let bitCounter = 0;
let isDataMarkerEnabled = true;
let isStopDetected = false;

// New: State buffer for improved START condition detection
const stateBuffer = { scl: [], sda: [] };
const BUFFER_SIZE = 10;
let sclState = '';
let sdaState = '';

document.addEventListener('DOMContentLoaded', () => {
    const gatewayIP = localStorage.getItem('gatewayIP');
    if (!gatewayIP) {
        console.error('No gateway IP found in localStorage.');
        return;
    }

    socket = new WebSocket(`ws://${gatewayIP}/ws`);
    const waveformBoxes = document.querySelectorAll('.waveform-box');
    const waveformDisplayContainer = document.getElementById('waveformDisplayContainer');

    socket.onopen = () => {
        console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const parsedMessage = parseMessage(data.message);
        if (!parsedMessage) {
            console.error('Failed to parse message');
            return;
        }

        const displayContent = parsedMessage.content;
        updateWaveformDisplay(parsedMessage.socketid, displayContent);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    waveformBoxes.forEach(box => {
        const indexLabel = box.querySelector('.index-label');
        const socketId = box.getAttribute('socketid');
        if (indexLabels[socketId]) {
            indexLabel.innerText = indexLabels[socketId];
        }
        indexLabel.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = indexLabel.innerText;
            input.classList.add('index-input');

            input.addEventListener('blur', () => {
                indexLabel.innerText = input.value;
                indexLabels[socketId] = input.value;
                indexLabel.style.display = 'block';
                input.remove();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });

            indexLabel.style.display = 'none';
            box.appendChild(input);
            input.focus();
        });
    });

    document.getElementById('startEmulatorButton').addEventListener('click', startEmulator);
    document.getElementById('stopEmulatorButton').addEventListener('click', stopEmulator);
    document.getElementById('sendEmulatorMessagesButton').addEventListener('click', sendEmulatorMessages);

    
    function checkI2CConditions(sdaBox, sclBox) {
        let startDetected = false;
        let stopDetected = false;
        let lookingForStart = true;
        let position = 0;
    
        while (position < Math.min(sclState.length, sdaState.length)) {
            if (lookingForStart) {
                if (sclState[position] === '1' && sclState[position - 1] === '1' &&
                    sdaState[position] === '0' && sdaState[position - 1] === '1') {
                    console.log('START condition detected:', position);
                    createStartMarker(sdaBox, sclBox, position);
                    startDetected = true;
                    isStopDetected = false; // Reset the STOP detected flag
                    lookingForStart = false;
                    isReadingData = true;
                    bitCounter = 0;
                    isDataMarkerEnabled = true;
                    position += 1;
                    continue;
                }
            }
    
            if (!lookingForStart && isReadingData) {
                bitCounter++;
    
                // Handle data bits and ACK/NACK bit after 8 data bits
                if (bitCounter === 9) {
                    if (position + 8 >= sdaState.length) {
                        console.warn(`Unexpected bit length at position ${position}: Not enough bits to process a full byte + ACK/NACK`);
                        break;
                    }
    
                    // Process 8 bits of data
                    const dataBits = sdaState.slice(position - 8, position);
                    const dataValue = parseInt(dataBits, 2).toString(16).toUpperCase();
                    createDataMarkers(position - 8, position * 20, sdaBox, dataValue);
    
                    // Process 9th bit as ACK/NACK
                    const ackNackBit = sdaState[position];
                    createAckNackMarker(ackNackBit, position * 20 + 160); // Adjust position accordingly
    
                    bitCounter = 0; // Reset counter for next byte
                }
    
                // STOP condition check
                if (sclState[position] === '1' && sclState[position - 1] === '1' &&
                    sdaState[position] === '1' && sdaState[position - 1] === '0') {
                    console.log('STOP condition detected:', position);
                    createStopMarker(sdaBox, sclBox, position + 1);
                    stopDetected = true;
                    isStopDetected = true;
                    isReadingData = false;
                    lookingForStart = true; // Reset to look for a new START condition
                    position += 1;
                    continue;
                }
                
            }
    
            position += 1;
        }
        return { startDetected, stopDetected };
    }

    function createDataMarkers(startBitIndex, startPosition, container) {
        const remainingBits = sdaState.length - startBitIndex;
        
        // Check if there are fewer than 9 bits remaining (8 data bits + 1 ACK/NACK)
        if (remainingBits < 9) {
            console.warn(`Unexpected bit length at position ${startBitIndex}: Not enough bits to process a full byte + ACK/NACK`);
            
            // Check for a STOP condition at the current position
            if (checkStopCondition(startBitIndex)) {
                console.log('STOP condition detected at unexpected bit length:', startBitIndex);
                createStopMarker(container, container, startBitIndex + 1);
                isStopDetected = true;
                return;
            }
            
            return; // If no STOP condition is found, just return (no further processing)
        }
    
        const dataBits = sdaState.slice(startBitIndex, startBitIndex + 8);
        const dataValue = parseInt(dataBits, 2).toString(16).toUpperCase().padStart(2, '0');
        const dataBox = document.createElement('div');
        dataBox.classList.add('data-box');
        dataBox.innerText = `Data: 0x${dataValue}`;
        dataBox.style.position = 'absolute';
        dataBox.style.left = `${startPosition}px`;
        dataBox.style.top = '50%';
        dataBox.style.transform = 'translateY(-50%)';
        container.appendChild(dataBox);
    
        // Read ACK/NACK bit
        const ackNackBit = sdaState[startBitIndex + 8];
        const ackNackMarker = createAckNackMarker(ackNackBit, startPosition + dataBox.offsetWidth);
        container.appendChild(ackNackMarker);
    
        // Check for STOP condition after ACK/NACK bit
        if (checkStopCondition(startBitIndex + 9)) {
            console.log('STOP condition detected after ACK/NACK bit:', startBitIndex + 9);
            createStopMarker(container, container, startBitIndex + 10);
            isStopDetected = true;
            return;
        }
    
        // Continue reading next byte, update start position for the next data
        const nextStartBitIndex = startBitIndex + 9; // Move to the next byte start bit
        const nextStartPosition = startPosition + dataBox.offsetWidth + ackNackMarker.offsetWidth;
    
        // Only recursively call if STOP condition has not been detected
        if (!isStopDetected && nextStartBitIndex < sdaState.length) {
            createDataMarkers(nextStartBitIndex, nextStartPosition, container); // Recursively call for next data byte
        }
    }
    
    

    
    function checkStopCondition(index) {
        return (sclState[index] === '1' && sclState[index - 1] === '1' &&
                sdaState[index] === '1' && sdaState[index - 1] === '0');
    }
    
    function createStopMarker(sdaBox, sclBox, position) {
        const addressesContainer = document.querySelector('.addresses-container');
        
        if (!addressesContainer) {
            console.warn('No addresses container found');
            return;
        }
        
        const bitWidth = 20; 
        const stopPosition = position * bitWidth;
        const adjustedStopPosition = stopPosition + 120; // Include padding-left
    
        // "P" for Stop
        const pMarker = document.createElement('div');
        pMarker.innerText = 'P';
        pMarker.style.position = 'absolute';
        pMarker.style.width = '16px';
        pMarker.style.height = '20px';
        pMarker.style.border = '2px solid black';
        pMarker.style.borderRadius = '50%';
        pMarker.style.textAlign = 'center';
        pMarker.style.lineHeight = '20px';
        pMarker.style.backgroundColor = 'red';
        pMarker.style.color = 'white';
        pMarker.style.left = `${adjustedStopPosition - 20}px`;
        pMarker.style.top = '50%';
        pMarker.style.transform = 'translateY(-50%)';
        
        addressesContainer.appendChild(pMarker);
    }
    
    
    function createIdleLine(container, startPosition) {
        const idleLine = document.createElement('div');
        idleLine.classList.add('idle-line');
        idleLine.style.left = `${startPosition}px`;
        idleLine.style.width = `${container.offsetWidth - startPosition}px`;
        
        const idleText = document.createElement('div');
        idleText.classList.add('idle-text');
        idleText.innerText = 'IDLE';
        idleText.style.left = `${startPosition + 10}px`;
        
        container.appendChild(idleLine);
        container.appendChild(idleText);
    }

    function parseMessage(message) {
        const commaIndex = message.indexOf(',');
        if (commaIndex !== -1 && message.startsWith('[') && message.endsWith(']')) {
            const socketid = message.slice(1, commaIndex);
            const content = message.slice(commaIndex + 1, -1);
            return { socketid, content };
        }
        return null;
    }

    function updateWaveformDisplay(socketid, newMessage) {
        if (document.getElementById('selectedOptionText').textContent !== 'I2C Debugger') {
            return;
        }

        const sclBox = Array.from(document.querySelectorAll('.waveform-box')).find(box => box.querySelector('.index-label').innerText === 'SCL');
        const sdaBox = Array.from(document.querySelectorAll('.waveform-box')).find(box => box.querySelector('.index-label').innerText === 'SDA');

        if (!sclBox || !sdaBox) {
            return;
        }

        const sclSocketId = sclBox.getAttribute('socketid');
        const sdaSocketId = sdaBox.getAttribute('socketid');

        if (socketid !== sclSocketId && socketid !== sdaSocketId) {
            return;
        }

        // Update state and check for START condition
        if (socketid === sclSocketId) {
            sclState = newMessage;
        } else if (socketid === sdaSocketId) {
            sdaState = newMessage;
        }

        if (sclState && sdaState) {
            const { startDetected, stopDetected } = checkI2CConditions(sdaBox, sclBox);
            
            if (stopDetected) {
                // Clear existing content after STOP
                const addressesContainer = document.querySelector('.addresses-container');
                if (addressesContainer) {
                    const stopMarker = addressesContainer.querySelector('div[innerText="P"]');
                    if (stopMarker) {
                        const stopPosition = parseInt(stopMarker.style.left) + 20;
                        Array.from(addressesContainer.children).forEach(child => {
                            if (parseInt(child.style.left) > stopPosition) {
                                child.remove();
                            }
                        });
                        createIdleLine(addressesContainer, stopPosition);
                    }
                }
            }
        }

        lineLength = sclBox.scrollWidth;

        const targetBox = Array.from(document.querySelectorAll('.waveform-box')).find(box => box.getAttribute('socketid') === socketid);
        if (!targetBox) {
            console.warn(`No waveform box found for socketid ${socketid}`);
            return;
        }

        const displayLabel = indexLabels[socketid] || socketid;
        targetBox.innerHTML = `<div class="index-label">${displayLabel}</div>`;

        const fragmentSDA = document.createDocumentFragment();
        const fragmentHex = document.createDocumentFragment();

        let previousBit = null;
        for (let i = 0; i < newMessage.length; i++) {
            const bit = newMessage[i];

            const bitContainer = document.createElement('div');
            bitContainer.style.display = 'inline-block';
            bitContainer.style.position = 'relative';
            bitContainer.style.height = '70px';
            bitContainer.style.width = '20px';

            const verticalLine = document.createElement('div');
            verticalLine.style.position = 'absolute';
            verticalLine.style.width = '2px';
            verticalLine.style.backgroundColor = 'grey';

            const horizontalLine = document.createElement('div');
            horizontalLine.style.position = 'absolute';
            horizontalLine.style.height = '2px';
            horizontalLine.style.width = '100%';

            if (bit === '0') {
                horizontalLine.style.bottom = '20px';
                horizontalLine.style.backgroundColor = 'red';
                if (previousBit === '1') {
                    verticalLine.style.top = '0';
                    verticalLine.style.height = 'calc(100% - 20px)';
                } else {
                    verticalLine.style.display = 'none';
                }
            } else if (bit === '1') {
                horizontalLine.style.top = '0';
                horizontalLine.style.backgroundColor = 'green';
                if (previousBit === '0') {
                    verticalLine.style.bottom = '20px';
                    verticalLine.style.height = 'calc(100% - 20px)';
                } else {
                    verticalLine.style.display = 'none';
                }
            }

            const bitLabel = document.createElement('div');
            bitLabel.style.position = 'absolute';
            bitLabel.style.bottom = '0';
            bitLabel.style.width = '100%';
            bitLabel.style.textAlign = 'center';
            bitLabel.innerText = bit;

            bitContainer.appendChild(verticalLine);
            bitContainer.appendChild(horizontalLine);
            bitContainer.appendChild(bitLabel);

            fragmentSDA.appendChild(bitContainer);

            if ((i + 1) % 8 === 0) {
                const byte = newMessage.slice(i - 7, i + 1);
                const hexValue = parseInt(byte, 2).toString(16).toUpperCase();
                const hexContainer = document.createElement('div');
                hexContainer.classList.add('hex-box');
                hexContainer.innerText = hexValue;
                fragmentHex.appendChild(hexContainer);
            }

            previousBit = bit;
        }

        const sdaWaveform = document.createElement('div');
        sdaWaveform.classList.add('waveform-row');
        sdaWaveform.innerHTML = '<div class="waveform-label"></div>';
        sdaWaveform.appendChild(fragmentSDA);
        targetBox.appendChild(sdaWaveform);

        const hexWaveform = document.createElement('div');
        hexWaveform.classList.add('waveform-row');
        hexWaveform.innerHTML = '<div class="waveform-label">Hex:</div>';
        hexWaveform.appendChild(fragmentHex);
        targetBox.appendChild(hexWaveform);
    }

    function sendEmulatorMessages() {
        const message0 = '[0,1110101010101010101010101010101010101010101010111111111111101010101010101011111]';
        const message1 = '[1,1101010101010111010101010010101110101110001111011111111111011010111101100100111]';

        simulateWebSocketMessage(message0);
        simulateWebSocketMessage(message1);

        console.log('Simulated messages:', message0, message1);
    }

    function simulateWebSocketMessage(message) {
        const event = new MessageEvent('message', {
            data: JSON.stringify({ message: message })
        });
        socket.dispatchEvent(event);
    }

    function generateEmulatorData() {
        const socketid = Math.floor(Math.random() * 8).toString();
        const content = Array.from({ length: 16 }, () => Math.floor(Math.random() * 2)).join('');
        return JSON.stringify({ message: `[${socketid},${content}]` });
    }

    let emulatorInterval = null;
    function startEmulator() {
        if (!emulatorInterval) {
            emulatorInterval = setInterval(() => {
                const message = generateEmulatorData();
                const event = new MessageEvent('message', { data: message });
                socket.dispatchEvent(event);
            }, 1000);
        }
    }

    function stopEmulator() {
        if (emulatorInterval) {
            clearInterval(emulatorInterval);
            emulatorInterval = null;
        }
    }

    const dropdownButton = document.getElementById('dropdownButton');
    const dropdownContent = document.getElementById('dropdownContent');
    const i2cDebuggerOption = document.getElementById('i2cDebuggerOption');
    const selectWaveformButton = document.getElementById('selectWaveformButton');
    const selectionInstructions = document.getElementById('selectionInstructions');
    const selectedOptionText = document.getElementById('selectedOptionText');

    let selectedBoxes = [];

    waveformBoxes.forEach(box => {
        box.classList.add('disabled');
    });

    dropdownButton.addEventListener('click', () => {
        dropdownContent.classList.toggle('show');
    });

    i2cDebuggerOption.addEventListener('click', () => {
        console.log('I2C Debugger option selected');
        selectedOptionText.textContent = "I2C Debugger";
        selectionInstructions.style.display = 'block';
        selectWaveformButton.style.display = 'block';

        selectedBoxes = [];
        waveformBoxes.forEach(box => {
            box.classList.remove('disabled', 'selected');
            const labelTag = box.querySelector('.label-tag');
            if (labelTag) {
                box.removeChild(labelTag);
            }

            const originalLabel = box.getAttribute('socketid');
            const indexLabel = box.querySelector('.index-label');
            if (indexLabel) {
                indexLabel.innerText = indexLabels[originalLabel] || originalLabel;
            }

            setupLabelEditing(box);
        });

        selectionAllowed = true;
        dropdownContent.classList.remove('show');

        createAddressesBox();
    });

    function createAddressesBox() {
        if (document.querySelector('.addresses-container')) return;

        const addressesBox = document.createElement('div');
        addressesBox.classList.add('addresses-container');

        waveformDisplayContainer.insertAdjacentElement('afterbegin', addressesBox);
    }

    function createStartMarker(sdaBox, sclBox, position) {
        const addressesContainer = document.querySelector('.addresses-container');
        
        if (!addressesContainer) {
            console.warn('No addresses container found');
            return;
        }
        
        const bitWidth = 20; 
        const startPosition = position * bitWidth;
        const adjustedStartPosition = startPosition + 120; // Include padding-left
    
        // Clear all elements after the last STOP condition
        const stopMarkers = addressesContainer.querySelectorAll('div[innerText="P"]');
        let lastStopPosition = 120; // Default to start of container
        if (stopMarkers.length > 0) {
            const lastStopMarker = stopMarkers[stopMarkers.length - 1];
            lastStopPosition = parseInt(lastStopMarker.style.left) + lastStopMarker.offsetWidth;
            
            // Remove all elements after the last STOP marker
            Array.from(addressesContainer.children).forEach(child => {
                if (parseInt(child.style.left) > lastStopPosition) {
                    child.remove();
                }
            });
        }
    
        // Create or update the grey line
        let greyLine = addressesContainer.querySelector('.grey-line');
        if (!greyLine) {
            greyLine = document.createElement('div');
            greyLine.classList.add('grey-line');
            greyLine.style.position = 'absolute';
            greyLine.style.height = '2px';
            greyLine.style.backgroundColor = 'grey';
            greyLine.style.top = '50%';
            greyLine.style.left = '120px';
            addressesContainer.appendChild(greyLine);
        }
        greyLine.style.width = `${adjustedStartPosition - 120}px`;
    
        // "S" for Start
        const sMarker = document.createElement('div');
        sMarker.innerText = 'S';
        sMarker.style.position = 'absolute';
        sMarker.style.width = '16px';
        sMarker.style.height = '20px';
        sMarker.style.border = '2px solid black';
        sMarker.style.borderRadius = '50%';
        sMarker.style.textAlign = 'center';
        sMarker.style.lineHeight = '20px';
        sMarker.style.backgroundColor = 'white';
        sMarker.style.left = `${adjustedStartPosition - 20}px`;
        sMarker.style.top = '50%';
        sMarker.style.transform = 'translateY(-50%)';
        
        addressesContainer.appendChild(sMarker);
        
        const addressBits = sdaState.slice(position , position + 7);
        const addressHex = convertTo8BitAddress(addressBits);
        
        // Address box
        const addressBox = document.createElement('div');
        addressBox.classList.add('hex-box');
        addressBox.innerText = `Address: ${addressHex}`;
        addressBox.style.position = 'absolute';
        addressBox.style.left = `${adjustedStartPosition}px`;
        addressBox.style.top = '50%';
        addressBox.style.transform = 'translateY(-50%)';
        
        addressesContainer.appendChild(addressBox);
    
        // RW marker
        const rwBit = sdaState[position + 7]; 
        const rwMarker = createRWMarker(rwBit, adjustedStartPosition + addressBox.offsetWidth);
        addressesContainer.appendChild(rwMarker);
    
        // ACK/NACK marker
        const ackNackBit = sdaState[position + 8];
        const ackNackMarker = createAckNackMarker(ackNackBit, rwMarker.offsetLeft + rwMarker.offsetWidth);
        addressesContainer.appendChild(ackNackMarker);
    
        // Data markers
        const dataStartPosition = ackNackMarker.offsetLeft + ackNackMarker.offsetWidth;
        createDataMarkers(position + 9, dataStartPosition, addressesContainer);
        
        addressesContainer.style.width = `${Math.max(sclBox.scrollWidth, adjustedStartPosition + 500)}px`;
    }
    
    
    function createRWMarker(rwBit, position) {
        const rwMarker = document.createElement('div');
        rwMarker.innerText = rwBit === '1' ? 'R' : 'W';
        rwMarker.style.position = 'absolute';
        rwMarker.style.width = '16px';
        rwMarker.style.height = '20px';
        rwMarker.style.border = '2px solid black';
        rwMarker.style.borderRadius = '50%';
        rwMarker.style.textAlign = 'center';
        rwMarker.style.lineHeight = '20px';
        rwMarker.style.backgroundColor = rwBit === '0' ? '#ffcccb' : '#add8e6';
        rwMarker.style.left = `${position}px`;
        rwMarker.style.top = '50%';
        rwMarker.style.transform = 'translateY(-50%)';
    
        return rwMarker;
    }
    
    function createAckNackMarker(ackNackBit, position) {
        const ackNackMarker = document.createElement('div');
        ackNackMarker.innerText = ackNackBit === '1' ? 'N' : 'A';
        ackNackMarker.style.position = 'absolute';
        ackNackMarker.style.width = '16px';
        ackNackMarker.style.height = '20px';
        ackNackMarker.style.border = '2px solid black';
        ackNackMarker.style.borderRadius = '50%';
        ackNackMarker.style.textAlign = 'center';
        ackNackMarker.style.lineHeight = '20px';
        ackNackMarker.style.backgroundColor = ackNackBit === '1' ? '#FF4500' : '#90EE90'; 
        ackNackMarker.style.left = `${position}px`;
        ackNackMarker.style.top = '50%';
        ackNackMarker.style.transform = 'translateY(-50%)';
    
        return ackNackMarker;
    }    
    
    
          
    waveformBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const originalLabel = box.getAttribute('socketid');
            const indexLabel = box.querySelector('.index-label');

            if (selectionAllowed && !box.classList.contains('disabled')) {
                if (selectedBoxes.length < 2 && !selectedBoxes.includes(box)) {
                    selectedBoxes.push(box);
                    box.classList.add('selected');

                    const labelTag = document.createElement('div');
                    labelTag.classList.add('label-tag');
                    labelTag.innerText = selectedBoxes.length === 1 ? 'SCL' : 'SDA';
                    box.appendChild(labelTag);

                    indexLabels[box.getAttribute('socketid')] = selectedBoxes.length === 1 ? 'SCL' : 'SDA';
                    indexLabel.innerText = selectedBoxes.length === 1 ? 'SCL' : 'SDA';
                } else if (selectedBoxes.includes(box)) {
                    selectedBoxes = selectedBoxes.filter(b => b !== box);
                    box.classList.remove('selected');

                    const labelTag = box.querySelector('.label-tag');
                    if (labelTag) {
                        box.removeChild(labelTag);
                    }

                    indexLabel.innerText = originalLabel;
                    delete indexLabels[originalLabel];
                }
            }
        });
    });

    selectWaveformButton.addEventListener('click', () => {
        if (selectedBoxes.length === 2) {
            waveformBoxes.forEach(box => {
                box.classList.remove('selected');
                const labelTag = box.querySelector('.label-tag');
                if (labelTag) {
                    box.removeChild(labelTag);
                }

                box.classList.add('disabled');
                setupLabelEditing(box); // Ensure label editing is set up
            });

            selectedBoxes.forEach((box, index) => {
                const indexLabel = box.querySelector('.index-label');
                if (indexLabel) {
                    indexLabel.innerText = index === 0 ? 'SCL' : 'SDA';
                }
                // Keep selected boxes enabled
                box.classList.remove('disabled');
            });

            selectionInstructions.style.display = 'none';
            selectWaveformButton.style.display = 'none';

            selectedBoxes = [];
            selectionAllowed = false; // Disable further selections
        } else {
            alert('Please select exactly two waveform boxes.');
        }
    });

    function setupLabelEditing(box) {
        const indexLabel = box.querySelector('.index-label');
        const socketId = box.getAttribute('socketid');

        indexLabel.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent triggering the box selection

            const input = document.createElement('input');
            input.type = 'text';
            input.value = indexLabel.innerText;
            input.classList.add('index-input');

            function saveLabel() {
                indexLabel.innerText = input.value;
                indexLabels[socketId] = input.value; // Save custom label
                indexLabel.style.display = 'block';
                input.remove();
            }

            input.addEventListener('blur', saveLabel);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveLabel();
                }
            });

            indexLabel.style.display = 'none';
            box.appendChild(input);
            input.focus();
        });
    }

    function convertTo8BitAddress(addressBits) {
        // Ensure the input is exactly 7 bits long
        if (addressBits.length !== 7) {
            console.error('Address must be 7 bits long');
            return null;
        }
    
        // Add a leading 0 to make it 8 bits
        const fullAddressBits = '0' + addressBits;
    
        // Convert the binary string to a hexadecimal string
        const addressValue = parseInt(fullAddressBits, 2).toString(16).toUpperCase();
    
        return `0x${addressValue.padStart(2, '0')}`;
    }

    // Set up label editing for all boxes
    waveformBoxes.forEach(setupLabelEditing);
});
