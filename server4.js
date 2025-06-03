const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

let rooms = {}; // Список кімнат
let playerSocketMap = new Map(); // Socket => playerId

server.on('connection', (socket) => {
    console.log('Новий клієнт підключився');

    let roomId = findOrCreateRoom(socket);
    let playerId = rooms[roomId].indexOf(socket);
    playerSocketMap.set(socket, playerId);

    // Надсилаємо гравцеві його ID
    socket.send(JSON.stringify({
        type: "PlayerId",
        data: playerId
    }));

    // Надсилаємо всім гравцям у кімнаті список ID + you
    broadcastPlayerIds(roomId);

    // Якщо в кімнаті вже 4 гравці — надсилаємо GameReady
    if (rooms[roomId].length === 4) {
        rooms[roomId].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: "Message",
                    data: "GameReady"
                }));
            }
        });
    }

    socket.on('message', (message) => {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            console.error("Невірний формат повідомлення:", message.toString());
            return;
        }

        console.log(`Повідомлення від ${roomId}:`, msg);

        // Обробка закриття кімнати
        if (msg.type === "CloseRoom") {
            console.log(`Гравець ${playerId} ініціював закриття кімнати ${roomId}`);

            rooms[roomId]?.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "RoomClosed",
                        data: playerId
                    }));
                    client.close();
                }
            });

            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито вручну`);
            return;
        }

        // Відправка всім іншим гравцям
        rooms[roomId].forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    socket.on('close', () => {
        const playerId = playerSocketMap.get(socket);
        console.log(`Гравець ${playerId} покинув кімнату ${roomId}`);

        rooms[roomId] = rooms[roomId].filter(client => client !== socket);
        playerSocketMap.delete(socket);

        // Повідомити інших
        rooms[roomId]?.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: "PlayerDisconnected",
                    data: playerId
                }));
            }
        });

        // Оновити список гравців
        if (rooms[roomId]?.length > 0) {
            broadcastPlayerIds(roomId);
        }

        // Видалити кімнату, якщо порожня
        if (rooms[roomId]?.length === 0) {
            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито`);
        }
    });
});

function findOrCreateRoom(socket) {
    for (let room in rooms) {
        if (rooms[room].length < 4) {
            rooms[room].push(socket);
            console.log(`Гравець приєднався до кімнати ${room}`);
            return room;
        }
    }

    let newRoomId = generateRoomId();
    rooms[newRoomId] = [socket];
    console.log(`Створено нову кімнату: ${newRoomId}`);
    return newRoomId;
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

function broadcastPlayerIds(roomId) {
    rooms[roomId].forEach((client, index) => {
        if (client.readyState === WebSocket.OPEN) {
            const playerList = rooms[roomId].map((_, i) => ({ id: i }));
            client.send(JSON.stringify({
                type: "AllPlayerIds",
                you: index,
                players: playerList
            }));
        }
    });
}

console.log(`WebSocket-сервер запущено на порту ${PORT}`);