import { db } from "./firebase-config.js";
import {
  doc, setDoc, collection, addDoc, getDoc, getDocs, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ICE_CONFIG = {
    iceServers: [
        {
            urls: [
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
            ],
        }
    ]
};

function logMessage(from, message) {
    console.log(`[${from}]: ${message}`);
}

class Server {
    constructor(onMessageFromClient, ondatachannelOpen, ondatachannelClose, onUsernameRequestSuccess, onUsernameRequestError, onClientDisconnect) {
        this.offerListenerUnsub = null;
        this.peers = new Map(); // clientId => { pc, dataChannel, subs }
        this.usernames = new Map(); // clientId => username (optional, for display purposes)
        this.serverId = null;
        this.OnMessageFromClient = onMessageFromClient;
        this.OnDataChannelOpen = ondatachannelOpen;
        this.OnDataChannelClose = ondatachannelClose;
        this.OnUsernameRequestSuccess = onUsernameRequestSuccess;
        this.OnUsernameRequestError = onUsernameRequestError;
        this.onClientDisconnect = onClientDisconnect;
    }

    async StartServer(serverId) {
        if (serverId === "") {
            alert("Please enter a server ID");
            return;
        }
        logMessage("INFO", "Initializing Server with ID: " + serverId);

        const offersCol = collection(db, "servers", serverId, "offers");
        this.offerListenerUnsub = onSnapshot(offersCol, async (snap) => {

            logMessage("INFO", "Waiting for users to connect before starting...");
            snap.docChanges().forEach(async change => {
                if (change.type !== "added") return;
                const clientId = change.doc.id;
                const data = change.doc.data();
                if (!data || !data.sdp) return;
                if (this.peers.has(clientId)) return; // already handled

                this.serverId = serverId;
                this.handleOffer(serverId, clientId, data);
            });
        });
    }

    async handleOffer(serverId, clientId, offerData) {
        const pc = new RTCPeerConnection(ICE_CONFIG);
        const state = { pc, dataChannel: null, unsubClientCandidates: null };

        // when client creates datachannel, server receives it here
        pc.ondatachannel = (ev) => {
            const ch = ev.channel;
            state.dataChannel = ch;
            ch.onmessage = (evt) => {
                this.RecievedMessage(clientId, evt.data, ch);
            }

            ch.onclose = () => {
                logMessage("INFO", `Data channel closed for ${clientId}`);
                this.cleanupPeer(clientId, "datachannel closed");

                if (this.OnDataChannelClose) this.OnDataChannelClose(clientId);
            };

            ch.onopen = () => {
                logMessage("INFO", `Data channel open for ${clientId}`);

                if (this.OnDataChannelOpen) this.OnDataChannelOpen(clientId);
            };
        };

        // watch connection / ICE states to detect disconnects
        pc.onconnectionstatechange = () => {
            const s = pc.connectionState;
            logMessage("DEBUG", `PC connectionState for ${clientId}: ${s}`);
            if (s === "disconnected" || s === "failed" || s === "closed") {
                this.cleanupPeer(clientId, `connectionState ${s}`);
            }
        };
        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            logMessage("DEBUG", `PC ICE state for ${clientId}: ${s}`);
            if (s === "disconnected" || s === "failed" || s === "closed") {
                this.cleanupPeer(clientId, `iceConnectionState ${s}`);
            }
        };

        // collect server ICE candidates and write them
        const serverCandidatesCol = collection(db, "servers", serverId, "answers", clientId, "serverCandidates");
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(serverCandidatesCol, { c: JSON.stringify(event.candidate), ts: serverTimestamp() });
            }
        };

        // set remote description (offer)
        const offer = JSON.parse(offerData.sdp);
        await pc.setRemoteDescription(offer);

        // also listen for client's ICE candidates
        const clientCandidatesCol = collection(db, "servers", serverId, "offers", clientId, "clientCandidates");
        const unsub = onSnapshot(clientCandidatesCol, (snap) => {
            snap.docChanges().forEach(async change => {
                if (change.type === "added") {
                    const cand = JSON.parse(change.doc.data().c);
                    try { await pc.addIceCandidate(cand); } catch(e) { console.warn(e); }
                }
            });
        });
        state.unsubClientCandidates = unsub;

        // create answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // write answer document
        const answerDocRef = doc(db, "servers", serverId, "answers", clientId);
        await setDoc(answerDocRef, { sdp: JSON.stringify(pc.localDescription), ts: serverTimestamp() });

        // store peer
        this.peers.set(clientId, state);
        logMessage("INFO", `Answered client ${clientId}`);
    }

    cleanupPeer(clientId, reason) {
        const state = this.peers.get(clientId);
        if (!state) return;
        logMessage("INFO", `Cleaning up peer ${clientId}: ${reason}`);
        try {
            if (state.unsubClientCandidates) state.unsubClientCandidates();
        } catch (e) { /* ignore */ }
        try { state.pc.close(); } catch (e) { /* ignore */ }
        try {
            if (state.dataChannel && state.dataChannel.readyState !== "closed") state.dataChannel.close();
        } catch(e) {}
        this.peers.delete(clientId);

        // broadcast a leave message to remaining clients
        const name = state.username || clientId;
        for (const [, p] of this.peers) {
            if (p.dataChannel && p.dataChannel.readyState === "open") {
                p.dataChannel.send(JSON.stringify({ type: "user-left", id: clientId, username: name }));
            }
        }
        this.usernames.delete(clientId);

        const answerDocRef = doc(db, "servers", this.serverId, "answers", clientId);
        setTimeout(() => { /* best-effort delete; uncomment to enable deletion */
            answerDocRef.delete?.().catch(()=>{});
        }, 0);
    }
    
    async StopServer() {
        // remove Firestore listener
        if (this.offerListenerUnsub) this.offerListenerUnsub();
        this.offerListenerUnsub = null;

        // close all peer connections
        for (const [clientId, s] of this.peers) {
            try {
                if (s.unsubClientCandidates) s.unsubClientCandidates();
            } catch {}
            try { s.pc.close(); } catch {}
        }
        this.peers.clear();
        this.usernames.clear();

        logMessage("INFO", "Server stopped");
    }

    RecievedMessage(clientId, message, ch) {
        let msgObj;
        try {
            msgObj = JSON.parse(message);
        } catch (e) {
            logMessage("ERROR", `Failed to parse message from ${clientId}: ${message}`);
            return;
        }
        if (msgObj.type === "username-request") {
            const username = msgObj.value;
            // check if username is already taken
            if ([...this.usernames.values()].includes(username)) {
                logMessage("ERROR", `Username ${username} is already taken. Client ${clientId} cannot use it.`);
                ch.send(JSON.stringify({ type: "error-username-request", value: username }));
                if (this.OnUsernameRequestError) this.OnUsernameRequestError(clientId, username);
                return;
            }
            logMessage("INFO", `Client ${clientId} set username to ${username}`);
            this.usernames.set(clientId, username);
            if (this.OnUsernameRequestSuccess) this.OnUsernameRequestSuccess(clientId, username);
            return;
        }
        else if (msgObj.type === "chat-message") {
            const username = this.usernames.get(clientId) || clientId;
            logMessage(username, msgObj.value);
            // broadcast to other clients
            for (const [otherId, p] of this.peers) {
                if (otherId !== clientId && p.dataChannel && p.dataChannel.readyState === "open") {
                    p.dataChannel.send(JSON.stringify({ type: "chat-message", from: username, value: msgObj.value }));
                }
            }
        }
        else if (msgObj.type === "client-disconnect") {
            logMessage("INFO", `Client ${clientId} requested disconnect.`);
            if (this.onClientDisconnect) this.onClientDisconnect(clientId, msgObj.username);
            this.cleanupPeer(clientId, "client requested disconnect");
            return;
        }
        

        if (this.OnMessageFromClient) this.OnMessageFromClient(clientId, msgObj);
    }

    GetUsername(clientId) {
        return this.usernames.get(clientId) || clientId;
    }

    SendMessageToClient(clientId, message) {
        logMessage("INFO", `Sending message to ${clientId}: ${message}`);
        const state = this.peers.get(clientId);
        logMessage("DEBUG", "1");
        if (!state) return;
        logMessage("DEBUG", "2");
        state.dataChannel.send(message);
        logMessage("DEBUG", "3");
    }

    SendMessageToAll(message) {
        for (const [clientId, s] of this.peers) {
            if (s.dataChannel && s.dataChannel.readyState === "open") {
                s.dataChannel.send(message);
            }
        }
    }
}

