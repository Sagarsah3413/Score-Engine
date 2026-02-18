import { WebSocket, WebSocketServer } from 'ws';
import { wsArcjet } from "../arcjet.js";







function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}
// This function will receive the HTTP server instance created by Express.
export function attachWebSocketServer(server) {
    // we are passing it into the websocket so that it can attach itself to the same underlying server. The HTTP server will then listen on that port and handle normal REST requests while the socket uses the same server to listen for upgrade request. This avoids running a saperate port just for websockets. Using the same server simplifies deployment and networking.
    // The second thing we want to provide is the path. This is a string representing the websocket endpoint and only requests made to this exact path are eligible for web socket upgrades.
    // Request to other paths continue to be handeled by express normally.
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
    server.on('upgrade', async (request, socket, head) => {
        const { pathname } = new URL(request.url, 'http://localhost');

        if (pathname !== '/ws') {
            socket.destroy(); // reject anything not on /ws
            return;
        }
        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });
    wss.on('connection', async (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            cleanupSubscriptions(socket);
        })

        socket.on('error', console.error);
    });
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        })
    }, 30000);

    wss.on('close', () => clearInterval(interval));
    wss.on('connection', (socket) => {
        sendJson(socket, { type: 'welcome' });
        socket.on('error', console.error);
    });

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }



    return { broadcastMatchCreated };
}