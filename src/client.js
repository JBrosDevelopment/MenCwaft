import * as GAME from "./game.js";
import { Client, beforeUnloadHandler } from "./networking/client.js";
import { SETTINGS } from "./settings.js";
import { doesServerExist, getSeed } from "./networking/server.js";

const chatContainer = document.getElementById("chatContainer");
const chatInputContainer = document.getElementById("chatInputContainer");
const chatConsole = document.getElementById("chatConsole");
const chatInput = document.getElementById("chatInput");
const loadingScreen = document.getElementById("loadingScreen");
const loadingBarContainer = document.getElementById("loadingBarContainer");
const loadingServerName = document.getElementById("loadingServerName");
const loadingPlayerName = document.getElementById("loadingPlayerName");
const loadingTip = document.getElementById("loadingTip");
const loadingText = document.getElementById("loadingText");

let game = new GAME.Game();

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

loadingServerName.innerText = server_id;
loadingPlayerName.innerText = username;

if (!(await doesServerExist(server_id))) {
    alert(`Server with ID ${server_id} does not exist.`);
    window.location.href = "index.html";
}

let gameHasLoaded = false;
let chatOpen = false;
let consoleHideTimer = null;

let loadingTipInterval = null;

const loadingTips = [
    "Punching trees since forever...",
    "Definitely not spawning a creeper behind you.",
    "Mining straight down is always a great idea.",
    "Looking for diamonds...",
    "Feeding the cows...",
    "Trying not to anger the Enderman.",
    "Crafting another wooden pickaxe...",
    "Putting the lid back on the lava.",
    "Asking villagers for directions...",
    "Digging one more block...",
    "Planting suspicious amounts of wheat...",
    "Untangling the redstone...",
    "Teaching zombies how doors work...",
    "Waiting for the furnace...",
    "Counting chickens...",
    "Replacing the dirt you accidentally mined.",
    "Checking under every suspicious gravel block.",
    "Keeping creepers socially distant.",
    "Making sure the bed isn't occupied.",
    "Polishing the diamonds...",
    "Trying to remember where home is.",
    "Looking for the last missing sheep.",
    "Convincing skeletons to miss.",
    "Avoiding fall damage... probably.",
    "Wondering who left this giant hole.",
    "Searching every cave except the right one.",
    "Making another chest...",
    "Sorting the unsorted storage room...",
    "Building a dirt pillar to safety.",
    "Accidentally crafting buttons.",
    "Asking the pig for life advice.",
    "Waiting for the chunks to catch up.",
    "Pretending gold tools are useful.",
    "Checking if it's daytime yet.",
    "Running from spiders...",
    "Trying not to fall into lava.",
    "Looking for that one missing torch.",
    "Collecting blocks you'll never use.",
    "Protecting your precious dirt blocks.",
    "Generating blocky goodness..."
];

function startLoadingTips() {
    let current = Math.floor(Math.random() * loadingTips.length);;

    loadingTip.textContent = loadingTips[current];
    loadingTipInterval = setInterval(() => {
        let next = current;
        // Prevent the same tip from appearing twice in a row
        while (next === current) {
            next = Math.floor(Math.random() * loadingTips.length);
        }

        current = next;
        loadingTip.textContent = loadingTips[current];
    }, 5000);
}

function stopLoadingTips() {
    clearInterval(loadingTipInterval);
    loadingTipInterval = null;
}

startLoadingTips();

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

    if (!gameHasLoaded) {
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
    stopLoadingTips();
    loadingBarContainer.classList.add("visible");
    loadingText.textContent = "Loading game";
    startGame();
}

function onDataChannelClose() {
    showMessage("INFO", "Data channel is closed.");
    startLoadingTips();
    loadingBarContainer.classList.remove("visible");
    client.ConnectToServer(server_id, username);
    loadingText.textContent = "Waiting to connect";
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
        } else if (msgObj.type === "server-saved") {
            showMessage("INFO", "Server has been saved.");
        }
        else {
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

async function startGame() {
    game = GAME.init(username, false);
    game.OnPressO = (coord) => {
        showMessage("o", coord);
    }

    const seed = await getSeed(server_id);
    SETTINGS.SEED = seed;

    game.player.client = client;

    await new Promise(resolve => setTimeout(resolve, 2500));
    
    GAME.RenderFrame(performance.now(), game);
    setTimeout(() => {

        loadingScreen.classList.add("hidden");
        gameHasLoaded = true;

    }, 2500);
}