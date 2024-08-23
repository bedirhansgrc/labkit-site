const portSelect = document.getElementById('portSelect');
const dataDiv = document.getElementById('data');
const baudRateInput = document.getElementById('baudRateInput');
const exportButton = document.getElementById('exportButton');
const pairedStatus = document.getElementById('pairedStatus');
const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const sendMessageText = document.getElementById('send-message-text');
const exportTerminalLogsButton = document.getElementById('exportTerminalLogsButton');
const importButton = document.getElementById('importButton');
const importFile = document.getElementById('importFile');
const connectButton2 = document.getElementById('connectButton2');
const modeSelector = document.querySelector('.mode-selector');
const clearButton = document.getElementById('clearButton');
const form = document.getElementById('messageForm');
const modeToggle = document.getElementById('modeToggle');
const modeLabel = document.getElementById('modeLabel');
let baudRate;
let currentMode = 'normal';
let ports = [];
let readers = [];
let writers = [];
let messageCount = 0;
let pinnedMessages = [];
let allMessages = [];
let activePorts = {};
let isConnected = false;
let connectedBaudRates = [];
let portIds = [];

connectButton.addEventListener('click', connectToSerialPort);
disconnectButton.addEventListener('click', disconnectFromSerialPort);

exportTerminalLogsButton.addEventListener('click', () => {
  const terminalDiv = document.getElementById('data');
  const messages = terminalDiv.querySelectorAll('.message-received, .message-received-port1, .message-received-port2');
  
  if (messages.length === 0) {
    alert('No messages to export.');
    return;
  }
  
  let logs = '';
  messages.forEach((message) => {
    const time = message.querySelector('.message-time').innerText;
    const port = message.querySelector('.message-port') ? message.querySelector('.message-port').innerText : 'N/A';
    const content = message.querySelector('p').innerText;
    logs += `[${time}] ${port}: ${content}\n`;
  });

  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'terminal_logs.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function toggleSendMessageForm() {
  const messageForm = document.getElementById('messageForm');
  if (currentMode === 'monitoring') {
    messageForm.style.display = 'none';
    sendMessageText.style.display = 'none';
  } else {
    messageForm.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const uartViewer = document.getElementById('uart-viewer');
  uartViewer.style.display = 'flex';

  document.querySelectorAll('input[name="baudRate"]').forEach(radio => {
      radio.addEventListener('change', (event) => {
          baudRateInput.value = event.target.value;
      });
  });

  toggleSendMessageForm(); // Ensure the form is shown/hidden based on the initial mode
});

importButton.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
          try {
              const messages = JSON.parse(e.target.result);
              importMessages(messages);
          } catch (error) {
              alert('Invalid JSON file');
          }
      };
      reader.readAsText(file);
  }
});

clearButton.addEventListener('click', () => {
  dataDiv.innerHTML = '';
  allMessages = [];
  console.log('Terminal cleared');
});

async function connectToSerialPort() {
  if (currentMode === 'normal' && ports.length > 0) {
    alert('In Normal Mode, only one connection is allowed.');
    return;
  }

  if (currentMode === 'monitoring' && ports.length >= 2) {
    alert('In Monitoring Mode, only two connections are allowed.');
    return;
  }
  const baudRateValue = baudRateInput.value.trim();
  if (baudRateValue) {
    baudRate = parseInt(baudRateValue, 10);
  } else {
    alert('Please enter baud rate');
    return;
  }

  try {
    console.log('Connecting to serial port...');

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baudRate });
    const reader = port.readable.getReader();
    const writer = port.writable.getWriter();

    const portId = generateUniquePortId();
    const portColor = generateUniqueColor(portId);

    ports.push(port);
    readers.push(reader);
    writers.push(writer);
    portIds.push(portId);

    if (connectedBaudRates.length > 0 && !connectedBaudRates.includes(baudRate)) {
      console.log('Baud rates do not match. Disconnecting port.');
      alert('Connected baud rates do not match. Disconnecting port.');
      await closePort(portIds.length - 1);
      return;
    }

    connectedBaudRates.push(baudRate);

    // Store the color with the port
    activePorts[portId] = {
      active: true,
      color: portColor
    };

    console.log(`Connected to port ${portId} with baud rate ${baudRate}`);
    isConnected = true;
    pairedStatus.style.display = 'inline';

    updateConnectedPortsUI();
    readPort(reader, portId);

    // Update button states and display the port message
    if (currentMode === 'normal') {
      connectButton.disabled = true;
      document.getElementById('portMessage1').textContent = `Port 1: ${portId}`;
    } else {
      if (ports.length === 1) {
        connectButton.disabled = true;
        document.getElementById('portMessage1').textContent = `Port 1: ${portId}`;
      } else if (ports.length === 2) {
        connectButton2.disabled = true;
        document.getElementById('portMessage2').textContent = `Port 2: ${portId}`;
      }
    }
    disconnectButton.disabled = false;
  } catch (error) {
    console.error('Error connecting to serial port:', error);
  }
  updateUIForMode();
}

