var scannedDevices = [];
var gateway;
var websocket;
let pendingCallbacks = {};
const API_KEY = 's'; // Replace with your actual API key
const API_URL = 'https://api.openai.com/v1/chat/completions';
let globalJsonData = { deviceaddress: "", fields: [] };

window.addEventListener("load", onLoad);

window.addEventListener('load', () => {
  globalJsonData = { deviceaddress: "", fields: [] };
  loadAIInstructions();
});

var uids = [];

document.getElementById("addJsonContainerButton").addEventListener("click", addNewJsonContainer);

function addNewJsonContainer() {
  const selectedDevice = document.getElementById("deviceDropdown").value;

  if (!selectedDevice) {
    alert('Please select a device before adding a JSON container.');
    return;
  }

  const uniqueId = Date.now();
  uids.push(uniqueId);

  const newContainer = document.createElement("div");
  newContainer.className = "container json-container";
  newContainer.id = `json-container-${uniqueId}`;
  newContainer.setAttribute("data-device-address", selectedDevice);

  const closeButton = document.createElement("button");
  closeButton.className = "close-button";
  closeButton.textContent = "×";
  closeButton.onclick = function() { closeJsonContainer(uniqueId); };
  newContainer.appendChild(closeButton);

  const deviceHeaderContainer = document.createElement("div");
  deviceHeaderContainer.style.display = "flex";
  deviceHeaderContainer.style.alignItems = "center";
  deviceHeaderContainer.style.justifyContent = "center";
  deviceHeaderContainer.style.gap = "8px"; 

  const h2Import = document.createElement("h2");
  h2Import.textContent = `Device-${selectedDevice}`;
  deviceHeaderContainer.appendChild(h2Import);

  // HelpIcon container
  const helpIcon = document.createElement("span");
  helpIcon.className = "helpIcon";
  helpIcon.textContent = "?";
  helpIcon.style.cursor = "pointer";
  helpIcon.id = `helpIcon-${uniqueId}`;
  helpIcon.style.color = "red";
  helpIcon.style.fontSize = "1.5rem"; 
  deviceHeaderContainer.appendChild(helpIcon);

  newContainer.appendChild(deviceHeaderContainer);

  const jsonInput = document.createElement("input");
  jsonInput.type = "file";
  jsonInput.accept = ".json";
  jsonInput.className = "jsonFileInput";
  jsonInput.id = `jsonFileInput-${uniqueId}`;
  newContainer.appendChild(jsonInput);

  const jsonOutput = document.createElement("div");
  jsonOutput.className = "jsonOutput";
  jsonOutput.id = `jsonOutput-${uniqueId}`;
  newContainer.appendChild(jsonOutput);

  const userInputContainer = document.createElement("div");
  userInputContainer.className = "user-input-container";

  const h2Generate = document.createElement("h2");
  h2Generate.textContent = "Generate Configuration";
  userInputContainer.appendChild(h2Generate);

  const userInput = document.createElement("textarea");
  userInput.className = "userInput";
  userInput.id = `userInput-${uniqueId}`;
  userInput.placeholder = "Enter your instructions here...";
  userInputContainer.appendChild(userInput);

  const submitButton = document.createElement("button");
  submitButton.className = "submitButton";
  submitButton.textContent = "Generate Config";
  submitButton.id = `submitButton-${uniqueId}`;
  userInputContainer.appendChild(submitButton);

  const exportJsonButton = document.createElement("button");
  exportJsonButton.className = "exportJsonButton";
  exportJsonButton.textContent = "Export JSON";
  exportJsonButton.id = `exportJsonButton-${uniqueId}`;
  exportJsonButton.onclick = function() { exportJson(uniqueId); };
  userInputContainer.appendChild(exportJsonButton);

  newContainer.appendChild(userInputContainer);
  document.getElementById("device_controls").appendChild(newContainer);

  // Event Listeners
  document.getElementById(`jsonFileInput-${uniqueId}`).addEventListener("change", handleJsonUpload);
  document.getElementById(`submitButton-${uniqueId}`).addEventListener("click", function() {
    handleUserInput(uniqueId);
  });
  document.getElementById(`exportJsonButton-${uniqueId}`).addEventListener("click", exportJson);

  // Load from localStorage if data exists
  const storageKey = `device-${selectedDevice}`;
  const storedData = localStorage.getItem(storageKey);
  if (storedData) {
    const parsedData = JSON.parse(storedData);
    displayJsonObjects(parsedData, uniqueId);
  }

  // Setup device menu for help icon
  setupDeviceMenu(selectedDevice, uniqueId);
}

