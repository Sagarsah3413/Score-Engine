import { Router } from "express"
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.validations.js";
import { getMatchStatus } from '../utils/match-status.js'
import { matches } from "../schema.js";
import { db } from "../db/db.js";
import { desc } from "drizzle-orm";
const MAX_LIMIT = 100;

export const matchRouter = Router();

matchRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);
    console.log(parsed)
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query.', details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy(desc(matches.createdAt))
            .limit(limit);

        console.log(data)
        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: `Failed to list matches. ${e}` });
    }
})
matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload.', details: parsed.error.issues });
    }
    const {
        startTime,
        endTime,
        homeScore,
        awayScore,
        ...rest
    } = parsed.data;
    console.log(parsed.data);

    try {
        const [event] = await db.insert(matches).values({
            ...rest,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();
        console.log(event)
        if (res.app.locals.broadcastMatchCreated) {
            res.app.locals.broadcastMatchCreated(event);
        }
        // As soon as we send a post request to create a matches. we should be able to see a new event on the client instantly. This happens because the express route finished the database work and then called app locals broadcast match created event which pushed the data through the pipe to the WS client

        res.status(201).json({ data: event });
    } catch (e) {
        console.error("DB ERROR:", e);
        res.status(500).json({ error: 'Failed to create match.' });
    }
})