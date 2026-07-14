import { Server, doesServerExist, getSeed } from "./networking/server.js";

const serverName = document.getElementById('serverName');
const seedValue = document.getElementById('seedValue');
const playersOnline = document.getElementById('playersOnline');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveBtn = document.getElementById('saveBtn');
const messageInput = document.getElementById('commandInput');
const sendBtn = document.getElementById('sendBtn');
const consoleContainer = document.getElementById('consoleContainer');
const playerSelect = document.getElementById('playerSelect');
const playerList = document.getElementById('playerList');
const selectedFile = document.getElementById("selectedFile");
const browseBtn = document.getElementById("browseBtn");
const autoSaveSelect = document.getElementById("autoSaveSelect");

let worldFileHandle = null;
let worldData = null;
let lastCommand = null;

serverName.textContent = window.location.search ? decodeURIComponent(window.location.search.split('=')[1]) : "Unnamed Server";
if (await doesServerExist(serverName.textContent) === false) {
    alert(`No server found with name "${serverName.textContent}" found.`);
    window.location.href = "index.html";
}

const seed = await getSeed(serverName.textContent);
seedValue.textContent = seed;

let server = new Server(OnMessageFromClient, OnDataChannelOpen, OnDataChannelClose, OnUsernameRequestSuccess, OnUsernameRequestError, OnClientDisconnect);

startBtn.addEventListener('click', _ => startServer(serverName.textContent));
stopBtn.addEventListener('click', _ => stopServer());
sendBtn.addEventListener('click', _ => sendCommand());
document.getElementById("commandInput").addEventListener("keypress", e => {
    if (e.key === "Enter") {
        sendCommand();
    }
});

function startHTMLStart() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    browseBtn.disabled = true;
    saveBtn.disabled = false;
}

function stopHTMLStop() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;
    browseBtn.disabled = false;
    saveBtn.disabled = true;
}

async function startServer(serverId) {
    if (worldFileHandle === null) {
        alert("No server file selected.");
        return;
    }
    server.StartServer(serverId);
    serverName.textContent = serverId;
    showMessage("INFO", `Server "${serverId}" started. Waiting for clients to connect...`);
    startHTMLStart();
    await updateAutoSave();
}

async function stopServer() {
    if (!server.isRunning()) return;

    const save = confirm("Would you like to save the world before stopping the server?");

    if (save) {
        await saveFile();
    }

    server.StopServer();
    showMessage("INFO", `Server stopped.`);
    stopHTMLStop();
    await updateAutoSave();
}

function OnMessageFromClient(clientId, msgObj) {
    const username = server.GetUsername(clientId);
    if (msgObj.type === "chat-message") {
        showMessage(msgObj.from, msgObj.value);
    } else {
        showMessage(username, JSON.stringify(msgObj));
    }

    // echo message back to all other clients (not to the sender client)
    const msgStr = JSON.stringify(msgObj);
    for (const [otherId, p] of server.peers) {
        if (otherId !== clientId && p.dataChannel && p.dataChannel.readyState === "open") {
            console.log(`Sending message to client ${otherId}: ${msgStr}`);
            p.dataChannel.send(msgStr);
        }
    }
}

function OnDataChannelOpen(clientId) {
    showMessage("INFO", `Data channel with client ${clientId} is open`);
    startHTMLStart();
    saveBtn.disabled = false;
}

function OnDataChannelClose(clientId) {
    showMessage("INFO", `Data channel with client ${clientId} is closed`);
    
    if (server.usernames.size === 0) {
        saveBtn.disabled = true;
        stopHTMLStop();
    }
    playersOnline.innerText = server.usernames.size;
}

function OnUsernameRequestSuccess(clientId, username) {
    showMessage("INFO", `Client ${clientId} set username to ${username}`);
    playerSelect.append(new Option(username));
    
    const playerDiv = document.createElement("div");
    playerDiv.textContent = username;
    playerDiv.className = "player";
    playerDiv.id = `player-${clientId}`;

    playerList.appendChild(playerDiv);

    playersOnline.innerText = server.usernames.size;
}

function OnUsernameRequestError(clientId, username) {
    showMessage("ERROR", `Client ${clientId} attempted to set username to ${username}, but it is already taken.`);
}

function OnClientDisconnect(clientId, username) {
    showMessage("INFO", `Client ${clientId} with username ${username} has disconnected.`);

    playerList.removeChild(document.getElementById(`player-${clientId}`));
    
    let found = false;
    for (let i = 0; i < playerSelect.options.length; i++) {
        if (playerSelect.options[i].text === username) {
            playerSelect.remove(i);
            found = true;
            break;
        }
    }
    if (!found) {
        console.warn(`Failed to remove ${username} from player select dropdown: not found.`);
    }
}

function showMessage(from, message) {
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = `[${from}] ${message}`;

    consoleContainer.appendChild(line);
    consoleContainer.scrollTop = consoleContainer.scrollHeight;
}

function commandParser(message) {
    const [cmd, ...args] = message.split(" ");
    return { cmd, args };
}