document.getElementById("registerWidth").addEventListener("change", function () {
  var registerWidth = parseInt(document.getElementById("registerWidth").value);
  var hexValues = document.getElementsByClassName("hex-value");

  if (registerWidth === 2) { // 16 bits selected
    for (var i = 0; i < hexValues.length; i++) {
      if (hexValues[i].style.backgroundColor !== "rgb(255, 255, 255)") {
        hexValues[i].style.backgroundColor = "rgb(255, 102, 128)";
      }
    }
    alert("Warning: You are now set to 16-bit width but the displayed values may still be 8-bit.");
  } else if (registerWidth === 1) { // 8 bits selected
    for (var i = 0; i < hexValues.length; i++) {
      if (hexValues[i].style.backgroundColor !== "rgb(255, 255, 255)") {
        hexValues[i].style.backgroundColor = "rgb(255, 102, 128)";
      }
    }
    alert("Warning: You are now set to 8-bit width but the displayed values may still be 16-bit.");
  }
});

function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const importedData = JSON.parse(e.target.result);
        const deviceAddress = importedData.deviceaddress;
        if (!deviceAddress) {
          throw new Error('Invalid JSON format: missing deviceaddress');
        }
        
        const storageKey = `device-${deviceAddress}`;
        localStorage.setItem(storageKey, JSON.stringify(importedData));
        
        // Get the unique ID from the file input's ID
        const uniqueId = event.target.id.split('-')[1];
        
        // Update UI for the specific container
        displayJsonObjects(importedData, uniqueId);
        
        // Update device dropdown if necessary
        updateDeviceDropdown([...scannedDevices, deviceAddress]);
        
        // Update the device address for this container
        const container = document.getElementById(`json-container-${uniqueId}`);
        if (container) {
          container.setAttribute("data-device-address", deviceAddress);
        }
        
        // Update the device dropdown for this container
        const dropdown = document.getElementById(`deviceDropdown-${uniqueId}`);
        if (dropdown) {
          dropdown.value = deviceAddress;
        }
        
      } catch (error) {
        console.error("Invalid JSON file", error);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }
}

function displayJsonObjects(jsonContent, uid) {
  const outputDiv = document.getElementById(`jsonOutput-${uid}`);
  
  // Check if the outputDiv element exists before attempting to modify it
  if (!outputDiv) {
    return;
  }
  
  outputDiv.innerHTML = ""; // Clear previous content
  
  const deviceAddress = jsonContent.deviceaddress;
  const fields = jsonContent.fields;

  fields.forEach((field, index) => {
    createJsonItem(outputDiv, field, deviceAddress, index, uid);
  });
}

function closeJsonContainer(uniqueId) {
  const container = document.getElementById(`json-container-${uniqueId}`);
  if (!container) {
    console.error(`Container with ID json-container-${uniqueId} not found`);
    return;
  }

  const deviceAddress = container.getAttribute("data-device-address");
  if (deviceAddress) {
    // Remove data from localStorage
    localStorage.removeItem(`device-${deviceAddress}`);
  }

  // Remove container from UI
  container.remove();

  // Remove uniqueId from uids array
  const index = uids.indexOf(uniqueId);
  if (index > -1) {
    uids.splice(index, 1);
  }
}


