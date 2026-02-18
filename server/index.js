import 'dotenv/config'
import http from 'http';
import express from "express";
import { matchRouter } from './src/routes/matches.routes.js';
import { securityMiddleware } from "./src/arcjet.js"
import { attachWebSocketServer } from './src/ws/server.js'
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
// Express is the server built on top of HTTP module. 
// To use websockets we need to explicitely create the HTTP server so that the WS library can hook into it
const app = express();
const server = http.createServer(app);
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hi! from server");
})
app.use(securityMiddleware());
app.use('/matches', matchRouter);

// Initializing a websocket and  getting access to the broadcast  function. The reason we are getting  access to it is so we can  store it to app.locals.broadcastMatchCreated.
const { broadcastMatchCreated } = attachWebSocketServer(server);
// app.locals is expresses global object accessible from any request and finally instead of  app.listen we use aerver.listen
app.locals.broadcastMatchCreated = broadcastMatchCreated;
server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

    console.log(`Server is running on ${baseUrl}`);
    console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});