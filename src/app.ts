import {Context, Markup, session, SessionStore, Telegraf, Scenes} from "telegraf";
import {Postgres} from "@telegraf/session/pg";
import {getWhetherDetails} from "./whether.js";
import configDotenv from 'dotenv';
import {initDb, runJob} from "./scheduleUpdates";
import {scheduleJob} from "node-schedule";
import {WizardContext, WizardSession} from "telegraf/scenes";
configDotenv.config();

interface Location {
    latitude: number;
    longitude: number;
}
interface SessionData {
    chatId?: number;
    location?: Location;
    temperatureMetric?: 'C' | 'F';
    updatesFrequency?: number;
}
interface MyContext extends Context {
    session?: SessionData;
}

const store: SessionStore<SessionData> = Postgres({
    host: process.env.DB_HOST as string,
    database: process.env.DB_NAME as string,
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
});

const bot: Telegraf<MyContext> = new Telegraf<MyContext>(process.env.BOT_TOKEN as string);

const commands= [
    {command: 'reconfigure', description: 'Reconfigure your settings (location + temperature unit).'},
    {command: 'get_weather_data', description: 'Get the whether data'},
];
bot.telegram.setMyCommands(commands);

const mainKeyboard = Markup.keyboard([
    ['Get Whether Data', 'Reconfigure Settings'],
]).resize().oneTime();

const tempUnitKeyboard = Markup.keyboard([
    ['Celsius (C°)', 'Fahrenheit (F°)'],
]).resize().oneTime();

const scene = new Scenes.WizardScene<Scenes.WizardContext>(
    "configurer",
    async (ctx) => {
        // @ts-ignore
        ctx.session.chatId ??= ctx.message.chat.id;
        await ctx.reply('Welcome to the Weather Bot 🌦️.\nI will send you the weather data of your location everyday at 6:00 AM. Yaaay!')
        await ctx.reply('Please share your location',Markup.keyboard([
                    Markup.button.locationRequest('📍 Send Location')
                ]).resize().oneTime());
        return ctx.wizard.next();
    },
    async (ctx) => {
        // @ts-ignore
        if (!ctx.message.location) {
            await ctx.reply('I do not understand. Please send the location.',Markup.keyboard([
                Markup.button.locationRequest('📍 Send Location')
            ]).resize().oneTime());
            return ctx.wizard.selectStep(1);
        }
        // @ts-ignore
        const {latitude, longitude} = ctx.message.location;
        // @ts-ignore
        ctx.session.location = {latitude, longitude};

        await ctx.reply(`Location Set successfully ✅.\nNow, please select the temperature unit.`, tempUnitKeyboard);
        return ctx.wizard.next();
    },
    async (ctx) => {
        // @ts-ignore
        if (!['Celsius (C°)', 'Fahrenheit (F°)'].includes(ctx.message.text)) {
            await ctx.reply(`I do not understand. Please select your preferred temperature unit.`, tempUnitKeyboard);
            return ctx.wizard.selectStep(2);
        }
        // @ts-ignore
        ctx.session.temperatureMetric = ctx.message.text === 'Celsius (C°)' ? 'C' : 'F';

        await ctx.reply("Configuration completed successfully ✅", mainKeyboard);
        return await ctx.scene.leave();
    }
);

const stage = new Scenes.Stage<Scenes.WizardContext>([scene]);
// @ts-ignore
bot.use(stage.middleware());
bot.use(session({store}));

// @ts-ignore
bot.command(['start', 'restart', 'reconfigure'], ctx => ctx.scene.enter('configurer'));

// @ts-ignore
bot.hears('Reconfigure Settings', ctx => ctx.scene.enter('configurer'));

bot.hears(/.*/, async (ctx) => {
    switch (ctx.message.text) {
        case '/get_weather_data':
        case 'Get Whether Data':
            if (!ctx.session?.location) {
                ctx.reply('Please share your location first', mainKeyboard);
                return;
            }
            try {
                const data = await getWhetherDetails(ctx.session?.location.latitude, ctx.session?.location.longitude, ctx.session?.temperatureMetric);
                ctx.reply(data, { parse_mode: 'Markdown' });
                break;
            } catch (e) {
                ctx.reply('An error occurred while fetching the data');
                break;
            }
        default:
            ctx.reply('I do not understand. Please use the buttons:', mainKeyboard);
            break;
    }
});

// Run the scheduled updates every 20 seconds
initDb().then((res) => {
    console.log(res);
    scheduleJob('0 6 * * *', function(){
        runJob(bot).then((res) => console.log(res)).catch(e => console.error('Error starting scheduled updates', e));
    });
}).catch(e => console.error('Error connecting to the database', e));

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))