function createJsonItem(container, field, deviceAddress, index, uid) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "json-item";

  // Add delete button (cross icon)
  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.textContent = "×";
  deleteButton.style.marginRight = "10px";
  deleteButton.style.fontSize = "20px";
  deleteButton.style.backgroundColor = "transparent";
  deleteButton.style.border = "none";
  deleteButton.style.cursor = "pointer";
  deleteButton.onclick = function () {
    // Remove from display
    container.removeChild(itemDiv);

    // Remove from local storage
    const storageKey = `device-${deviceAddress}`;
    let deviceData = JSON.parse(localStorage.getItem(storageKey) || '{"deviceaddress":"","fields":[]}');
    deviceData.fields.splice(index, 1);
    localStorage.setItem(storageKey, JSON.stringify(deviceData));

    // Refresh the display to update indices
    displayJsonObjects(deviceData, uid);
  };
  itemDiv.appendChild(deleteButton);

  const button = document.createElement("button");
  button.className = "json-button";
  button.textContent = field.description || `Field ${index + 1}`;
  itemDiv.appendChild(button);

  const displayBoxId = `display-${uid}-${index}`;

  // Timer elements
  const timerButton = document.createElement("button");
  timerButton.className = "timer-button";
  timerButton.style.fontFamily = "'Roboto Mono', monospace";
  timerButton.textContent = "Timer"; // Timer icon
  timerButton.style.margin = "10px";
  itemDiv.appendChild(timerButton);

  // Container for timer controls
  const timerControls = document.createElement("div");
  timerControls.style.display = "none";
  timerControls.style.marginTop = "10px";

  const intervalInput = document.createElement("input");
  intervalInput.type = "number";
  intervalInput.placeholder = "Interval (sec)";
  intervalInput.style.marginRight = "10px";
  timerControls.appendChild(intervalInput);

  const playButton = document.createElement("button");
  playButton.textContent = "Play";
  playButton.style.fontFamily = "'Roboto Mono', monospace";
  timerControls.appendChild(playButton);

  const stopButton = document.createElement("button");
  stopButton.textContent = "Stop";
  stopButton.style.marginLeft = "10px";
  stopButton.style.fontFamily = "'Roboto Mono', monospace";
  timerControls.appendChild(stopButton);

  itemDiv.appendChild(timerControls);

  // Toggle timer controls visibility
  timerButton.addEventListener("click", () => {
    timerControls.style.display = timerControls.style.display === "none" ? "block" : "none";
  });

  let timerId;
  playButton.addEventListener("click", () => {
    const interval = parseInt(intervalInput.value, 10) * 1000;
    if (!isNaN(interval) && interval > 0) {
      clearInterval(timerId); // Clear any existing timer
      timerId = setInterval(() => {
        button.click(); // Simulate button click
      }, interval);
    }
  });

  stopButton.addEventListener("click", () => {
    clearInterval(timerId); // Stop the timer
  });

  if (field.function === "read") {
    const regWidth = field.reg_width || 8;
    const regCount = field.reg_count || 1;

    if (field.operation) {
      const displayBox = document.createElement("span");
      displayBox.className = "display-box";
      displayBox.id = displayBoxId;
      itemDiv.appendChild(displayBox);

      if (field.unit) {
        const unitLabel = document.createElement("span");
        unitLabel.className = "unit-label";
        unitLabel.textContent = field.unit;
        itemDiv.appendChild(unitLabel);
      }

      button.addEventListener("click", function () {
        readI2CWithDisplay(
          deviceAddress,
          field.reg_address,
          displayBoxId,
          regWidth,
          field.operation,
          regCount
        );
      });
    } else {
      for (let i = 0; i < regCount; i++) {
        const displayBox = document.createElement("span");
        displayBox.className = "display-box";
        displayBox.id = `${displayBoxId}-${i}`;
        itemDiv.appendChild(displayBox);

        if (field.unit) {
          const unitLabel = document.createElement("span");
          unitLabel.className = "unit-label";
          unitLabel.textContent = field.unit;
          itemDiv.appendChild(unitLabel);
        }
      }

      button.addEventListener("click", function () {
        for (let i = 0; i < regCount; i++) {
          const regAddress = parseInt(field.reg_address, 10) + i;
          readI2CWithDisplay(
            deviceAddress,
            regAddress,
            `${displayBoxId}-${i}`,
            regWidth
          );
        }
      });
    }
  } else if (field.function === "write") {
    if (field.fixed !== undefined) {
      // If the fixed parameter exists, use it directly and do not show the input box
      button.addEventListener("click", function () {
        writeI2CWithDisplay(
          deviceAddress,
          field.reg_address,
          field.fixed, // Use the fixed value for writing
          field.reg_width || 8
        );
      });
    } else {
      // If no fixed parameter, proceed with the standard input box
      const inputBox = document.createElement("input");
      inputBox.type = "text";
      inputBox.id = `input-${index}`;
      itemDiv.appendChild(inputBox);

      if (field.unit) {
        const unitLabel = document.createElement("span");
        unitLabel.textContent = field.unit;
        itemDiv.appendChild(unitLabel);
      }

      button.addEventListener("click", function () {
        const value = document.getElementById(`input-${index}`).value;
        writeI2CWithDisplay(
          deviceAddress,
          field.reg_address,
          value,
          field.reg_width || 8
        );
      });
    }
  }

  container.appendChild(itemDiv);
}

