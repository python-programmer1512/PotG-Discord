const { SlashCommandBuilder } = require('discord.js');
const { GetPotById, UpdatePot } = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pot-invite')
        .setDescription('ID를 이용해 팟에 참가 신청을 합니다.')
        .addIntegerOption(option => 
            option.setName('id')
                .setDescription('참가할 팟의 ID 번호')
                .setRequired(true)),

    async execute(interaction) {
        const potId = interaction.options.getInteger('id');
        const userId = interaction.user.id;

        // 1. DB에서 팟 정보 불러오기
        const pot = await GetPotById(potId);

        if (!pot) {
            return interaction.reply({ content: `❌ ID [${potId}]에 해당하는 팟을 찾을 수 없습니다.`, ephemeral: true });
        }

        // 2. 조건 검사 (pot_create.js 로직 재사용)
        const now = Date.now() + 9 * 60 * 60 * 1000;
        const potTime = new Date(pot.time).getTime() + 9 * 60 * 60 * 1000;

        // 조건 A: 시간 만료 여부
        if (potTime < now) {
            return interaction.reply({ content: "❌ 이미 종료된 팟입니다.", ephemeral: true });
        }

        // 조건 B: 인원 제한 확인 (무제한이 아닐 경우)
        const inf = 998244353;
        if (pot.membercnt !== inf && pot.membercnt <= 0) {
            return interaction.reply({ content: "❌ 이미 정원이 가득 찬 팟입니다.", ephemeral: true });
        }

        // 3. 참가 처리 (UpdatePot 호출)
        // State 1은 참가, State 2는 취소를 의미하도록 설계된 기존 로직 활용
        const result = await UpdatePot(1,pot.messageid, userId);
        //console.log(pot.messageid,userId);
        //console.log(result);
        if (result.success) {
            await interaction.reply({ 
                content: `✅ **${pot.name}** 팟에 참가가 완료되었습니다! (ID: ${potId})`,
                ephemeral: false 
            });
            
            // (옵션) 원래 팟 메시지가 있다면 해당 메시지도 업데이트하면 좋습니다.
            // 이를 위해선 기존에 만든 UpdatePot 내의 메시지 갱신 로직을 호출하거나
            // 해당 채널에 알림 메시지를 보낼 수 있습니다.
        } else {
            const errorMsg = result.message === '이미 참여' ? "이미 해당 팟에 참여 중입니다." : "참가 처리 중 오류가 발생했습니다.";
            await interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
        }
    },
};