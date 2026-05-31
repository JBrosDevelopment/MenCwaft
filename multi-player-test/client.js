import { Client, beforeUnloadHandler } from "./networking/client.js";

const server_id = document.getElementById('server_id');
const username_input = document.getElementById('username_input');
const connect_btn = document.getElementById('connect_btn');
const disconnect_btn = document.getElementById('disconnect_btn');
const input = document.getElementById('input');
const send_btn = document.getElementById('send_btn');
const recieved = document.getElementById('recieved');


let client = new Client(OnMessageFromServer, onDataChannelOpen, onDataChannelClose);

connect_btn.addEventListener('click', _ => client.ConnectToServer(server_id.value, username_input.value));
disconnect_btn.addEventListener('click', _ => client.DisconnectFromServer());
send_btn.addEventListener('click', _ => sendMessage());

window.addEventListener('beforeunload', () => beforeUnloadHandler(client));

function onDataChannelOpen() {
    showMessage("INFO", "Data channel is open! You can now send messages.");
    connect_btn.disabled = true;
    disconnect_btn.disabled = false;
    send_btn.disabled = false;
}

function onDataChannelClose() {
    showMessage("INFO", "Data channel is closed.");
    connect_btn.disabled = false;
    disconnect_btn.disabled = true;
    send_btn.disabled = true;
}

function sendMessage() {
    const message = input.value;
    if (message.trim() === "") return;
    client.sendMessage(message);
    input.value = "";
    showMessage("ME", message);
}

function OnMessageFromServer(evt) {
    try {
        const msgObj = JSON.parse(evt.data);
        if (msgObj.type === "chat-message") {
            showMessage(msgObj.from, msgObj.value);
        } else if (msgObj.type === "user-left") {
            showMessage("INFO", `User ${msgObj.username} (${msgObj.id}) left the server`);
        } else {
            showMessage("INFO", `Received unknown message type from server: ${evt.data}`);
        }
    } catch (e) {
        showMessage("ERROR", `Failed to parse message from server: ${evt.data}`);
    }
}

function showMessage(from, message) {
    recieved.textContent += "[{" + from + "}]: " + message + '\n';
}