function initWebSocket() {
  const gatewayIP = localStorage.getItem('gatewayIP');
  if (!gatewayIP) {
    console.error('No gateway IP found in localStorage.');
    return;
  }

  console.log("Trying to open a WebSocket connection...");
  gateway = `ws://${gatewayIP}/ws`;
  websocket = new WebSocket(gateway);
  websocket.onopen = onOpen;
  websocket.onclose = onClose;
  websocket.onmessage = onMessage;
}

function onOpen(event) {
  console.log("Connection opened");
}

function onClose(event) {
  console.log("Connection closed");
  setTimeout(initWebSocket, 2000);
}

function onMessage(event) {
  var data = event.data;
  console.log("Received message: " + data);

  if (data.startsWith("i2c_scan:")) {
    scannedDevices = data.substring(9).trim().split(" ");
    updateDeviceDropdown(scannedDevices);
    console.log("i2c_scan(" + scannedDevices.join(",") + ")");
  } else if (data.startsWith("i2c_registers:")) {
    displayRegisters(data.substring(14).trim().split(","));
  } else if (data.startsWith("i2c_read(")) {
    var parts = data.match(/\(([^)]+)\)/)[1].split(",");
    var registerAddress = parts[1];
    var registerValue = parts[2];
    updateRegisterValue(registerAddress, registerValue);
  }
}

function onLoad(event) {
  initWebSocket();
}

function writeI2C() {
  var deviceAddress = document.getElementById("deviceAddress").value;
  var registerAddress = document.getElementById("registerAddress").value;
  var registerValue = document.getElementById("registerValue").value;
  var command = `i2c_write(${deviceAddress},${registerAddress},${registerValue})`;
  websocket.send(command);
}

function writeI2CWithDisplay(
  deviceAddress,
  registerAddress,
  value,
  displayBoxId
) {
  var command = `i2c_write(${deviceAddress},${registerAddress},${value})`;
  websocket.send(command);
  console.log(`Sent command: ${command}`);
}

function readI2C(regWidth = 8) {
  var deviceAddress = document.getElementById("deviceAddress").value;
  var registerAddress = document.getElementById("registerAddress").value;
  
  var command = `i2c_read(${deviceAddress},${registerAddress},${regWidth === 16 ? 2 : 1})`;
  
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(command);
    console.log("Sent command: " + command);
  } else {
    console.error("WebSocket connection is not open or ready.");
  }

  var hexValues = document.getElementsByClassName("hex-value");
  for (var i = 0; i < hexValues.length; i++) {
    hexValues[i].style.backgroundColor = "#fff"; // Reset to white
  }
}


