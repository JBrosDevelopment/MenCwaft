import { doesServerExist, Server } from "./networking/server.js";

const server_id = document.getElementById('server_id');
const start_btn = document.getElementById('start_btn');
const stop_btn = document.getElementById('stop_btn');
const message_input = document.getElementById('message_input');
const send_btn = document.getElementById('send_btn');
const recieved = document.getElementById('recieved');


let server = new Server(OnMessageFromClient, OnDataChannelOpen, OnDataChannelClose);

start_btn.addEventListener('click', _ => server.StartServer(server_id.value));
stop_btn.addEventListener('click', _ => server.StopServer());
send_btn.addEventListener('click', _ => {
    const message = message_input.value;
    const msgObj = { type: "chat-message", from: "SERVER", value: message };
    const msgStr = JSON.stringify(msgObj);
    server.SendMessageToAll(msgStr);
    message_input.value = "";
    showMessage("ME", message);
});

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
    start_btn.disabled = true;
    stop_btn.disabled = false;
    message_input.disabled = false;
    send_btn.disabled = false;
}

function OnDataChannelClose(clientId) {
    showMessage("INFO", `Data channel with client ${clientId} is closed`);
    start_btn.disabled = false;
    stop_btn.disabled = true;
    message_input.disabled = true;
    send_btn.disabled = true;
}

function showMessage(from, message) {
    recieved.textContent += "[{" + from + "}]: " + message + '\n';
}


console.log(await doesServerExist("one1"));