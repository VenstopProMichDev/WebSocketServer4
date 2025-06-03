const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

/**
 * Структура rooms:
 *  {
 *    roomId1: [ { socket, playerId }, { socket, playerId }, ... ],
 *    roomId2: [ ... ],
 *    ...
 *  }
 */
let rooms = {};

server.on('connection', (socket) => {
    console.log('Новий клієнт підключився');

    const { roomId, playerId } = findOrCreateRoom(socket);

    // Надсилаємо гравцеві його ID (0–3)
    socket.send(JSON.stringify({
        type: 'PlayerId',
        data: playerId
    }));

    // Повідомляємо всіх у кімнаті, що зайшов новий гравець
    broadcastToRoom(roomId, {
        type: 'PlayerJoined',
        data: playerId
    });

    // Якщо в кімнаті вже 4 гравці — надсилаємо GameReady
    if (rooms[roomId].length === 4) {
        broadcastToRoom(roomId, {
            type: 'Message',
            data: 'GameReady'
        });
    }

    socket.on('message', (message) => {
        console.log(`Повідомлення від ${roomId}:`, message.toString());
        // Розсилаємо всім у кімнаті, крім відправника
        rooms[roomId].forEach(player => {
            if (player.socket !== socket && player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(message.toString());
            }
        });
    });

    socket.on('close', () => {
        // Знаходимо й видаляємо гравця з кімнати
        const playerIndex = rooms[roomId].findIndex(player => player.socket === socket);
        if (playerIndex === -1) return;

        const departedId = rooms[roomId][playerIndex].playerId;
        rooms[roomId].splice(playerIndex, 1);
        console.log(`Гравець ${departedId} покинув кімнату ${roomId}`);

        // Повідомляємо всіх, що цей гравець вийшов
        broadcastToRoom(roomId, {
            type: 'PlayerDisconnected',
            data: departedId
        });

        // Якщо кімната порожня — видаляємо її
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито`);
        }
    });
});

function findOrCreateRoom(socket) {
    // Знайти кімнату з місцем (менше 4 гравців)
    for (let roomId in rooms) {
        if (rooms[roomId].length < 4) {
            // Обчислюємо вільний playerId від 0 до 3
            const usedIds = rooms[roomId].map(p => p.playerId);
            let playerId = 0;
            while (usedIds.includes(playerId)) {
                playerId++;
            }
            rooms[roomId].push({ socket, playerId });
            console.log(`Гравець приєднався до кімнати ${roomId} як гравець ${playerId}`);
            return { roomId, playerId };
        }
    }

    // Якщо не знайшли, створюємо нову кімнату
    const newRoomId = generateRoomId();
    rooms[newRoomId] = [{ socket, playerId: 0 }];
    console.log(`Створено нову кімнату: ${newRoomId} (гравець 0)`);
    return { roomId: newRoomId, playerId: 0 };
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

function broadcastToRoom(roomId, messageObj) {
    const raw = JSON.stringify(messageObj);
    rooms[roomId]?.forEach(player => {
        if (player.socket.readyState === WebSocket.OPEN) {
            player.socket.send(raw);
        }
    });
}

console.log(`WebSocket-сервер запущено на порту ${PORT}`);