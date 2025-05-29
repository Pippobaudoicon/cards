const { createApp, ref, reactive, onMounted, onUnmounted } = Vue;

createApp({
    setup() {
        const pageTitle = ref('Card Game Room (Vue)');
        const message = reactive({ text: '', isError: false });

        const roomCreation = reactive({
            roomCode: '',
            passcode: ''
        });

        const roomJoin = reactive({
            roomCode: '',
            passcode: '',
            userId: ''
        });

        const game = reactive({
            isJoined: false,
            roomCode: '',
            userId: '',
            passcode: '',
            drawnCardInfo: '-',
            remainingCardsCount: '-',
            usersInRoom: [] // To store the list of users in the current room
        });

        const deckView = reactive({
            showFullDeck: false,
            cards: []
        });

        let socket = null;

        const connectWebSocket = () => {
            // Use wss:// for secure connections if your server is HTTPS
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            socket = new WebSocket(`${protocol}://${window.location.host}`);

            socket.onopen = () => {
                console.log('WebSocket connection established');
                // Authenticate WebSocket connection with the server
                if (game.isJoined && game.roomCode && game.userId) {
                    socket.send(JSON.stringify({
                        type: 'authenticate',
                        roomCode: game.roomCode,
                        userId: game.userId
                    }));
                }
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('WebSocket message received:', data);

                switch (data.type) {
                    case 'user_joined':
                        game.usersInRoom = data.users;
                        showMessage(`${data.userId} has joined the room.`);
                        break;
                    case 'user_left':
                        game.usersInRoom = data.users;
                        showMessage(`${data.userId} has left the room.`);
                        break;
                    case 'card_drawn':
                        game.drawnCardInfo = `${data.card.value} of ${data.card.suit} (drawn by ${data.userId})`;
                        game.remainingCardsCount = data.remainingCards;
                        // If the current user drew the card, the HTTP response would have already updated this.
                        // This ensures other users see the update.
                        if (data.userId !== game.userId) {
                            showMessage(`Card drawn by ${data.userId}.`);
                        }
                        deckView.showFullDeck = false;
                        break;
                    case 'deck_reshuffled':
                        game.remainingCardsCount = data.remainingCards;
                        game.drawnCardInfo = '-';
                        deckView.showFullDeck = false;
                        // Update local deck if needed, or rely on viewDeck to refresh
                        if (data.deck) { // If server sends the full deck
                            deckView.cards = data.deck;
                        }
                        showMessage(`Deck reshuffled by ${data.userId}.`);
                        break;
                    case 'error':
                        showMessage(data.message, true);
                        break;
                    default:
                        console.log('Unknown WebSocket message type:', data.type);
                }
            };

            socket.onclose = () => {
                console.log('WebSocket connection closed');
                showMessage('Disconnected from the server. Attempting to reconnect...', true);
                // Optional: Implement reconnection logic
                // setTimeout(connectWebSocket, 5000); // Reconnect after 5 seconds
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                showMessage('WebSocket connection error.', true);
            };
        };

        const showMessage = (txt, error = false) => {
            message.text = txt;
            message.isError = error;
            setTimeout(() => { message.text = ''; message.isError = false; }, 5000); // Clear message after 5s
        };

        const createRoom = async () => {
            if (!roomCreation.roomCode || !roomCreation.passcode) {
                showMessage('Room code and passcode are required to create a room.', true);
                return;
            }
            try {
                const response = await fetch('/create-room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(roomCreation)
                });
                const data = await response.json();
                if (response.ok) {
                    showMessage(`Room "${data.roomCode}" created successfully. You can now join it.`);
                    roomCreation.roomCode = '';
                    roomCreation.passcode = '';
                } else {
                    showMessage(data.error || 'Failed to create room.', true);
                }
            } catch (err) {
                showMessage('Error creating room: ' + err.message, true);
            }
        };

        const joinRoom = async () => {
            if (!roomJoin.roomCode || !roomJoin.passcode || !roomJoin.userId) {
                showMessage('Room code, passcode, and User ID are required to join.', true);
                return;
            }
            try {
                const response = await fetch('/join-room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(roomJoin)
                });
                const data = await response.json();
                if (response.ok) {
                    game.isJoined = true;
                    game.roomCode = roomJoin.roomCode;
                    game.userId = roomJoin.userId;
                    game.passcode = roomJoin.passcode;
                    game.remainingCardsCount = data.deck.length;
                    game.usersInRoom = data.users || []; // Initialize users in room
                    game.drawnCardInfo = '-';
                    deckView.showFullDeck = false;
                    showMessage(data.message);
                    connectWebSocket(); // Establish WebSocket connection after joining
                } else {
                    showMessage(data.error || 'Failed to join room.', true);
                }
            } catch (err) {
                showMessage('Error joining room: ' + err.message, true);
            }
        };

        const drawCard = async () => {
            try {
                const response = await fetch('/draw-card', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomCode: game.roomCode, userId: game.userId })
                });
                const data = await response.json(); // HTTP response for the user who drew
                if (response.ok) {
                    // The WebSocket broadcast will update for everyone, including the drawer.
                    // So, we can minimize direct update here or let WebSocket handle it for consistency.
                    // game.drawnCardInfo = `${data.card.value} of ${data.card.suit}`;
                    // game.remainingCardsCount = data.remainingCards;
                    // deckView.showFullDeck = false;
                    showMessage('You drew a card. Others will be notified.');
                } else {
                    showMessage(data.error || 'Failed to draw card.', true);
                }
            } catch (err) {
                showMessage('Error drawing card: ' + err.message, true);
            }
        };

        const reshuffleDeck = async () => {
            try {
                const response = await fetch('/reshuffle-deck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomCode: game.roomCode, userId: game.userId })
                });
                const data = await response.json(); // HTTP response for the user who reshuffled
                if (response.ok) {
                    // WebSocket broadcast will handle UI updates for all clients.
                    // game.remainingCardsCount = data.deck.length;
                    // game.drawnCardInfo = '-';
                    // deckView.showFullDeck = false;
                    showMessage('You reshuffled the deck. Others will be notified.');
                } else {
                    showMessage(data.error || 'Failed to reshuffle deck.', true);
                }
            } catch (err) {
                showMessage('Error reshuffling deck: ' + err.message, true);
            }
        };

        const viewDeck = async () => {
            try {
                const response = await fetch(`/view-deck/${game.roomCode}/${game.userId}`);
                const data = await response.json();
                if (response.ok) {
                    deckView.cards = data.deck;
                    game.remainingCardsCount = data.remainingCards;
                    deckView.showFullDeck = true;
                    showMessage('Deck viewed successfully.');
                } else {
                    showMessage(data.error || 'Failed to view deck.', true);
                }
            } catch (err) {
                showMessage('Error viewing deck: ' + err.message, true);
            }
        };

        onMounted(() => {
            // If already in a game (e.g. page refresh and state restored from localStorage - not implemented here)
            // one might want to automatically connect WebSocket.
            // For now, WebSocket connects upon joining a room.
        });

        onUnmounted(() => {
            if (socket) {
                socket.close();
            }
        });

        return {
            pageTitle,
            message,
            roomCreation,
            roomJoin,
            game,
            deckView,
            createRoom,
            joinRoom,
            drawCard,
            reshuffleDeck,
            viewDeck
        };
    }
}).mount('#app');