function updateUIForMode() {
  if (currentMode === 'normal') {
    connectButton2.style.display = 'none';
    if (ports.length > 0) {
      connectButton.disabled = true;
    } else {
      connectButton.disabled = false;
    }
  } else {
    connectButton2.style.display = 'inline-block'; // This line is crucial
    if (ports.length === 1) {
      connectButton.disabled = true;
      connectButton2.disabled = false;
    } else if (ports.length === 2) {
      connectButton.disabled = true;
      connectButton2.disabled = true;
    } else {
      connectButton.disabled = false;
      connectButton2.disabled = false;
    }
  }
}

connectButton2.addEventListener('click', connectToSerialPort);

function generateUniquePortId() {
  return 'port-' + Date.now();
}

function updateConnectedPortsUI() {
  const connectedPortsDiv = document.getElementById('connectedPorts');
  connectedPortsDiv.innerHTML = '';
  portIds.forEach((portId, index) => {
    if (activePorts[portId] && activePorts[portId].active) {
      const portElement = document.createElement('div');
    }
  });
  updateUIForMode();
}

function generateUniqueColor(portId) {
  let hash = 0;
  for (let i = 0; i < portId.length; i++) {
    hash = portId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `hsl(${hash % 360}, 70%, 70%)`;
  return color;
}

async function disconnectFromSerialPort() {
  if (ports.length > 0) {
    // Loop through the ports array and close each port
    for (let i = 0; i < ports.length; i++) {
      await closePort(i);
    }
    alert('All ports disconnected');
    isConnected = false;
    pairedStatus.style.display = 'none';
    connectedBaudRates = [];
    updateConnectedPortsUI();

    // Update button states
    connectButton.disabled = false;
    connectButton2.disabled = false;
    disconnectButton.disabled = true;
    document.getElementById('portMessage1').textContent = '';
    document.getElementById('portMessage2').textContent = '';
  } else {
    alert('No ports to disconnect');
  }
}

exportButton.addEventListener('click', () => {
  if (allMessages.length === 0) {
    alert('No messages to export.');
    return;
  }
  const exportData = allMessages.map((message, index) => ({
    number: index + 1,
    message: message
  }));
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'messages.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

async function readPort(reader, portId) {
  let buffer = '';
  const decoder = new TextDecoder('utf-8');

  while (activePorts[portId].active) {
    try {
      const { value, done } = await reader.read();
      if (done) {
        console.log(`Port ${portId} reading finished`);
        delete activePorts[portId];
        updateConnectedPortsUI();
        break;
      }
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const completeMessage = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (completeMessage) {
            console.log(`Data received from port ${portId}: ${completeMessage}`);
            displayMessage(completeMessage, 'received', portId);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading from port ${portId}:`, error);
      break;
    }
  }
}

async function disconnectFromSerialPort() {
  if (ports.length > 0) {
    // Loop through all connected ports and close them
    for (let i = ports.length - 1; i >= 0; i--) {
      await closePort(i);
    }
    alert('All ports disconnected');
    isConnected = false;
    pairedStatus.style.display = 'none';
    connectedBaudRates = [];
    updateConnectedPortsUI();

    // Update button states
    connectButton.disabled = false;
    connectButton2.disabled = false;
    disconnectButton.disabled = true;
    document.getElementById('portMessage1').textContent = '';
    document.getElementById('portMessage2').textContent = '';
  } else {
    alert('No ports to disconnect');
  }
}

async function closePort(portNumber) {
  if (ports[portNumber]) {
    const portId = portIds[portNumber];
    activePorts[portId] = false;
    try {
      await readers[portNumber].cancel();
      readers[portNumber].releaseLock();
      await writers[portNumber].close();
      writers[portNumber].releaseLock();
      await ports[portNumber].close();
      console.log(`Port ${portId} closed`);
      
      // Remove the port, reader, writer, and portId from their respective arrays
      connectedBaudRates.splice(portNumber, 1);
      ports.splice(portNumber, 1);
      readers.splice(portNumber, 1);
      writers.splice(portNumber, 1);
      portIds.splice(portNumber, 1);
      
      updateConnectedPortsUI();

      // Clear the port number text
      if (portNumber === 0) {
        document.getElementById('portMessage1').textContent = '';
      } else if (portNumber === 1) {
        document.getElementById('portMessage2').textContent = '';
      }
    } catch (error) {
      console.error(`Error closing port ${portId}:`, error);
    }
  }
}

function importMessages(messages) {
  messages.forEach(msg => {
      const messageText = msg.message;
      displayMessage(messageText, 'imported');
      addToMessageList(messageText, 'imported', msg.number);
  });
}

function displayMessage(message, type = 'received', portId = null) {
  const messageContainer = document.createElement('div');
  if (type === 'received') {
    if (portId === portIds[0]) {
      messageContainer.classList.add('message-received-port1');
    } else if (portId === portIds[1]) {
      messageContainer.classList.add('message-received-port2');
    } else {
      messageContainer.classList.add('message-received');
    }
  } else {
    messageContainer.classList.add(type === 'sent' ? 'message-sent' : 'message-received-port1');
  }

  const p = document.createElement('p');
  p.innerText = message;
  messageContainer.appendChild(p);

  const now = new Date();
  const timeString = now.toLocaleTimeString();

  const timeSpan = document.createElement('span');
  timeSpan.innerText = timeString;
  timeSpan.classList.add('message-time');

  messageContainer.appendChild(timeSpan);

  if (portId) {
    const portSpan = document.createElement('span');
    portSpan.innerText = `Port: ${portId}`;
    portSpan.classList.add('message-port');
    messageContainer.appendChild(portSpan);
  }

  dataDiv.appendChild(messageContainer);
  dataDiv.scrollTop = dataDiv.scrollHeight;

  if (type === 'sent' && !allMessages.includes(message)) {
    addToMessageList(message, type);
    allMessages.push(message);
  }

  // Keep pinned messages at the top
  pinnedMessages.forEach(pinnedMessage => {
    messageList.prepend(pinnedMessage);
  });
}

function parseMessage(message) {
  console.log(`Parsing message: ${message}`);
  const commaIndex = message.indexOf(',');
  if (commaIndex !== -1 && message.startsWith('[') && message.endsWith(']')) {
    const socketid = message.slice(1, commaIndex); // Get value between [ and comma
    const content = message.slice(commaIndex + 1, -1); // Get content after comma, remove ]
    return { socketid, content };
  }
  return null;
}

function generateUniquePortId() {
  return 'port-' + (portIds.length + 1);
}

function addToMessageList(message, type, number) {
  const messageList = document.getElementById('messageList');
  const messageListItem = document.createElement('div');
  messageListItem.classList.add('message-item');

  const messageNumber = document.createElement('div');
  messageNumber.classList.add('message-number');
  messageNumber.innerText = number || ++messageCount;
  messageListItem.appendChild(messageNumber);

  const messageText = document.createElement('div');
  messageText.classList.add('message-text');
  messageText.innerText = message;
  messageListItem.appendChild(messageText);

  const pinButton = document.createElement('button');
  pinButton.classList.add('pin-button');
  pinButton.innerHTML = '<i class="fas fa-thumbtack"></i>';
  pinButton.addEventListener('click', () => togglePinMessage(messageListItem));
  messageListItem.appendChild(pinButton);

  const deleteButton = document.createElement('button');
  deleteButton.classList.add('delete-button');
  deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
  deleteButton.addEventListener('click', () => deleteMessage(messageListItem, message));
  messageListItem.appendChild(deleteButton);

  const resendButton = document.createElement('button');
  resendButton.classList.add('resend-button');
  resendButton.innerHTML = '<i class="fas fa-redo"></i>';
  resendButton.addEventListener('click', () => resendMessage(message));
  messageListItem.appendChild(resendButton);

  if (type === 'pinned') {
      messageList.prepend(messageListItem);
      messageListItem.classList.add('pinned-message');
      pinnedMessages.unshift(messageListItem);
  } else {
      messageList.appendChild(messageListItem);
  }
}

function deleteMessage(messageItem, message) {
  const messageList = document.getElementById('messageList');
  messageList.removeChild(messageItem);
  pinnedMessages = pinnedMessages.filter(item => item !== messageItem);
  allMessages = allMessages.filter(msg => msg !== message);
}

function togglePinMessage(messageItem) {
  const messageList = document.getElementById('messageList');
  if (messageItem.classList.contains('pinned-message')) {
    messageItem.classList.remove('pinned-message');
    pinnedMessages = pinnedMessages.filter(item => item !== messageItem);

    messageList.removeChild(messageItem);

    const unpinnedMessages = Array.from(messageList.children);
    unpinnedMessages.push(messageItem);
    unpinnedMessages.sort((a, b) => {
      const aNumber = parseInt(a.querySelector('.message-number').innerText, 10);
      const bNumber = parseInt(b.querySelector('.message-number').innerText, 10);
      return bNumber - aNumber;
    });

    pinnedMessages.forEach(pinnedMessage => {
      messageList.prepend(pinnedMessage);
    });

    unpinnedMessages.forEach(msg => {
      if (!msg.classList.contains('pinned-message')) {
        messageList.appendChild(msg);
      }
    });
  } else {
    messageItem.classList.add('pinned-message');
    pinnedMessages.unshift(messageItem);
    messageList.prepend(messageItem);
  }
}

function resendMessage(message) {
  sendMessage(message);
}

async function sendMessage(message) {
  if (!baudRate || ports.length === 0) {
    alert('Please set the baud rate and connect to at least one serial port before sending a message.');
    return;
  }

  const data = new TextEncoder().encode(message + '\n');

  try {
    for (let i = 0; i < writers.length; i++) {
      if (activePorts[`port-${i + 1}`]) {
        await writers[i].write(data);
        console.log(`Message sent to Port ${i + 1}: ${message}`);
      }
    }
    displayMessage(message, 'sent');
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let message = document.getElementById('message').value.trim();
  if (message) {
    sendMessage(message, true); // Set isPortMessage parameter to true for message sending
    document.getElementById('message').value = '';
  }
});

modeToggle.addEventListener('change', (event) => {
  currentMode = event.target.checked ? 'monitoring' : 'normal';
  updateModeUI();
  toggleSendMessageForm();
  updateUIForMode(); // Add this line
});

function updateModeUI() {
    if (currentMode === 'monitoring') {
        modeLabel.innerText = 'Monitoring Mode';
        document.getElementById('messageForm').style.display = 'none';
        document.getElementById('send-message-text').style.display = 'none';
    } else {
        modeLabel.innerText = 'Normal Mode';
        document.getElementById('messageForm').style.display = 'flex';
        document.getElementById('send-message-text').style.display = 'block';
    }
}

// Initial UI setup based on the current mode
updateModeUI();

updateUIForMode();