export async function doesServerExist(serverId) {
    const offers = await getDocs(
        collection(db, "servers", serverId, "offers")
    );

    if (!offers.empty) {
        return true;
    }

    const answers = await getDocs(
        collection(db, "servers", serverId, "answers")
    );

    if (!answers.empty) {
        return true;
    }

    // check if seed document exists
    const serverDocRef = doc(db, "servers", serverId);
    const serverDocSnap = await getDoc(serverDocRef);
    
    if (serverDocSnap.exists()) {
        return true;
    }

    // check if created date is within last 24 hours (to account for recently created servers that haven't received offers/answers yet)
    if (serverDocSnap.exists()) {
        const data = serverDocSnap.data();
        if (data.createdAt && data.createdAt.toDate) {
            const createdAt = data.createdAt.toDate();
            const now = new Date();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);
            if (diffHours < 24) {
                return true;
            }
        }
    }

    return false;
}

export async function createServer(serverId, seed) {
    if (await doesServerExist(serverId)) {
        console.error("Server with ID " + serverId + " already exists");
        return null;
    }
    if (seed === undefined || seed === "") {
        console.error("Seed is required to create a new server");
        return null;
    }
    // create a firestore document for this server storing the seed
    const serverDocRef = doc(db, "servers", serverId);
    await setDoc(serverDocRef, { seed, createdAt: serverTimestamp() }).catch(e => {
        console.error("Failed to create server document:", e);
    });
}

export async function getSeed(serverId) {
    if (await doesServerExist(serverId) === false) {
        console.error("Server with ID " + serverId + " doesn't exists");
        return null;
    }
    const serverDocRef = doc(db, "servers", serverId);
    return await getDoc(serverDocRef).then(docSnap => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.seed;
        } else {
            console.error("No server document found for ID:", serverId);
            return null;
        }
    });
}

export { Server };