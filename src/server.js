import { Server, doesServerExist, getSeed } from "./networking/server.js";

const serverName = document.getElementById('serverName');
const seedValue = document.getElementById('seedValue');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const messageInput = document.getElementById('commandInput');
const sendBtn = document.getElementById('sendBtn');
const consoleContainer = document.getElementById('consoleContainer');
const playerSelect = document.getElementById('playerSelect');

serverName.textContent = window.location.search ? decodeURIComponent(window.location.search.split('=')[1]) : "Unnamed Server";
if (await doesServerExist(serverName.textContent) === false) {
    alert(`No server found with name "${serverName.textContent}" found.`);
    window.location.href = "index.html";
}

const seed = await getSeed(serverName.textContent);
seedValue.textContent = seed;

let server = new Server(OnMessageFromClient, OnDataChannelOpen, OnDataChannelClose, OnUsernameRequestSuccess, OnUsernameRequestError, OnClientDisconnect);

startServer(serverName.textContent);

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
}

function stopHTMLStop() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;
}

function startServer(serverId) {
    server.StartServer(serverId);
    serverName.textContent = serverId;
    showMessage("INFO", `Server "${serverId}" started. Waiting for clients to connect...`);
    startHTMLStart();
}

function stopServer() {
    server.StopServer();
    showMessage("INFO", `Server stopped.`);
    stopHTMLStop();
}

function OnMessageFromClient(clientId, msgObj) {
    if (msgObj.type === "chat-message") {
        showMessage(msgObj.from, msgObj.value);
    } else {
        const username = server.GetUsername(clientId);
        showMessage(username, JSON.stringify(msgObj));
    }
}

function OnDataChannelOpen(clientId) {
    showMessage("INFO", `Data channel with client ${clientId} is open`);
    startHTMLStart();
}

function OnDataChannelClose(clientId) {
    showMessage("INFO", `Data channel with client ${clientId} is closed`);
    stopHTMLStop();
}

function OnUsernameRequestSuccess(clientId, username) {
    showMessage("INFO", `Client ${clientId} set username to ${username}`);
    playerSelect.append(new Option(username));
}

function OnUsernameRequestError(clientId, username) {
    showMessage("ERROR", `Client ${clientId} attempted to set username to ${username}, but it is already taken.`);
}

function OnClientDisconnect(clientId, username) {
    showMessage("INFO", `Client ${clientId} with username ${username} has disconnected.`);
    
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

function sendCommand() {
    if (!messageInput.value.trim()) return;

    const message = messageInput.value;
    const msgObj = { type: "chat-message", from: "SERVER", value: message };
    const msgStr = JSON.stringify(msgObj);
    server.SendMessageToAll(msgStr);
    messageInput.value = "";

    const target = playerSelect.value;
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = `[CMD -> ${target}] ${message}`;

    consoleContainer.appendChild(line);
    consoleContainer.scrollTop = consoleContainer.scrollHeight;

    messageInput.value = "";
}