import 'dotenv/config'
import express from "express";
import { matchRouter } from './src/routes/matches.routes.js';
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hi! from server");
})
app.use('/matches', matchRouter);
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
})