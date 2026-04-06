const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('@discordjs/builders');
const { ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const {pool, GetPagedPots} = require('../db.js');


const inf = 998244353;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pot-list')
		.setDescription('팟 목록 보기')
    ,async execute(interaction) {

        let currentPage = 1;
        const limit = 5;

        // 임베드 생성 함수
        const createEmbed = (rows, page, total) => {
            const embed = new EmbedBuilder()
                .setTitle(`📅 현재 모집 중인 팟 (페이지 ${page})`)
                .setColor(0x00FF00);

            if (rows.length === 0) {
                embed.setDescription("현재 모집 중인 팟이 없습니다.");
            } else {
                let description = "";
                rows.forEach(pot => {
                    const potTime = new Date(pot.time).toLocaleString('ko-KR');
                    // DB ID는 pot.id (또는 실제 컬럼명) 사용
                    description += `**ID** : ${pot.id} \n ** Pot Name : ${pot.name} **\n🕒 ${potTime}\n👥 남은 인원: ${pot.membercnt === 998244353 ? '제한 없음' : pot.membercnt + '명'}\n\n`;
                });
                embed.setDescription(description);
            }
            return embed;
        };

        // 버튼 생성 함수
        const createButtons = (page, total) => {
            const totalPages = Math.ceil(total / limit);
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('이전')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('다음')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages || total === 0)
            );
        };

        // 초기 데이터 로드 및 전송
        const { rows, totalPots } = await GetPagedPots(currentPage, limit);
        //console.log(totalPots);
        const response = await interaction.reply({
            embeds: [createEmbed(rows, currentPage, totalPots)],
            components: [createButtons(currentPage, totalPots)],
            fetchReply: true
        });

        // 컬렉터 설정 (버튼 클릭 감지)
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000 // 1분간 작동
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "명령어를 입력한 사용자만 페이지를 넘길 수 있습니다.", ephemeral: true });
            }

            if (i.customId === 'prev') currentPage--;
            else if (i.customId === 'next') currentPage++;

            const { rows: newRows, totalPots: newTotal } = await GetPagedPots(currentPage, limit);
            
            await i.update({
                embeds: [createEmbed(newRows, currentPage, newTotal)],
                components: [createButtons(currentPage, newTotal)]
            });
        });

        collector.on('end', (collected,reason) => {
            
        });

    },
};

