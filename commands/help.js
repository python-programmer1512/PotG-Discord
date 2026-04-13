const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('PotG 봇의 모든 명령어와 사용법을 확인합니다.')
    ,
    async execute(interaction) {
        const helpText =
            `# 📖 PotG 봇 도움말\n` +
            `> PotG 봇은 팟(모임)을 생성하고 참여자를 모집하는 Discord 봇입니다.\n` +
            `\n` +
            `\n` +
            `## 📋 명령어 목록\n` +
            `\n` +
            `### 🆕 \`/pot-create\` — 팟 생성\n` +
            `새로운 팟을 만들어 참여자를 모집합니다.\n` +
            `\n` +
            `**필수 옵션**\n` +
            `> \`pot_name\` — 팟 이름 (최대 1000자)\n` +
            `> \`pot_hour\` — 시작 시각 (시, 0~23)\n` +
            `> \`pot_minute\` — 시작 시각 (분, 0~59)\n` +
            `\n` +
            `**선택 옵션**\n` +
            `> \`pot_year\` — 연도 (기본값: 올해)\n` +
            `> \`pot_month\` — 월 (기본값: 이번 달)\n` +
            `> \`pot_day\` — 일 (기본값: 오늘)\n` +
            `> \`pot_member_cnt\` — 최대 인원 (기본값: 무제한)\n` +
            `> \`pot_description\` — 팟 설명 (최대 1000자)\n` +
            `\n` +
            `**예시**\n` +
            `\`\`\`\n` +
            `/pot-create pot_name:롤 내전 pot_hour:21 pot_minute:30 pot_member_cnt:10\n` +
            `/pot-create pot_name:스터디 모임 pot_hour:14 pot_minute:0 pot_day:20 pot_description:알고리즘 스터디\n` +
            `\`\`\`\n` +
            `\n` +
            `> ⏰ 시작 **5분 전** 알림, 시작 시 출석 확인 버튼이 자동 발송됩니다.\n` +
            `\n` +
            `\n` +
            `### 📩 \`/pot-invite\` — 팟 참여\n` +
            `팟 ID를 입력해 원하는 팟에 참여합니다.\n` +
            `\n` +
            `**필수 옵션**\n` +
            `> \`id\` — 참여할 팟의 ID 번호\n` +
            `\n` +
            `**예시**\n` +
            `\`\`\`\n` +
            `/pot-invite id:42\n` +
            `\`\`\`\n` +
            `\n` +
            `> 💡 팟 ID는 \`/pot-list\` 에서 확인할 수 있습니다.\n` +
            `\n` +
            `\n` +
            `### 🚪 \`/pot-leave\` — 팟 탈퇴\n` +
            `참여 중인 팟에서 나갑니다.\n` +
            `\n` +
            `**필수 옵션**\n` +
            `> \`id\` — 탈퇴할 팟의 ID 번호\n` +
            `\n` +
            `**예시**\n` +
            `\`\`\`\n` +
            `/pot-leave id:42\n` +
            `\`\`\`\n` +
            `\n` +
            `\n` +
            `### 📜 \`/pot-list\` — 팟 목록 조회\n` +
            `현재 모집 중인 팟 목록을 페이지 단위로 확인합니다.\n` +
            `\n` +
            `**옵션 없음** — 명령어만 입력하면 됩니다.\n` +
            `\n` +
            `**예시**\n` +
            `\`\`\`\n` +
            `/pot-list\n` +
            `\`\`\`\n` +
            `\n` +
            `> 🔄 **이전** / **다음** 버튼으로 페이지를 넘길 수 있으며,\n` +
            `> 명령어를 입력한 본인만 버튼을 조작할 수 있습니다.\n` +
            `\n` +
            `\n` +
            `### ❓ \`/help\` — 도움말\n` +
            `이 도움말 메시지를 표시합니다.`;

        const helpEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setDescription(helpText);

        await interaction.reply({
            embeds: [helpEmbed],
            flags: MessageFlags.Ephemeral
        });
    }
};