function executeCommand(cmdInput) {
    const { cmd, args } = cmdInput;
    if (cmd == "/break-block") {
        const [x, y, z] = args;
        if (x === undefined || y === undefined || z === undefined) {
            showMessage("ERROR", "Invalid arguments for /break-block. Usage: /break-block <x> <y> <z>");
            return;
        }
        actionBreakBlock(x, y, z);
    } else if (cmd == "/set-block") {
        const [type, x, y, z] = args;
        if (x === undefined || y === undefined || z === undefined) {
            showMessage("ERROR", "Invalid arguments for /set-block. Usage: /set-block <type> <x> <y> <z>");
            return;
        }
        actionSetBlock(type, x, y, z);
    } else if (cmd == "/again") {
        if (lastCommand) {
            const lc = lastCommand;
            console.log("Executing last command: " + lc);
            messageInput.value = lastCommand;
            sendCommand();
            console.log("Executed last command: " + lc);
            lastCommand = lc;
        } else {
            showMessage("INFO", "No last command found.");
        }
    }
}

function sendCommand() {
    if (!messageInput.value.trim()) return;

    const message = messageInput.value;
    const target = playerSelect.value;
    
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = `[CMD -> ${target}] ${message}`;
    
    consoleContainer.appendChild(line);
    consoleContainer.scrollTop = consoleContainer.scrollHeight;

    console.log(message, message.startsWith("/"), message[0]);
    if (message.startsWith("/")) {
        console.log("Executing command");
        const cmd = commandParser(message);
        executeCommand(cmd);
    } else {
        const msgObj = { type: "chat-message", from: "SERVER", value: message };
        const msgStr = JSON.stringify(msgObj);
        
        if (target == "all") {
            server.SendMessageToAll(msgStr);
        } else {
            const clientId = server.getClientId(target);
            server.SendMessageToClient(clientId, msgStr);
        }
    }

    if (message.trim() !== "/again") {
        lastCommand = message;
    }
    messageInput.value = "";
}

document.getElementById("browseBtn").addEventListener("click", openWorldFile);
async function openWorldFile() {
    try {
        const [fileHandle] =
            await window.showOpenFilePicker({
                types: [{
                    description: "World File",
                    accept: {
                        "application/json": [".json"]
                    }
                }]
            });

        worldFileHandle = fileHandle;

        const file = await worldFileHandle.getFile();

        const text = await file.text();

        worldData = JSON.parse(text);

        const fileNameWithoutExtension = serverName.textContent;
        const fileNameExtension = ".mencwaft.world.json";
        const checkFileName = fileNameWithoutExtension + fileNameExtension;
        
        if (checkFileName !== file.name) {
            const result = confirm(`The file name "${file.name}" does not match the given server file "${checkFileName}". Do you want to continue?`);
            if (!result) {
                return;
            }
        }

        selectedFile.textContent = "✓ " + file.name;

        selectedFile.style.color = "#7CFC00";

        showMessage("INFO", "Loaded world file: " + file.name);
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error(err);

            showMessage("ERROR", "Failed to load world file.");
        }
    }
}

saveBtn.addEventListener("click", saveFile);

autoSaveSelect.addEventListener("change", updateAutoSave);

let autoSaveInterval = null;

async function updateAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }

    if (!server.isRunning()) return;

    const value = autoSaveSelect.value;

    if (value === "none") return;

    const minutes = parseInt(value);

    autoSaveInterval = setInterval(async () => {

        if (server.isRunning()) {
            await saveFile();
        }

    }, minutes * 60 * 1000);
}

async function saveFile() {
    if (!worldFileHandle) {
        showMessage("ERROR", "No world file loaded.");
        return;
    }

    showMessage("INFO", "Saving server file...");

    const writable = await worldFileHandle.createWritable();
    await writable.write(JSON.stringify(worldData, null, 2));
    await writable.close();

    showMessage("INFO","Server saved.");

    server.SendMessageToAll(JSON.stringify({ type: "server-saved" }));
}

window.addEventListener("beforeunload", (event) => {
    if (!server.isRunning()) return;
    event.preventDefault();
    event.returnValue = "";
});

// FUNCTIONS:

function actionBreakBlock(x, y, z) {
    const blockObject = {
        type: "air",
        x: x,
        y: y,
        z: z
    };

    worldData.blocks.push(blockObject);

    const msgObj = { type: "break-block", x: x, y: y, z: z };
    const msgStr = JSON.stringify(msgObj);
    server.SendMessageToAll(msgStr);
    showMessage("INFO", `Break block at ${x}, ${y}, ${z}`);
}

function actionSetBlock(type, x, y, z) {
    const blockObject = {
        type: type,
        x: x,
        y: y,
        z: z
    };

    worldData.blocks.push(blockObject);

    const msgObj = { type: "set-block", block: type, x: x, y: y, z: z };
    const msgStr = JSON.stringify(msgObj);
    server.SendMessageToAll(msgStr);
    showMessage("INFO", `Set block at ${x}, ${y}, ${z} to ${type}`);
}