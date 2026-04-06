const { REST, Routes } = require('discord.js');
const fs = require('fs');
const { token, clientId, guildId } = require('./config.json');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

// REST 객체 생성
const rest = new REST({ version: '10' }).setToken(token);

// 즉시 실행 함수
(async () => {
  try {
    console.log('슬래시 커맨드 등록 중...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId), // 👉 서버 전용
      { body: commands },
    );

    console.log('등록 완료!');
  } catch (error) {
    console.error(error);
  }
})();