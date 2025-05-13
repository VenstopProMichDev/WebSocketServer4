const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

let rooms = {}; // { roomId: [ { socket, id } ] }

server.on('connection', (socket) => {
    console.log('Новий клієнт підключився');

    const { roomId, playerId } = findOrCreateRoom(socket);

    // Надсилаємо гравцеві його ID
    socket.send(JSON.stringify({ type: "PlayerId", data: playerId }));

    socket.on('message', (message) => {
        console.log(`Повідомлення від кімнати ${roomId}:`, message.toString());

        // Ретранслюємо всім у кімнаті, окрім відправника
        rooms[roomId].forEach(player => {
            if (player.socket !== socket && player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(message.toString());
            }
        });
    });

    socket.on('close', () => {
        console.log(`Гравець покинув кімнату ${roomId}`);
        rooms[roomId] = rooms[roomId].filter(player => player.socket !== socket);

        // Повідомити інших, що гравець вийшов
        rooms[roomId].forEach(player => {
            if (player.socket.readyState === WebSocket.OPEN) {
                player.socket.send(JSON.stringify({ type: "Message", data: "PlayerIsExit" }));
            }
        });

        // Якщо кімната пуста — видалити
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито`);
        }
    });
});

function findOrCreateRoom(socket) {
    // Пошук кімнати з менше ніж 4 гравцями
    for (let room in rooms) {
        if (rooms[room].length < 4) {
            const newId = rooms[room].length;
            rooms[room].push({ socket, id: newId });
            console.log(`Гравець приєднався до кімнати ${room} як ${newId}`);

            if (rooms[room].length === 4) {
                // Коли кімната повна — повідомити всіх
                rooms[room].forEach(player => {
                    if (player.socket.readyState === WebSocket.OPEN) {
                        player.socket.send(JSON.stringify({ type: "Message", data: "GameReady" }));
                    }
                });
            }

            return { roomId: room, playerId: newId };
        }
    }

    // Якщо всі кімнати заповнені — створити нову
    const newRoomId = generateRoomId();
    rooms[newRoomId] = [{ socket, id: 0 }];
    console.log(`Створено нову кімнату: ${newRoomId}`);
    return { roomId: newRoomId, playerId: 0 };
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

console.log(`WebSocket-сервер запущено на порту ${PORT}`);