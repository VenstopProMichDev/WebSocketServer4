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
        console.log(`Повідомлення від ${roomId}:`, message.toString());

        // Відправка всім у кімнаті
        rooms[roomId].forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    socket.on('close', () => {
        const playerId = playerSocketMap.get(socket);
        console.log(`Гравець ${playerId} покинув кімнату ${roomId}`);

        // Видаляємо гравця
        rooms[roomId] = rooms[roomId].filter(client => client !== socket);
        playerSocketMap.delete(socket);

        // Повідомляємо інших хто саме вийшов
        rooms[roomId]?.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: "PlayerDisconnected",
                    data: playerId
                }));
            }
        });

        // Якщо кімната порожня — видаляємо її
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

console.log(`WebSocket-сервер запущено на порту ${PORT}`);