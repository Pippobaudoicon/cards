const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3030;
const rooms = {};

function broadcast(roomCode, data) {
    if (rooms[roomCode] && rooms[roomCode].clients) {
        rooms[roomCode].clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

function getUsersInRoom(roomCode) {
    return rooms[roomCode] && rooms[roomCode].users ? rooms[roomCode].users.map(u => u.userId) : [];
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'authenticate' && parsedMessage.roomCode && parsedMessage.userId) {
                const room = rooms[parsedMessage.roomCode];
                if (room && room.users.find(u => u.userId === parsedMessage.userId)) {
                    ws.userId = parsedMessage.userId;
                    ws.roomCode = parsedMessage.roomCode;
                    if (!room.clients) {
                        room.clients = new Set();
                    }
                    room.clients.add(ws);
                    console.log(`WebSocket authenticated for user ${ws.userId} in room ${ws.roomCode}`);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed or room/user not found for WebSocket.' }));
                    ws.terminate();
                }
            }
        } catch (e) {
            console.error('Failed to parse message or invalid message format:', e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
        }
    });

    ws.on('close', () => {
        if (ws.userId && ws.roomCode && rooms[ws.roomCode]) {
            const room = rooms[ws.roomCode];
            const userId = ws.userId;
            const roomCode = ws.roomCode;

            if (room.clients) {
                room.clients.delete(ws);
            }

            const userIndex = room.users.findIndex(u => u.userId === userId);
            if (userIndex > -1) {
                room.users.splice(userIndex, 1);
                console.log(`User ${userId} removed from room ${roomCode} user list.`);

                const currentUsersInRoom = getUsersInRoom(roomCode);
                broadcast(roomCode, { 
                    type: 'user_left', 
                    userId: userId, 
                    users: currentUsersInRoom 
                });
            } else {
                console.log(`User ${userId} not found in room ${roomCode} user list upon disconnect.`);
            }
            
            console.log(`WebSocket disconnected for user ${userId} from room ${roomCode}. Active clients in room: ${room.clients ? room.clients.size : 0}. Users in room list: ${room.users.length}.`);
        } else {
            console.log('WebSocket disconnected for an unauthenticated or unassigned user.');
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for user ${ws.userId || 'Unknown'}:`, error);
    });
});

function createDeck() {
    const suits = ['denari', 'coppe', 'bastoni', 'spade'];
    const values = ['1', '2', '3', '4', '5', '6', '7', 'alfiere', 'regina', 'rè'];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.post('/create-room', (req, res) => {
    const { roomCode, passcode } = req.body;
    console.log(roomCode, passcode);
    if (!roomCode || !passcode) {
        return res.status(400).json({ error: 'Room code and passcode are required.' });
    }
    if (rooms[roomCode]) {
        return res.status(400).json({ error: 'Room already exists.' });
    }

    const deck = createDeck();
    shuffleDeck(deck);
    rooms[roomCode] = {
        passcode,
        deck,
        users: [],
        clients: new Set()
    };
    res.status(201).json({ message: 'Room created successfully.', roomCode });
});

app.post('/join-room', (req, res) => {
    const { roomCode, passcode, userId } = req.body;
    if (!roomCode || !passcode || !userId) {
        return res.status(400).json({ error: 'Room code, passcode, and user ID are required.' });
    }
    const room = rooms[roomCode];
    if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
    }
    if (room.passcode !== passcode) {
        return res.status(401).json({ error: 'Invalid passcode.' });
    }
    if (room.users.find(u => u.userId === userId)) {
        return res.status(400).json({ error: 'User already in room.' });
    }
    room.users.push({ userId }); 

    broadcast(roomCode, { type: 'user_joined', userId, users: getUsersInRoom(roomCode) });

    res.json({ message: `User ${userId} joined room ${roomCode}.`, deck: room.deck, users: getUsersInRoom(roomCode) });
});

app.post('/draw-card', (req, res) => {
    const { roomCode, userId } = req.body;
    if (!roomCode || !userId) {
        return res.status(400).json({ error: 'Room code and user ID are required.' });
    }
    const room = rooms[roomCode];
    if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
    }
    if (!room.users.find(u => u.userId === userId)) {
        return res.status(403).json({ error: 'User not in this room.' });
    }
    if (room.deck.length === 0) {
        return res.status(400).json({ error: 'Deck is empty. Reshuffle to continue.' });
    }
    const card = room.deck.pop();

    broadcast(roomCode, { 
        type: 'card_drawn', 
        userId, 
        card, 
        remainingCards: room.deck.length 
    });

    res.json({ card, remainingCards: room.deck.length });
});

app.post('/reshuffle-deck', (req, res) => {
    const { roomCode, userId } = req.body;
    if (!roomCode || !userId) {
        return res.status(400).json({ error: 'Room code and user ID are required.' });
    }
    const room = rooms[roomCode];
    if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
    }
    if (!room.users.find(u => u.userId === userId)) {
        return res.status(403).json({ error: 'User not in this room.' });
    }
    room.deck = createDeck();
    shuffleDeck(room.deck);

    broadcast(roomCode, { 
        type: 'deck_reshuffled', 
        userId, 
        deck: room.deck,
        remainingCards: room.deck.length
    });

    res.json({ message: 'Deck reshuffled successfully.', deck: room.deck });
});

app.get('/view-deck/:roomCode/:userId', (req, res) => {
    const { roomCode, userId } = req.params;
    const room = rooms[roomCode];
    if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
    }
    if (!room.users.find(u => u.userId === userId)) {
        return res.status(403).json({ error: 'User not authorized to view this deck.' });
    }
    res.json({ deck: room.deck, remainingCards: room.deck.length, users: getUsersInRoom(roomCode) });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} and accessible externally`);
});