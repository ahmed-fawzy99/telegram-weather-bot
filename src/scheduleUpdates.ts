import {getWhetherDetails} from "./whether.js";
import {Client} from "pg";
import configDotenv from 'dotenv';
configDotenv.config();

const client = new Client({
    user: process.env.DB_USER as string,
    host: process.env.DB_HOST as string,
    database: process.env.DB_NAME as string,
    password: process.env.DB_PASSWORD as string,
    port: process.env.DB_PORT as unknown as number,
});

export async function initDb(): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            await client.connect();
            resolve('Connected to the database');
        } catch (err) {
            reject('Error Connecting to the database');
        }
    });

}

export async function runJob(bot: any): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            const selectQuery = 'SELECT key, session FROM "telegraf-sessions";';
            const res = await client.query(selectQuery);
            for (const row of res.rows) {
                const sessionData = JSON.parse(row.session);
                const data = await getWhetherDetails(sessionData.location.latitude, sessionData.location.longitude, sessionData.temperatureMetric);
                await bot.telegram.sendMessage(sessionData.chatId, data, {parse_mode: 'Markdown'});
                resolve(`Job executed successfully for Day ${new Date()}`);
            }
        } catch (err) {
            console.error('Error executing query: ', err);
        }
    });
}