function readI2CWithDisplay(
  deviceAddress,
  registerAddress,
  displayBoxId,
  regWidth = 8,
  operation = null,
  regCount = 1
) {
  let command;

  if (regWidth === 16) {
    command = `i2c_read(${deviceAddress},${registerAddress},2)`;
  } else {
    command = `i2c_read(${deviceAddress},${registerAddress},1)`;
  }

  websocket.send(command);
  console.log(`Sent command: ${command}`);

  pendingCallbacks[`${deviceAddress},${registerAddress}`] = function (
    value
  ) {
    if (operation) {
      if (regCount === 2) {
        const nextRegisterAddress = parseInt(registerAddress) + 1;
        websocket.send(
          `i2c_read(${deviceAddress},${nextRegisterAddress},${
            regWidth === 16 ? 2 : 1
          })`
        );

        pendingCallbacks[`${deviceAddress},${nextRegisterAddress}`] =
          function (secondValue) {
            const x = parseInt(value);
            const y = parseInt(secondValue);
            const operationWithDecimal = operation.replace(
              /0x[0-9A-Fa-f]+/g,
              (match) => parseInt(match, 16)
            );
            const result = eval(operationWithDecimal);
            document.getElementById(displayBoxId).textContent =
              parseFloat(result.toFixed(2));
          };
      } else {
        const operationWithDecimal = operation.replace(
          /0x[0-9A-Fa-f]+/g,
          (match) => parseInt(match, 16)
        );
        const result = eval(operationWithDecimal.replace("x", value));
        document.getElementById(displayBoxId).textContent = parseFloat(
          result.toFixed(2)
        );
      }
    } else {
      document.getElementById(displayBoxId).textContent = value;
    }
  };

  websocket.addEventListener("message", function (event) {
    var data = event.data;
    console.log(`Received message: ${data}`);
    if (data.startsWith("i2c_read(")) {
      var parts = data.match(/\(([^)]+)\)/)[1].split(",");
      var recvDeviceAddress = parts[0];
      var recvRegisterAddress = parts[1];
      var value = parts.slice(2);

      var callbackKey = `${recvDeviceAddress},${recvRegisterAddress}`;
      if (callbackKey in pendingCallbacks) {
        pendingCallbacks[callbackKey](value);
        delete pendingCallbacks[callbackKey];
      }
    }
  });
}

function scanI2C() {
  scannedDevices = []; // Clear the device list before scanning
  var command = "i2c_scan()";
  websocket.send(command);
  console.log("Sent command: " + command);

  // Call the function to update both dropdowns after scanning
  updateDeviceDropdown(scannedDevices);
}

document.getElementById('scanButton').addEventListener('click', function() {
  scanI2C();
});

function updateDeviceDropdown(devices) {

  // Select elemets with name starting with deviceDropdown
  var deviceSelects = document.querySelectorAll('[id^="deviceDropdown"]');

  // Iterate thorugh deviceSelects

  deviceSelects.forEach(function (deviceSelect) {
    // Clear previous options
    deviceSelect.innerHTML = '<option value="">Select a device</option>';

    // Populate both dropdowns with the scanned devices
    devices.forEach(function (device) {
      var option = document.createElement("option");
      option.value = device;
      option.textContent = device;
      deviceSelect.appendChild(option);
    });
  });
  // Do not auto-select or load the first device
  console.log('Devices scanned. Please select a device from the dropdown.');
}

// Attach the updated deviceSelected to the onchange event of the dropdown
document.getElementById("deviceDropdown").addEventListener("change", 
  (e) => {
    deviceSelected(e.target.id);
  }
);

function deviceSelected(id) {
  var selectedDevice = document.getElementById(id).value;

  if (selectedDevice) {
      // Check localStorage for the selected device
      var storageKey = `device-${selectedDevice}`;
      var deviceData = localStorage.getItem(storageKey);

      if (deviceData) {
          // Pass the correct UID for the container where the device was selected
          displayJsonObjects(JSON.parse(deviceData), id.split('-')[1]);
      } else {
          // Clear the UI if no data is found
          clearUI(id.split('-')[1]);
      }

      var helpIconId = `helpIcon-${id.split('-')[1]}`;
      var helpIcon = document.getElementById(helpIconId);

      if (helpIcon) {
          helpIcon.style.display = "inline"; // Show the help icon
          setupDeviceMenu(selectedDevice, id.split('-')[1]);

          helpIcon.onclick = function () {
              var deviceMenuId = `deviceMenu-${id.split('-')[1]}`;
              var deviceMenu = document.getElementById(deviceMenuId);

              if (deviceMenu) {
                  deviceMenu.style.display = deviceMenu.style.display === "none" ? "flex" : "none";
              }
          };
      } 
  } else {
      console.log('No device selected');
      clearUI(id.split('-')[1]);
  }
}

function clearUI(uid) {
  const outputDiv = document.getElementById(`jsonOutput-${uid}`);
  if (outputDiv) {
    outputDiv.innerHTML = "";
  }
}

