const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

/**
 * Структура rooms:
 * {
 *   roomId1: [ { socket, playerId }, { socket, playerId }, ... ],
 *   roomId2: [ ... ],
 *   ...
 * }
 */
let rooms = {};

server.on('connection', (socket) => {
    console.log('🔌 Новий клієнт підключився');

    const { roomId, playerId } = findOrCreateRoom(socket);

    // 1) Надсилаємо гравцеві його ID (0–3)
    socket.send(JSON.stringify({
        type: 'PlayerId',
        data: playerId
    }));

    // 2) Повідомляємо всіх у кімнаті, що зайшов новий гравець
    broadcastToRoom(roomId, {
        type: 'PlayerJoined',
        data: playerId
    });

    // 3) Якщо в кімнаті вже 4 гравці — надсилаємо GameReady
    if (rooms[roomId].length === 4) {
        broadcastToRoom(roomId, {
            type: 'Message',
            data: 'GameReady'
        });
    }

    // 4) Обробка вхідних повідомлень від клієнта
    socket.on('message', (rawMessage) => {
        let msg;
        try {
            msg = JSON.parse(rawMessage);
        } catch (err) {
            console.error('❌ Невірний формат повідомлення:', rawMessage);
            return;
        }

        console.log(`📨 Повідомлення від гравця ${playerId} в кімнаті ${roomId}:`, msg);

        // Якщо клієнт прислав власне повідомлення “закрити кімнату”:
        if (msg.type === 'CloseRoom') {
            console.log(`❗ Гравець ${playerId} ініціював закриття кімнати ${roomId}`);
            // Повідомляємо всіх учасників про закриття кімнати
            broadcastToRoom(roomId, {
                type: 'RoomClosed',
                data: playerId
            });
            // Закриваємо кожному сокет
            rooms[roomId].forEach(p => {
                if (p.socket.readyState === WebSocket.OPEN) {
                    p.socket.close();
                }
            });
            // Видаляємо саму кімнату
            delete rooms[roomId];
            return;
        }

        // Якщо це інше повідомлення — розсилаємо його решті гравців у кімнаті
        rooms[roomId].forEach(p => {
            if (p.socket !== socket && p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(rawMessage);
            }
        });
    });

    // 5) Обробка дисконекту клієнта
    socket.on('close', () => {
        // Знаходимо і видаляємо гравця з масиву
        const idx = rooms[roomId].findIndex(p => p.socket === socket);
        if (idx === -1) return;

        const departedId = rooms[roomId][idx].playerId;
        rooms[roomId].splice(idx, 1);
        console.log(`❌ Гравець ${departedId} покинув кімнату ${roomId}`);

        // Повідомляємо іншим, що цей гравець вийшов
        broadcastToRoom(roomId, {
            type: 'PlayerDisconnected',
            data: departedId
        });

        // Якщо кімната порожня — видаляємо її
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
            console.log(`🏁 Кімната ${roomId} закрита (порожня)`);
        }
    });
});

/**
 * Шукає вільну кімнату та додає до неї гравця.
 * Якщо немає кімнати з менше ніж 4 гравцями — створює нову.
 * Повертає об’єкт { roomId, playerId }
 */
function findOrCreateRoom(socket) {
    for (let roomId in rooms) {
        if (rooms[roomId].length < 4) {
            // Визначаємо вільний playerId (0–3)
            const usedIds = rooms[roomId].map(p => p.playerId);
            let playerId = 0;
            while (usedIds.includes(playerId)) {
                playerId++;
            }
            rooms[roomId].push({ socket, playerId });
            console.log(`Гравець приєднався до кімнати ${roomId} як playerId=${playerId}`);
            return { roomId, playerId };
        }
    }

    // Якщо вільних кімнат немає, створюємо нову
    const newRoomId = generateRoomId();
    rooms[newRoomId] = [{ socket, playerId: 0 }];
    console.log(`Створено нову кімнату: ${newRoomId} (playerId=0)`);
    return { roomId: newRoomId, playerId: 0 };
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

/**
 * Розсилає JSON-повідомлення всім гравцям у кімнаті `roomId`.
 */
function broadcastToRoom(roomId, messageObj) {
    const raw = JSON.stringify(messageObj);
    rooms[roomId]?.forEach(p => {
        if (p.socket.readyState === WebSocket.OPEN) {
            p.socket.send(raw);
        }
    });
}

/**
 * Закриває НЕ ОДНУ кімнату, а всі активні кімнати.
 * Для кожного гравця у кожній кімнаті надсилає {type: 'RoomClosedAll'},
 * потім закриває його сокет і видаляє кімнату.
 */
function closeAllRooms() {
    for (let roomId in rooms) {
        rooms[roomId].forEach(p => {
            if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(JSON.stringify({
                    type: 'RoomClosedAll',
                    data: null
                }));
                p.socket.close();
            }
        });
        console.log(`Усі клієнти в кімнаті ${roomId} повідомлені про масове закриття`);
        delete rooms[roomId];
    }
    console.log('▶️ Усі кімнати закриті');
}

// Приклад: можна викликати closeAllRooms() за якоюсь подією, наприклад:
// setTimeout(() => closeAllRooms(), 60000); // закриє всі кімнати через хвилину

console.log(`WebSocket-сервер запущено на порту ${PORT}`);