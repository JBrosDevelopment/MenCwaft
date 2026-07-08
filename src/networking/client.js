import { db } from "./firebase-config.js";
import {
  doc, setDoc, collection, addDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ICE_CONFIG = {
    iceServers: [
      { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }
    ]
};

function logMessage(from, message) {
    console.log(`[${from}]: ${message}`);
}

class Client {
    constructor(onMessageFromServer, onDataChannelOpen, onDataChannelClose) {
        this.pc = null;
        this.dataChannel = null;
        this.clientId = null;
        this.answerUnsub = null;
        this.serverCandidatesUnsub = null;
        this.username = null;
        this.OnMessageFromServer = onMessageFromServer;
        this.OnDataChannelOpen = onDataChannelOpen;
        this.OnDataChannelClose = onDataChannelClose;
    }

    async ConnectToServer(serverId, username) {
        if (serverId === "") {
            alert("Please enter a server ID");
            return;
        }
    
        this.clientId = Math.random().toString(36).substring(2, 10);
        this.pc = new RTCPeerConnection(ICE_CONFIG);
        this.username = username;
    
        // create data channel (caller)
        this.dataChannel = this.pc.createDataChannel("chat");
        this.dataChannel.onopen = () => {
            logMessage("INFO", "Data channel open");
            
            // send username to server
            const request = {
                type: "username-request",
                value: username
            }
            const requestStr = JSON.stringify(request);
            this.dataChannel.send(requestStr);
    
            if (this.OnDataChannelOpen) this.OnDataChannelOpen();
        }

        this.dataChannel.onmessage = (evt) => {
            logMessage("RECIEVED FROM SERVER", evt.data);

            try {
                const msgObj = JSON.parse(evt.data);
                if (msgObj.type === "error-username-request") {
                    alert("Username rejected by server: " + msgObj.value);
                    this.username = null;
                    this.dataChannel.close();
                }
            } catch (e) {
                logMessage("ERROR", `Failed to parse message from server: ${evt.data}`);
            }
            
            if (this.OnMessageFromServer) {
                this.OnMessageFromServer(evt);
            }
        }
    
        this.dataChannel.onclose = () => {
            logMessage("INFO", "Data channel closed");
            this.cleanupClient();

            if (this.OnDataChannelClose) this.OnDataChannelClose();
        };
    
        // send local ICE candidates to Firestore
        const clientCandidatesCol = collection(db, "servers", serverId, "offers", this.clientId, "clientCandidates");
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(clientCandidatesCol, { c: JSON.stringify(event.candidate), ts: serverTimestamp() });
            }
        };
    
        // create and store offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
    
        const offerDocRef = doc(db, "servers", serverId, "offers", this.clientId);
        await setDoc(offerDocRef, { sdp: JSON.stringify(this.pc.localDescription), username, ts: serverTimestamp() });
    
        // listen for answer doc
        const answerDocRef = doc(db, "servers", serverId, "answers", this.clientId);
        this.answerUnsub = onSnapshot(answerDocRef, async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (!data || !data.sdp) return;
            const answer = JSON.parse(data.sdp);
            await this.pc.setRemoteDescription(answer);
        });
    
        // listen for server ICE candidates (server -> client)
        const serverCandidatesCol = collection(db, "servers", serverId, "answers", this.clientId, "serverCandidates");
        this.serverCandidatesUnsub = onSnapshot(serverCandidatesCol, (snap) => {
            snap.docChanges().forEach(async change => {
                if (change.type === "added") {
                    const cand = JSON.parse(change.doc.data().c);
                    try { await this.pc.addIceCandidate(cand); } catch(e) { console.warn(e); }
                }
            });
        });
    
        logMessage("INFO", "Connect initiated to server: " + serverId);
    }

    DisconnectFromServer() {
        if (this.dataChannel && this.dataChannel.readyState === "open") {
            const disconnectMsg = JSON.stringify({ type: 'client-disconnect', id: this.clientId, username: this.username });
            this.dataChannel.send(disconnectMsg);
            this.dataChannel.close();
        }
        this.cleanupClient();
    }

    sendMessage(message) {
        if (!this.dataChannel || this.dataChannel.readyState !== "open") {
            logMessage("ERROR", "Not connected / data channel not open");
            return;
        }
        const msgObj = { type: "chat-message", from: this.username, value: message };
        this.dataChannel.send(JSON.stringify(msgObj));
        logMessage("ME", message);
    }
    
    sendObject(obj) {
        if (!this.dataChannel || this.dataChannel.readyState !== "open") {
            logMessage("ERROR", "Not connected / data channel not open");
            return;
        }
        this.dataChannel.send(JSON.stringify(obj));
        logMessage("ME", JSON.stringify(obj));
    }

    cleanupClient() {
        try { if (this.answerUnsub) this.answerUnsub(); } catch {}
        try { if (this.serverCandidatesUnsub) this.serverCandidatesUnsub(); } catch {}
        try { if (this.pc) this.pc.close(); } catch {}
        this.answerUnsub = null;
        this.serverCandidatesUnsub = null;
        this.pc = null;
        this.dataChannel = null;
    }
}

function beforeUnloadHandler(client) {
    try {
        if (client.dataChannel && client.dataChannel.readyState === 'open') {
            client.dataChannel.send(JSON.stringify({ type: 'client-disconnect', id: client.clientId, username: client.username }));
            client.dataChannel.close();
        }
    } catch {}
    try {
        // best-effort delete of the offer doc so server can notice quickly
        if (client.clientId && server_id.value) {
            const offerDocRef = doc(db, "servers", server_id.value, "offers", client.clientId);
            deleteDoc(offerDocRef).catch(() => {});
        }
    } catch {}
    client.DisconnectFromServer();
}

export { Client, beforeUnloadHandler };