function setupDeviceMenu(deviceAddress, uniqueId) {
  var deviceMenuId = `deviceMenu-${uniqueId}`;
  var deviceMenu = document.createElement("div");
  deviceMenu.id = deviceMenuId;
  deviceMenu.style.display = "none"; 
  deviceMenu.style.position = "absolute";
  deviceMenu.style.width = "max-content";
  deviceMenu.style.backgroundColor = "#fff";
  deviceMenu.style.border = "1px solid #ccc";
  deviceMenu.style.padding = "10px";
  deviceMenu.style.zIndex = "9999";

  var helpIcon = document.getElementById(`helpIcon-${uniqueId}`);
  helpIcon.style.position = "relative";
  helpIcon.appendChild(deviceMenu); 

  var deviceOptions = document.createElement("div");
  deviceOptions.id = `deviceOptions-${uniqueId}`;
  deviceMenu.appendChild(deviceOptions);

  // Add the message above the list items
  var message = document.createElement("p");
  message.textContent = "What device are you using?";
  message.style.fontWeight = "bold";
  deviceOptions.appendChild(message);

  // Fetch the device list from the JSON file
  fetch("deviceLists.json")
      .then(response => response.json())
      .then(deviceLists => {
          let deviceKey = deviceAddress.toString();

          if (deviceLists[deviceKey]) {
              deviceLists[deviceKey].forEach(device => {
                  addDeviceOption(deviceOptions, device.name, device.libpath, uniqueId, deviceAddress);
              });
          } else {
              console.log(`No devices found for address: ${deviceAddress}`);
          }
      })
      .catch(error => {
          console.error("Error loading deviceLists.json:", error);
      });

  // The menu will be shown/hidden when the help icon is clicked
  helpIcon.onclick = function() {
      deviceMenu.style.display = deviceMenu.style.display === "none" ? "block" : "none";
  };
}





function addDeviceOption(container, optionText, jsonFilePath, uniqueId, deviceAddress) {
  var li = document.createElement("li");
  var link = document.createElement("a");
  link.href = "#";
  link.textContent = optionText;

  link.onclick = function(event) {
    event.preventDefault();
    importJsonFileAndSave(jsonFilePath, uniqueId, deviceAddress);
  };

  li.appendChild(link);
  container.appendChild(li);
}

