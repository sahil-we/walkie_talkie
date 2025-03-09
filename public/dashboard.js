const socket = io();
let userId, userPin, userName;
let localStream;
let peerConnection;

// Fetch user info and friends on page load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/get-user");
        const data = await res.json();

        console.log("🟢 Logged-in User Data:", data);   
        userId = data.id;
        userPin = data.pin;
        userName = data.name;

        document.getElementById("userName").innerText = userName;
        document.getElementById("userPin").innerText = userPin;

        fetchFriends();
    } catch (error) {
        console.error("Error fetching user data:", error);
    }

    // Register user with their PIN
    socket.emit("register", { userPin });
    console.log("✅ Registered user with PIN:", userPin);

    // Send Friend Request
    document.getElementById("sendRequestBtn").addEventListener("click", async () => {
        const friendPin = document.getElementById("friendPinInput").value.trim();

        if (!friendPin) {
            alert("Please enter a friend's PIN!");
            return;
        }

        try {
            const res = await fetch("/request-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ friendPin }),
            });

            const data = await res.json();
            if (data.success) {
                alert("Friend request sent!");
            } else {
                alert("Friend request failed. User may not exist.");
            }
        } catch (error) {
            console.error("Error sending friend request:", error);
        }
    });

    // Listen for friend requests
    socket.on(`friend-request-${userId}`, (data) => {
        console.log(`📥 Friend request received from ${data.senderName} (${data.senderPin})`);
        if (confirm(`New friend request from ${data.senderName}. Accept?`)) {
            acceptFriendRequest(data);
        }
    });

    // Listen for friend acceptance
    socket.on(`friend-accepted-${userId}`, (data) => {
        alert(`${data.friendName} is now your friend!`);
        fetchFriends();
    });

    // Listen for incoming calls
    socket.on("incoming-call", async ({ senderPin }) => {
        console.log(`📞 Incoming call from ${senderPin}`);
        if (confirm(`Incoming call from ${senderPin}. Accept?`)) {
            await handleIncomingCall(senderPin);
        }
    });

    // Listen for call ended
    socket.on("call-ended", ({ senderPin }) => {
        console.log(`📵 Call ended by ${senderPin}`);
        stopTalking();
    });

    // WebRTC Signaling
    socket.on("offer", async ({ senderPin, offer }) => {
        console.log(`📨 Received offer from ${senderPin}`);
        await createPeerConnection(senderPin);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", { answer, senderPin });
    });

    socket.on("answer", async ({ answer }) => {
        console.log("📨 Received answer");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async ({ senderPin, candidate }) => {
        console.log("📨 Received ICE candidate");
        if (peerConnection && senderPin !== userPin) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
});

// Accept Friend Request
async function acceptFriendRequest(data) {
    try {
        const res = await fetch("/accept-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        const response = await res.json();
        if (response.success) {
            alert("Friend request accepted!");
            await fetchFriends(); // Ensure it waits for updated data
        }
    } catch (error) {
        console.error("Error accepting friend request:", error);
    }
}

// Fetch and display friends
async function fetchFriends() {
    try {
        const res = await fetch("/get-friends");
        const friends = await res.json();

        const friendsList = document.getElementById("friendsList");
        friendsList.innerHTML = ""; // Clear old list

        if (friends.length === 0) {
            friendsList.innerHTML = "<p>No friends added yet.</p>";
            return;
        }

        friends.forEach((friend) => {
            const friendItem = document.createElement("div");
            friendItem.classList.add("friend-item");
            friendItem.innerHTML = `
                <span>${friend.name} (${friend.pin})</span>
            `;

            // Walkie-talkie feature
            friendItem.addEventListener("mousedown", () => startTalking(friend.pin));
            friendItem.addEventListener("mouseup", () => stopTalking(friend.pin));
            friendItem.addEventListener("touchstart", () => startTalking(friend.pin)); // Mobile support
            friendItem.addEventListener("touchend", () => stopTalking(friend.pin)); // Mobile support

            friendsList.appendChild(friendItem);
        });
    } catch (error) {
        console.error("Error fetching friends:", error);
    }
}

// Start talking to a friend
async function startTalking(friendPin) {
    console.log(`🔊 Start talking to ${friendPin}`);
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await createPeerConnection(friendPin);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", { friendPin, offer });
    } catch (error) {
        console.error("Error starting talking:", error);
    }
}

// Stop talking
function stopTalking() {
    console.log("🔇 Stop talking");
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Handle incoming call
async function handleIncomingCall(senderPin) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await createPeerConnection(senderPin);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    } catch (error) {
        console.error("Error handling incoming call:", error);
    }
}

// Create a WebRTC peer connection
async function createPeerConnection(targetPin) {
    const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { friendPin: targetPin, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        const audio = document.createElement("audio");
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        document.body.appendChild(audio);
    };
}