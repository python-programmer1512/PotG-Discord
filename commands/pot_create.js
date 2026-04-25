const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('@discordjs/builders');
const { ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const {pool, InsertPot, UpdatePot, DeletePot, GetPotMembers} = require('../db.js');


const inf = 998244353;


function IntegerPadding(integer,length){
    return integer.toString().padStart(length,'0');
}

async function PrintEmbedText(potName,potYear,potMonth,potDay,potHour,potMinute,potMember_Cnt,lastMember_Cnt,potDescription,msgid = null,userid = null){
    var embedText = `# ${potName}\n ### ${potYear}년 ${IntegerPadding(potMonth,2)}월 ${IntegerPadding(potDay,2)}일  ${IntegerPadding(potHour,2)}시 ${IntegerPadding(potMinute,2)}분 \n`

    if(msgid != null){
        const members = await GetPotMembers(msgid);
        embedText += `**팟 참여자 :** ${members.map(id => `<@${id}>`).join(' ')} \n`;
    }else{
        embedText += `**팟 참여자 :** <@${userid}> \n`;
    }

    if(potMember_Cnt!=inf){
        embedText += `**팟 남은 인원 : ${lastMember_Cnt}명**\n`;
    }else{
        embedText += `**팟 남은 인원 : 정원 없음**\n`;
    }
    embedText+=`\n`;

    if(potDescription != null){
        embedText += `**팟에 대한 상세 설명**\n${potDescription}\n`;
    }

    //console.log(embedText);
    return embedText;
}

async function ReplyWispper(msg,interaction){
    await interaction.reply({
        content: msg,
        ephemeral: true,
    });
}

async function Timer(fiveMinutesBefore,startTime,inputTime,Msg,potName,potAlarm_cnt) {
    // if(Msg == null){
    //     // 채널 아이디도 저장해서 같이 불러와야함
    //     //Msg = 
    // }// else msgId = msg.resource.message

    const timers = {
        alert : null,
        start : null,
        interval: null,
    }

    timers.alert = setTimeout(async () => {
        const members = await GetPotMembers(Msg.id); // DB에서 참여자 ID 목록 가져오기(별도 구현 필요)
        if (members.length > 0) {
            const mentions = members.map(id => `<@${id}>`).join(' ');
            await Msg.reply({content : `⏰ **${parseInt((inputTime-(Date.now()+9*60*60*1000))/(60*1000))+1}분 뒤 '${potName}' 팟이 시작됩니다!** \n **팟 참여자 :** ${mentions}`});
        }
        
    }, fiveMinutesBefore);

    timers.start = setTimeout(async () => {
        const members = await GetPotMembers(Msg.id);

        const startEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`🚀 **${potName}** 팟이 시작되었습니다!`)
            .setDescription(`아래 ✅ 버튼을 눌러 출석을 확인해주세요. 확인하지 않으면 1분마다 DM으로 호출됩니다. \n\n **팟 참여 인원 : **${members.map(id => `<@${id}>`).join(' ')}`);

        const checkBtn = new ButtonBuilder()
            .setCustomId('participate_check')
            .setEmoji({name : '✅'})
            .setLabel('참가 확인')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false);

        const row = new ActionRowBuilder().addComponents(checkBtn);
        const startMsg = await Msg.reply({ embeds: [startEmbed], components: [row] });

        // DM 발송 (참여자 전원)
        const dmEntries = [];
        for (const userId of members) {
            try {
                const user = await Msg.client.users.fetch(userId);
                const dmCheckBtn = new ButtonBuilder()
                    .setCustomId('participate_check_dm')
                    .setEmoji({name : '✅'})
                    .setLabel('참가 확인')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(false);
                const dmRow = new ActionRowBuilder().addComponents(dmCheckBtn);
                const dmMsg = await user.send({ embeds: [startEmbed], components: [dmRow] });
                dmEntries.push({ userId, dmMsg, collector: null });
            } catch (e) {
                console.error(`DM 발송 실패 (${userId}):`, e);
            }
        }

        // 공통 확인 처리 함수
        async function handleConfirmation(userId, interaction, isDM) {
            const result = await UpdatePot(2, Msg.id, userId);
            if (result.success) {
                if (isDM) {
                    await interaction.reply({ content: `✅ **${potName}** 팟 참여가 확인되었습니다.` });
                    try { await interaction.message.edit({ components: [] }); } catch (e) {}
                } else {
                    ReplyWispper(`✅ **${potName}** 팟 참여가 확인되었습니다.`, interaction);
                    // 채널에서 확인 시 해당 유저의 DM 버튼도 비활성화
                    const dmEntry = dmEntries.find(d => d.userId === userId);
                    if (dmEntry) {
                        try { await dmEntry.dmMsg.edit({ components: [] }); } catch (e) {}
                    }
                }

                const LastMembers = await GetPotMembers(Msg.id);
                if (LastMembers.length === 0) {
                    await Msg.reply({ content: `✅ 모든 인원이 **${potName}** 팟에 참석하였습니다!` });
                    await DeletePot(Msg.id);
                    if (timers.alert) clearTimeout(timers.alert);
                    if (timers.start) clearTimeout(timers.start);
                    checkCollector.stop('all_confirmed');
                    dmEntries.forEach(d => { if (d.collector) d.collector.stop('all_confirmed'); });
                }
            } else if (result.message === '미참여') {
                if (isDM) {
                    await interaction.reply({ content: `**${potName}** 팟에 참여한 멤버가 아닙니다.` });
                } else {
                    ReplyWispper(`**${potName}** 팟에 참여한 멤버가 아닙니다.`, interaction);
                }
            } else {
                if (isDM) {
                    await interaction.reply({ content: `오류가 발생했습니다. 다시 시도해주세요.` });
                } else {
                    ReplyWispper(`오류가 발생했습니다. 다시 시도해주세요.`, interaction);
                }
            }
        }

        // 채널 버튼 컬렉터 (알림 횟수만큼 작동)
        const checkCollector = startMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: potAlarm_cnt * 60 * 1000
        });

        checkCollector.on('collect', async i => {
            if (i.customId === 'participate_check') {
                await handleConfirmation(i.user.id, i, false);
            }
        });

        // DM 버튼 컬렉터 (유저별)
        for (const dmEntry of dmEntries) {
            const dmCollector = dmEntry.dmMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: potAlarm_cnt * 60 * 1000
            });
            dmEntry.collector = dmCollector;

            dmCollector.on('collect', async i => {
                if (i.customId === 'participate_check_dm') {
                    await handleConfirmation(i.user.id, i, true);
                }
            });
        }

        // 3. 1분마다 미출석자 DM 재알림 (총 potAlarm_cnt번)
        let count = 0;
        timers.interval = setInterval(async () => {
            count++;
            if (count > potAlarm_cnt) {
                clearInterval(timers.interval);
                return;
            }

            const LastMembers = await GetPotMembers(Msg.id);
            if (LastMembers.length > 0) {
                for (const userId of LastMembers) {
                    try {
                        const user = await Msg.client.users.fetch(userId);
                        await user.send(
                            `⚠️ **'${potName}' 팟 미출석 알림 (${count}/${potAlarm_cnt})**\n` +
                            `아직 출석 체크를 하지 않으셨습니다!\n` +
                            `👉 ${Msg.url}`
                        );
                    } catch (e) {
                        await Msg.reply({ content: `⚠️ <@${userId}> DM을 보낼 수 없어 채널에서 알립니다. **(${count}/${potAlarm_cnt})**` });
                    }
                }
            }
        }, 60 * 1000); // 1분 간격

    }, startTime);


    return timers;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pot-create')
		.setDescription('팟 생성하기')
        .addStringOption(option =>
            option.setName('pot_name')
                .setDescription('팟을 대표하는 이름을 알려주세요.')
                .setRequired(true)
                .setMaxLength(1000))
        .addIntegerOption(option =>
            option.setName('pot_hour')
                .setDescription('팟의 시간을 알려주세요(시간은 24시간제로 작성해주세요. EX 오후 5시 -> 17)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(23))
        .addIntegerOption(option =>
            option.setName('pot_minute')
                .setDescription('팟의 분을 알려주세요')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(59))
        .addIntegerOption(option =>
            option.setName('pot_year')
                .setDescription('팟의 연도를 알려주세요.')
                .setRequired(false)
                .setMinValue(2000))
        .addIntegerOption(option =>
            option.setName('pot_month')
                .setDescription('팟의 월을 알려주세요.')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(12))
        .addIntegerOption(option =>
            option.setName('pot_day')
                .setDescription('팟의 일을 알려주세요.')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(31))
        .addIntegerOption(option =>
            option.setName('pot_member_cnt')
                .setDescription('팟 최대인원을 알려주세요.')
                .setRequired(false))

        .addStringOption(option =>
            option.setName('pot_description')
                .setDescription('이 팟에 대한 설명을 작성해주세요.')
                .setRequired(false)
                .setMaxLength(1000))
        .addIntegerOption(option =>
            option.setName('pot_alarm_cnt')
                .setDescription('팟 시작 후 미출석자에게 알림을 보내는 횟수를 알려주세요. (기본값: 5)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(20))

    ,async execute(interaction) {

        //await interaction.deferReply();
        
		const potName = interaction.options.getString('pot_name');
        const potYear = interaction.options.getInteger('pot_year') || new Date().getFullYear();
        const potMonth = interaction.options.getInteger('pot_month') || (new Date().getMonth() + 1);
        const potDay = interaction.options.getInteger('pot_day') || new Date().getDate();
        const potHour = interaction.options.getInteger('pot_hour');
        const potMinute = interaction.options.getInteger('pot_minute');
        const potMember_Cnt = interaction.options.getInteger('pot_member_cnt') || inf;
        const potDescription = interaction.options.getString('pot_description');
        const potAlarm_cnt = interaction.options.getInteger('pot_alarm_cnt') || 5;

        const inputDate = new Date(Date.UTC(potYear, potMonth - 1, potDay, potHour, potMinute)); // month - 1 주의
        const inputTime = inputDate.getTime(); // 밀리초 단위 숫자
        const now = Date.now()+9*60*60*1000; // 현재 시간 밀리초
        //console.log(inputTime,now);
        if(inputTime < now){
            ReplyWispper(`이미 지나간 시간을 입력할 수 없습니다.`,interaction);
            return;
            
        }

        const maxDay = new Date(potYear, potMonth, 0).getDate(); // month: 1~12, 0이면 이전 달 마지막 날

        if (potDay < 1 || potDay > maxDay) {
            ReplyWispper(`${potMonth}월에는 ${maxDay}일까지 입력 가능합니다.`,interaction);
            return;
        }

        // 여기부턴 임베드가 무조건 생성이 될 수 있는 상태가 갖춰짐.

        var lastMember_Cnt = potMember_Cnt;
        var embedText = await PrintEmbedText(potName,potYear,potMonth,potDay,potHour,potMinute,potMember_Cnt,lastMember_Cnt,potDescription,null,interaction.user.id);

        const resultEmbed = new EmbedBuilder()
            .setColor(0x0099ff) // 임베드 바 색깔
            .setDescription(embedText);

        const participate = new ButtonBuilder()
            .setCustomId('participate')
            .setEmoji({name : '✅'})
            .setLabel('참여')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false);

        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setEmoji({name : '❌'})
            .setLabel('취소')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false);

        const buttons = new ActionRowBuilder().addComponents([participate,cancel])

        const msg = await interaction.reply({ embeds: [resultEmbed],components:[buttons],withResponse: true  });
        const MsgCondition = msg.resource.message;

        InsertPot(potName,interaction.user.id,inputDate,potDescription,potMember_Cnt,MsgCondition.id,interaction.channelId);
        
        var fiveMinutesBefore = inputTime - now - (5 * 60 * 1000);
        const startTime = inputTime - now;

        if(fiveMinutesBefore<0)fiveMinutesBefore=0;
        

        const collector = MsgCondition.createMessageComponentCollector({
            componentType : ComponentType.Button,
            time : startTime,
        })

        //Timer(fiveMinutesBefore,startTime);
        const Timers = await Timer(fiveMinutesBefore,startTime,inputTime,MsgCondition,potName,potAlarm_cnt);

        collector.on('collect', async i => {
            const { customId, user } = i;

            if(customId == 'participate'){
            
                const result = await UpdatePot(1,MsgCondition.id,user.id);
                if(result.success){
                    lastMember_Cnt--;
                    ReplyWispper(`'${potName}' 팟에 참여되었습니다.`,i);

                    var embedText = await PrintEmbedText(potName,potYear,potMonth,potDay,potHour,potMinute,potMember_Cnt,lastMember_Cnt,potDescription,MsgCondition.id,null);
                    const updatedEmbed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setDescription(embedText);

                    await MsgCondition.edit({
                        embeds: [updatedEmbed],
                        components: [buttons],
                    });


                }else if(result.message == "중복참여"){
                    ReplyWispper(`'${potName}' 팟에 이미 참여해 있습니다.`,i);
                }else if(result.message == "정원"){
                    ReplyWispper(`'${potName}' 팟의 정원이 모두 찼습니다.`,i);
                }else{
                    ReplyWispper(`오류가 발생했습니다. 다시 시도해주세요.`,i);
                }

            }else if(customId == 'cancel'){
                const result = await UpdatePot(2,MsgCondition.id,user.id);
                if(result.success){
                    lastMember_Cnt++;
                    ReplyWispper(`'${potName}' 팟에서 이탈하였습니다.`,i);
                    //console.log(lastMember_Cnt, potMember_Cnt);
                    if(potMember_Cnt < lastMember_Cnt){
                        await MsgCondition.reply({
                            content: `모든 멤버가 참여를 취소하여 '${potName}' 팟은 자동으로 **취소**되었습니다.`,
                        });
                        await DeletePot(MsgCondition.id);
                        collector.stop('all_cancelled');
                    }else{

                        var embedText = await PrintEmbedText(potName,potYear,potMonth,potDay,potHour,potMinute,potMember_Cnt,lastMember_Cnt,potDescription,MsgCondition.id,null);
                        const updatedEmbed = new EmbedBuilder()
                            .setColor(0x0099ff)
                            .setDescription(embedText);

                        await MsgCondition.edit({
                            embeds: [updatedEmbed],
                            components: [buttons],
                        });
                    }
                }else if(result.message == "미참여"){
                    ReplyWispper(`'${potName}' 팟에 아직 참여하지 않습니다.`,i);
                }else{
                    ReplyWispper(`오류가 발생했습니다. 다시 시도해주세요.`,i);
                }
            }
        });

        collector.on('end', (collected,reason) => {
            if(reason == 'all_cancelled'){
                if (Timers.alert) clearTimeout(Timers.alert); // 5분 전 알림 취소
                if (Timers.start) clearTimeout(Timers.start); // 정시 시작 로직 취소
                if (Timers.interval) clearInterval(Timers.interval); // interval 취소 추가
            }
            console.log(`'${potName}' 팟 모집 완료`);
        });

    },
    Timer,
};

