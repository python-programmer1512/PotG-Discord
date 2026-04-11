
const { Collection, Client, Events, GatewayIntentBits, Partials, Routes } = require('discord.js');
const { Timer } = require('./commands/pot_create.js');
const { REST } = require('@discordjs/rest');
const { token,clientId,guildId,MariaDB_PW } = require('./config.json');
const {pool} = require('./db.js');
const fs = require('fs');

const rest = new REST({ version: '10' }).setToken(token);
const isDev = false;

const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

const commandFiles = fs
    .readdirSync("./commands")
    .filter((file) => file.endsWith(".js"));

const commands = [];

// rest
// 	.delete(Routes.applicationGuildCommand(clientId, guildId, 'command_id'))
// 	.then(() => console.log('Successfully deleted guild command'))
// 	.catch(console.error);

(async () => {
    try {
        await rest.put(
            isDev
                ? Routes.applicationGuildCommands(clientId, guildId)
                : Routes.applicationCommands(clientId),
            { body: [] },
        );
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] },
        );
        console.log("모든 커맨드 제거 완료!");
        console.log('슬래시 커맨드 등록 중...');

        client.commands = new Collection();

        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            commands.push(command.data.toJSON());
            client.commands.set(command.data.name, command);
        }

        await rest.put(
            isDev
                ? Routes.applicationGuildCommands(clientId, guildId)
                : Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('등록 완료!');
    } catch (error) {
        console.error(error);
    }
})();


client.once(Events.ClientReady, async readyClient => {
    // let conn;
    // try {
    //     conn = await pool.getConnection();

    //     // 1. 모든 팟 데이터를 시간 순으로 가져옴
    //     const rows = await conn.query("SELECT * FROM pot ORDER BY time ASC");
    //     const now = Date.now() + 9 * 60 * 60 * 1000; // KST 기준 현재 시간

    //     for (const pot of rows) {
    //         const potTime = new Date(pot.time).getTime() + 9 * 60 * 60 * 1000;

    //         console.log(potTime,now);

    //         // // 2. 시간이 현재보다 과거라면 DB에서 삭제
    //         if (potTime < now) {
    //             await conn.query("DELETE FROM pot WHERE messageid = ?", [pot.messageid]);
    //             console.log(`[삭제] 만료된 팟 제거: ${pot.name} (${pot.messageid})`);
    //             continue;
    //         }
    //     }
    // } catch (err) {
    //     console.error("복구 프로세스 오류:", err);
    // } finally {
    //     if (conn) conn.release();
    // }
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

});


client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
        });
    }
});


client.login(token);