function importJsonFileAndSave(filePath, uniqueId, deviceAddress) {
  fetch(filePath)
    .then(response => response.json())
    .then(data => {
      if (!deviceAddress) {
        console.error('No device address provided');
        return;
      }

      // Save to localStorage
      const storageKey = `device-${deviceAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(data));

      console.log(`JSON data saved to localStorage for device: ${deviceAddress}`);

      // Update the UI to reflect the new data
      displayJsonObjects(data, uniqueId);

      // Hide the menu after successful import
      const deviceMenu = document.getElementById(`deviceMenu-${uniqueId}`);
      if (deviceMenu) {
        deviceMenu.style.display = "none";
      }
    })
    .catch(error => console.error('Error loading JSON file:', error));
}


function importJsonFile(filePath, uniqueId) {
  fetch(filePath)
    .then(response => response.json())
    .then(data => {
      // Import the JSON data into the UI
      displayJsonObjects(data, uniqueId);

      // Save to localStorage if needed
      const storageKey = `device-${data.deviceaddress}`;
      localStorage.setItem(storageKey, JSON.stringify(data));

      // Hide the menu after successful import
      const deviceMenu = document.getElementById(`deviceMenu-${uniqueId}`);
      if (deviceMenu) {
        deviceMenu.style.display = "none"; // Hide the device list after import
      } else {
        console.error(`Device menu with ID: deviceMenu-${uniqueId} not found.`);
      }
    })
    .catch(error => console.error('Error loading JSON file:', error));
}


function dumpRegisters() {
    var deviceAddress = document.getElementById("deviceDropdown").value;
    var registerWidth = parseInt(document.getElementById("registerWidth").value);
    
    if (deviceAddress && registerWidth) {
        var command = `read_all_registers(${deviceAddress},${registerWidth})`;
        websocket.send(command);

        var hexValues = document.getElementsByClassName("hex-value");
        for (var i = 0; i < hexValues.length; i++) {
            hexValues[i].style.backgroundColor = "#fff";
        }
    } else {
        alert("Please select both a device and register width.");
    }
}

function displayRegisters(registers) {
  var registersDiv = document.getElementById("registers");
  registersDiv.innerHTML = "";
  var registerWidth = parseInt(document.getElementById("registerWidth").value);
  var bitCount = registerWidth * 8;

  registers.forEach(function (register) {
      var parts = register.split(":");
      var registerValue = parseInt(parts[1]);
      var bits = registerValue.toString(2).padStart(bitCount, "0").split("");
      var hexValue = registerValue.toString(16).toUpperCase().padStart(registerWidth * 2, "0");
      
      var registerDiv = document.createElement("div");
      registerDiv.classList.add("register");
      
      var registerNumber = document.createElement("div");
      registerNumber.classList.add("register-number");
      registerNumber.textContent = parts[0];
      
      var readButton = document.createElement("div");
      readButton.classList.add("action-button");
      readButton.textContent = "->";
      readButton.onclick = function () {
          var deviceAddress = document.getElementById("deviceDropdown").value;
          var registerAddress = parts[0];
          var command = `i2c_read(${deviceAddress},${registerAddress},${registerWidth})`;

          // Check if WebSocket is open before sending the command
          if (websocket && websocket.readyState === WebSocket.OPEN) {
              websocket.send(command);
              console.log(`Command sent: ${command}`);

              // Reset hex value background colors
              var hexValues = document.getElementsByClassName("hex-value");
              for (var i = 0; i < hexValues.length; i++) {
                  hexValues[i].style.backgroundColor = "#fff"; // Reset to white
              }
          } else {
              console.error("WebSocket connection is not open.");
          }
      };
      
      var writeButton = document.createElement("div");
      writeButton.classList.add("action-button", "write");
      writeButton.textContent = "->";
      
      var bitsDiv = document.createElement("div");
      bitsDiv.classList.add("bits");
      
      var hexDiv = document.createElement("div");
      hexDiv.classList.add("hex-value");
      hexDiv.textContent = hexValue;
      
      function updateBits() {
          bitsDiv.innerHTML = "";
          bits.forEach(function (bit, index) {
              var bitDiv = document.createElement("div");
              bitDiv.classList.add("bit");
              bitDiv.textContent = bit;
              bitDiv.onclick = function () {
                  // Toggle the bit value
                  bits[index] = bits[index] === "0" ? "1" : "0";
                  bitDiv.textContent = bits[index];
                  hexDiv.textContent = parseInt(bits.join(""), 2).toString(16).toUpperCase().padStart(registerWidth * 2, "0");
                  hexDiv.style.backgroundColor = "rgb(255, 102, 128)";
              };
              bitsDiv.appendChild(bitDiv);
          });
      }
      
      updateBits();
      
      writeButton.onclick = function () {
          var newValue = parseInt(bits.join(""), 2);
          var command = `i2c_write(${document.getElementById("deviceDropdown").value},${parts[0]},${newValue})`;
          // Check if WebSocket is open before sending the command
          if (websocket && websocket.readyState === WebSocket.OPEN) {
              websocket.send(command);
              hexDiv.textContent = newValue.toString(16).toUpperCase().padStart(registerWidth * 2, "0");
              hexDiv.style.backgroundColor = "#fff"; // Reset to white
          } else {
              console.error("WebSocket connection is not open.");
          }
      };
      
      registerDiv.appendChild(registerNumber);
      registerDiv.appendChild(readButton);
      registerDiv.appendChild(bitsDiv);
      registerDiv.appendChild(writeButton);
      registerDiv.appendChild(hexDiv);
      
      registersDiv.appendChild(registerDiv);
  });
}

function updateRegisterValue(registerAddress, registerValue) {
  var registersDiv = document.getElementById("registers");
  var registerDivs = registersDiv.getElementsByClassName("register");
  var registerWidth = parseInt(document.getElementById("registerWidth").value);
  var bitCount = registerWidth * 8;

  for (var i = 0; i < registerDivs.length; i++) {
    var registerNumber = registerDivs[i].getElementsByClassName("register-number")[0];
    if (registerNumber.textContent === registerAddress) {
      var bitsDiv = registerDivs[i].getElementsByClassName("bits")[0];
      var hexDiv = registerDivs[i].getElementsByClassName("hex-value")[0];
      var bits = parseInt(registerValue).toString(2).padStart(bitCount, "0").split("");
      var hexValue = parseInt(registerValue).toString(16).toUpperCase().padStart(registerWidth * 2, "0");
      
      function updateBits() {
        bitsDiv.innerHTML = "";
        bits.forEach(function (bit, index) {
          var bitDiv = document.createElement("div");
          bitDiv.classList.add("bit");
          bitDiv.textContent = bit;
          bitDiv.onclick = function () {
            bits[index] = bits[index] === "0" ? "1" : "0";
            bitDiv.textContent = bits[index];
            hexDiv.textContent = parseInt(bits.join(""), 2).toString(16).toUpperCase().padStart(registerWidth * 2, "0");
            hexDiv.style.backgroundColor = "rgb(255, 102, 128)";
          };
          bitsDiv.appendChild(bitDiv);
        });
      }
      
      updateBits();
      hexDiv.textContent = hexValue;
      break;
    }
  }
}

function updateBitDivs(bitsDiv, registerWidth) {
  bitsDiv.innerHTML = ""; // Clear previous bits

  var bitCount = registerWidth * 8;
  for (var i = 0; i < bitCount; i++) {
    var bitDiv = document.createElement("div");
    bitDiv.classList.add("bit");
    bitDiv.textContent = "0";
    bitDiv.onclick = function () {
      this.textContent = this.textContent === "0" ? "1" : "0";
    };
    bitsDiv.appendChild(bitDiv);
  }

  Array.from(bitsDiv.childNodes).reverse().forEach(node => bitsDiv.appendChild(node));
}

let aiInstructions = ''; 

// Function to read AI instructions from prompt.txt
async function loadAIInstructions() {
    try {
        const response = await fetch('prompt.txt');
        aiInstructions = await response.text();
    } catch (error) {
        console.error('Error loading AI instructions:', error);
    }
}

// Load AI instructions when the page loads
window.addEventListener('load', loadAIInstructions);

// New function to handle ChatGPT API calls
async function getChatGPTResponse(userInput) {
    try {
        const response = await axios.post(API_URL, {
            model: "gpt-4",
            messages: [
                { role: "system", content: aiInstructions },
                { role: "user", content: userInput }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('ChatGPT response:', response.data.choices[0].message.content);
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function processChatGPTResponse(response, uniqueId) {
  try {
    const newField = JSON.parse(response);

    const container = document.getElementById(`json-container-${uniqueId}`);
    const currentDevice = container.getAttribute("data-device-address");

    if (!currentDevice) {
      console.error('No device associated with this JSON container.');
      return;
    }

    const storageKey = `device-${currentDevice}`;
    let deviceData = JSON.parse(localStorage.getItem(storageKey) || '{"deviceaddress":"","fields":[]}');

    deviceData.deviceaddress = currentDevice;

    deviceData.fields.push(newField);

    localStorage.setItem(storageKey, JSON.stringify(deviceData));

    displayJsonObjects(deviceData, uniqueId);
  } catch (error) {
    console.error('Error processing ChatGPT response:', error);
    document.getElementById(`userInput-${uniqueId}`).value = response;
  }
}

function exportJson(uniqueId) {
  const container = document.getElementById(`json-container-${uniqueId}`);
  if (!container) {
    console.error(`Container with ID json-container-${uniqueId} not found`);
    return;
  }

  const currentDevice = container.getAttribute("data-device-address");
  if (!currentDevice) {
    alert('No device associated with this container.');
    return;
  }

  const storageKey = `device-${currentDevice}`;
  const jsonString = localStorage.getItem(storageKey);
  
  if (!jsonString) {
    alert('No data found for this device.');
    return;
  }

  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `device-${currentDevice}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleUserInput(uniqueId) {
  const userInputElement = document.getElementById(`userInput-${uniqueId}`);
  
  if (!userInputElement) {
    console.error(`User input element with ID userInput-${uniqueId} not found`);
    return;
  }
  
  const userInput = userInputElement.value;

  if (userInput.trim() === '') return;

  getChatGPTResponse(userInput)
    .then(chatGPTResponse => {
      if (chatGPTResponse) {
        processChatGPTResponse(chatGPTResponse, uniqueId);
      }
    });

  userInputElement.value = '';
}
var bitsDiv = document.createElement("div");
bitsDiv.classList.add("bits");
updateBitDivs(bitsDiv, registerWidth);
