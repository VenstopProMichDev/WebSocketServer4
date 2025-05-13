const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

let rooms = {}; // Список кімнат

server.on('connection', (socket) => {
    console.log('Новий клієнт підключився');
    
    let roomId = findOrCreateRoom(socket);

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
        console.log(`Гравець покинув кімнату ${roomId}`);
        
        // Фільтруємо кімнату, видаляючи гравця
        rooms[roomId] = rooms[roomId].filter(client => client !== socket);

        // Якщо залишився один гравець, повідомляємо його
        if (rooms[roomId].length === 1) {
            let remainingPlayer = rooms[roomId][0];
            if (remainingPlayer.readyState === WebSocket.OPEN) {
                remainingPlayer.send("PlayerIsExit");
            }
        }

        // Якщо кімната спорожніла — видаляємо її
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`Кімнату ${roomId} закрито`);
        }
    });
});

function findOrCreateRoom(socket) {
    // Шукаємо кімнату з одним гравцем
    for (let room in rooms) {
        if (rooms[room].length === 1) {
            rooms[room].push(socket);
            console.log(`Гравець приєднався до кімнати ${room}`);

            // Повідомляємо обох гравців, що гра почалася
            rooms[room].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send("GameReady");
                }
            });

            return room;
        }
    }

    // Якщо вільної кімнати немає, створюємо нову
    let newRoomId = generateRoomId();
    rooms[newRoomId] = [socket];
    console.log(`Створено нову кімнату: ${newRoomId}`);
    // Повідомляємо обох гравців, що гра почалася
    rooms[newRoomId].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send("FirstPlayer");
        }
    });
    return newRoomId;
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6); // Випадковий ідентифікатор
}

console.log(`WebSocket-сервер запущено на порту ${PORT}`);
