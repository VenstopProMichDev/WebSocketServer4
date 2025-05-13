const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

let rooms = {}; // { roomId: [ { socket, playerId } ] }

server.on('connection', (socket) => {
    console.log('Новий клієнт підключився');

    const { roomId, playerId } = findOrCreateRoom(socket);

    // Відправляємо гравцю його ID
    socket.send(JSON.stringify({
        type: 'PlayerId',
        data: playerId
    }));

    socket.on('message', (message) => {
        console.log(`Повідомлення від ${roomId}:`, message.toString());

        // Відправка всім гравцям у кімнаті, крім відправника
        rooms[roomId].forEach(player => {
            if (player.socket !== socket && player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(message.toString());
            }
        });
    });

    socket.on('close', () => {
        console.log(`Гравець покинув кімнату ${roomId}`);

        rooms[roomId] = rooms[roomId].filter(player => player.socket !== socket);

        // Якщо залишився один гравець, повідомляємо його
        if (rooms[roomId].length === 1) {
            let remaining = rooms[roomId][0];
            if (remaining.socket.readyState === WebSocket.OPEN) {
                remaining.socket.send(JSON.stringify({
                    type: 'Message',
                    data: 'PlayerIsExit'
                }));
            }
        }

        // Якщо кімната порожня — видаляємо її
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито`);
        }
    });
});

function findOrCreateRoom(socket) {
    for (let roomId in rooms) {
        if (rooms[roomId].length < 4) {
            let playerId = rooms[roomId].length + 1;
            rooms[roomId].push({ socket, playerId });
            console.log(`Гравець приєднався до кімнати ${roomId} як гравець ${playerId}`);

            if (rooms[roomId].length === 4) {
                rooms[roomId].forEach(player => {
                    if (player.socket.readyState === WebSocket.OPEN) {
                        player.socket.send(JSON.stringify({
                            type: 'Message',
                            data: 'GameReady'
                        }));
                    }
                });
            }

            return { roomId, playerId };
        }
    }

    // Створюємо нову кімнату
    let newRoomId = generateRoomId();
    rooms[newRoomId] = [{ socket, playerId: 1 }];
    console.log(`Створено нову кімнату: ${newRoomId}`);
    return { roomId: newRoomId, playerId: 1 };
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

console.log(`WebSocket-сервер запущено на порту ${PORT}`);