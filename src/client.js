import * as GAME from "./game.js";
import { Client, beforeUnloadHandler } from "./networking/client.js";

const chatContainer = document.getElementById("chatContainer");
const chatInputContainer = document.getElementById("chatInputContainer");
const chatConsole = document.getElementById("chatConsole");
const chatInput = document.getElementById("chatInput");

function getParamFromUrl(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const server_id = getParamFromUrl('server');
const username = getParamFromUrl('username');

if (!server_id || !username) {
    alert("Missing server or username parameter in the URL.");
    throw new Error("Missing server or username parameter in the URL.");
}

let game = GAME.init(username, false); // { scene, renderer, dayCycle, chunkManager, player, blockOutlineData, isSinglePlayerGame, isMenuVisible }

let chatOpen = false;
let consoleHideTimer = null;

function showConsole() {

    chatContainer.classList.add("visible");

    clearTimeout(consoleHideTimer);

    consoleHideTimer = setTimeout(() => {

        if (!chatOpen) {
            chatContainer.classList.remove("visible");
        }

    }, 5000);
}

document.addEventListener("keydown", (e) => {
    if (e.target !== document.body && e.target !== chatInput) {
        return;
    }

    if (e.key === "Enter") {
        e.preventDefault();
        if (!chatOpen) {
            chatOpen = true;
            chatContainer.classList.add("visible");
            chatInputContainer.classList.add("open");
            game.isMenuVisible = true;
            clearTimeout(consoleHideTimer);
            chatInput.focus();
        } else {
            if (chatInput.value.trim() !== "") {
                sendMessage();
            }
            chatOpen = false;
            chatInputContainer.classList.remove("open");
            showConsole(); // keeps the console visible for another 4 seconds
            chatInputContainer.classList.remove("open");
            chatInput.blur();
            game.isMenuVisible = false;
        }
    }

    if (e.key === "Escape" && chatOpen) {
        chatOpen = false;
        chatInputContainer.classList.remove("open");
        showConsole(); // keeps the console visible for another 4 seconds
        chatInputContainer.classList.remove("open");
        chatInput.blur();
        game.isMenuVisible = false;
    }
});

let client = new Client(OnMessageFromServer, onDataChannelOpen, onDataChannelClose);

client.ConnectToServer(server_id, username);

window.addEventListener('beforeunload', () => beforeUnloadHandler(client));

function onDataChannelOpen() {
    showMessage("INFO", "Data channel is open! You can now send messages.");
}

function onDataChannelClose() {
    showMessage("INFO", "Data channel is closed.");
}

function sendMessage() {
    const message = chatInput.value;
    if (message.trim() === "") return;
    client.sendMessage(message);
    chatInput.value = "";
    showMessage("ME", message);
}

function OnMessageFromServer(evt) {
    try {
        const msgObj = JSON.parse(evt.data);
        console.log(msgObj);
        if (msgObj.type === "chat-message") {
            showMessage(msgObj.from, msgObj.value);
        } else if (msgObj.type === "user-left") {
            showMessage("INFO", `User ${msgObj.username} (${msgObj.id}) left the server`);
        } else if (msgObj.type === "set-block") {
            game.chunkManager.setBlock(msgObj.x, msgObj.y, msgObj.z, msgObj.block);
        } else if (msgObj.type === "break-block") {
            game.chunkManager.setBlock(msgObj.x, msgObj.y, msgObj.z, "air");
        } else {
            showMessage("INFO", `Received unknown message type from server: ${evt.data}`);
        }
    } catch (e) {
        showMessage("ERROR", `Failed to parse message from server: ${evt.data}`);
    }
}

function showMessage(from, message) {
    let text = "[" + from + "]: " + message + '\n';

    const line = document.createElement("div");

    line.className = "console-line";
    line.textContent = text;

    chatConsole.appendChild(line);
    chatConsole.scrollTop = chatConsole.scrollHeight;

    showConsole();
}

GAME.RenderFrame(performance.now(), game);