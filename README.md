# Card Game Server

A simple Node.js application that allows users to create and join card game rooms, draw cards from a shared deck, and reshuffle the deck.

## Prerequisites

- Node.js (v14.x or later recommended)
- npm (usually comes with Node.js)

## Installation

1.  **Clone the repository or download the files.**
2.  **Navigate to the project directory:**
    ```bash
    cd path/to/your/cards
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the Server

To start the server, run the following command in the project directory:

```bash
npm start
```

By default, the server will run on `http://localhost:3000`.

## API Endpoints

The server exposes the following RESTful API endpoints:

### 1. Create a New Room

*   **URL:** `/create-room`
*   **Method:** `POST`
*   **Body (JSON):**
    ```json
    {
        "roomCode": "your_room_code",
        "passcode": "your_passcode"
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
        "message": "Room created successfully.",
        "roomCode": "your_room_code"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If `roomCode` or `passcode` is missing.
    *   `400 Bad Request`: If a room with the given `roomCode` already exists.

### 2. Join an Existing Room

*   **URL:** `/join-room`
*   **Method:** `POST`
*   **Body (JSON):**
    ```json
    {
        "roomCode": "existing_room_code",
        "passcode": "room_passcode",
        "userId": "your_unique_user_id"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
        "message": "User your_unique_user_id joined room existing_room_code.",
        "deck": [
            // Array of card objects representing the current state of the deck
            { "suit": "denari", "value": "1" },
            { "suit": "coppe", "value": "alfiere" }
            // ... and so on for all 40 cards initially, or fewer if cards have been drawn
        ]
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If `roomCode`, `passcode`, or `userId` is missing.
    *   `404 Not Found`: If the room with the given `roomCode` does not exist.
    *   `401 Unauthorized`: If the provided `passcode` is incorrect.
    *   `400 Bad Request`: If the `userId` is already in the room.

### 3. Draw a Card

*   **URL:** `/draw-card`
*   **Method:** `POST`
*   **Body (JSON):**
    ```json
    {
        "roomCode": "existing_room_code",
        "userId": "your_unique_user_id"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
        "card": { "suit": "bastoni", "value": "rè" }, // The card drawn
        "remainingCards": 39 // Number of cards left in the deck
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If `roomCode` or `userId` is missing.
    *   `404 Not Found`: If the room does not exist.
    *   `403 Forbidden`: If the `userId` is not part of the specified room.
    *   `400 Bad Request`: If the deck is empty.

### 4. Reshuffle the Deck

*   **URL:** `/reshuffle-deck`
*   **Method:** `POST`
*   **Body (JSON):**
    ```json
    {
        "roomCode": "existing_room_code",
        "userId": "your_unique_user_id"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
        "message": "Deck reshuffled successfully.",
        "deck": [
            // Array of 40 card objects, newly shuffled
        ]
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If `roomCode` or `userId` is missing.
    *   `404 Not Found`: If the room does not exist.
    *   `403 Forbidden`: If the `userId` is not part of the specified room.

### 5. View the Deck

*   **URL:** `/view-deck/:roomCode/:userId`
*   **Method:** `GET`
*   **URL Parameters:**
    *   `roomCode`: The code of the room.
    *   `userId`: Your unique user ID.
*   **Success Response (200 OK):**
    ```json
    {
        "deck": [
            // Array of card objects representing the current state of the deck
        ],
        "remainingCards": 40 // Or the current number of cards in the deck
    }
    ```
*   **Error Responses:**
    *   `404 Not Found`: If the room does not exist.
    *   `403 Forbidden`: If the `userId` is not authorized to view the deck (i.e., not in the room).

## Card Structure

A card object has the following structure:

```json
{
    "suit": "suit_name", // e.g., "denari", "coppe", "bastoni", "spade"
    "value": "card_value" // e.g., "1", "7", "alfiere", "regina", "rè"
}
```

Feel free to contribute or suggest improvements!
