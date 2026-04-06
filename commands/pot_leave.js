const { SlashCommandBuilder } = require('discord.js');
const { GetPotById, UpdatePot } = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pot-leave')
        .setDescription('ID를 이용해 참가 중인 팟에서 나갑니다.')
        .addIntegerOption(option => 
            option.setName('id')
                .setDescription('탈퇴할 팟의 ID 번호')
                .setRequired(true)),

    async execute(interaction) {
        const potId = interaction.options.getInteger('id');
        const userId = interaction.user.id;

        // 1. DB에서 팟 정보 확인
        const pot = await GetPotById(potId);

        if (!pot) {
            return interaction.reply({ content: `❌ ID [${potId}]에 해당하는 팟을 찾을 수 없습니다.`, ephemeral: true });
        }

        // 2. 시간 체크 (이미 지난 팟은 탈퇴 의미가 없음)
        const now = Date.now() + 9 * 60 * 60 * 1000;
        const potTime = new Date(pot.time).getTime() + 9 * 60 * 60 * 1000;

        if (potTime < now) {
            return interaction.reply({ content: "❌ 이미 종료된 팟에서는 나갈 수 없습니다.", ephemeral: true });
        }

        // 3. 탈퇴 처리 (UpdatePot의 State 2 사용)
        // UpdatePot(messageId, updateUser, state)
        const result = await UpdatePot(2,pot.messageid, userId);

        // console.log(pot,userId);
        // console.log(result);
        if (result.success) {
            await interaction.reply({ 
                content: `✅ **${pot.name}** 팟에서 정상적으로 탈퇴되었습니다. (ID: ${potId})`,
                ephemeral: false 
            });
        } else {
            // result.message가 '미참여'인 경우 처리
            const errorMsg = result.message === '미참여' ? "해당 팟에 참여하고 있지 않습니다." : "탈퇴 처리 중 오류가 발생했습니다.";
            await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
        }
    },
};