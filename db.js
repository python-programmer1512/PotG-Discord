const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('@discordjs/builders');
const { ButtonStyle } = require('discord.js');
const { token,clientId,guildId,MariaDB_PW } = require('./config.json');

const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: 'localhost',       // DB 서버 주소
  user: 'root',            // DB 사용자
  password: MariaDB_PW,// DB 비밀번호
  database: 'potg-discord',        // 사용할 DB
  connectionLimit: 3,       // 최대 동시 연결 수
});


function IntegerPadding(integer,length){
    return integer.toString().padStart(length,'0');
}

async function GetPotMembers(messageId) {
    try {
        // 1. 해당 메시지 ID의 팟 정보를 조회 (테이블명은 본인의 설정에 맞게 수정: pot_create 등)
        const rows = await pool.query(
            'SELECT participator FROM pot WHERE messageid = ?', 
            [messageId]
        );

        // 2. 데이터가 없는 경우 빈 리스트 반환
        if (rows.length === 0 || !rows[0].participator) {
            return [];
        }

        // 3. '|' 구분자로 나누어 리스트 생성 (공백 제거 포함)
        // 예: "ID1|ID2|ID3" -> ["ID1", "ID2", "ID3"]
        const participatorString = rows[0].participator;
        const memberList = participatorString.split('|').filter(id => id.trim() !== "");
        //console.log(memberList);
        return memberList;
    } catch (error) {
        console.error('멤버 목록 불러오기 오류:', error);
        return [];
    }
}

async function InsertPot(potName,potConstructor,potTime,potDescription,potMember_Cnt,messageId,channelId) {
    let conn;
    try {
        conn = await pool.getConnection();

        const mysqlDate = potTime.toISOString().slice(0, 19).replace('T', ' '); 
        const potConstructor_id = potConstructor;

        const result = await conn.query(
            "INSERT INTO pot(name, constructor, participator, time, description, membercnt, messageid, channelid) VALUES(?,?,?,?,?,?,?,?)",
            [potName,potConstructor_id,potConstructor_id+"|",mysqlDate,potDescription,potMember_Cnt,messageId,channelId]
        );

        //console.log("Inserted ID:", result.insertId);
        return {success : true};

    }catch (err) {
        console.error(err);
        return {success : false, message : err};

    } finally {
        if (conn) conn.release();

    }
    
}

async function UpdatePot(State,messageId,updateUser) {
    // State = 1 : 추가
    // State = 2 : 삭제
    let conn;
    conn = await pool.getConnection();

    // 1. 해당 메시지 ID를 가진 팟 정보 가져오기
    const rows = await conn.query("SELECT participator, membercnt FROM pot WHERE messageid = ?", [messageId]);
    //console.log(rows);
    if (rows.length === 0) return { success: false, message: "팟을 찾을 수 없습니다." };
    let { participator, membercnt } = rows[0];

    if(State == 1){
        try {
            // 2. 중복 참여 확인
            const currentParticipants = participator.split('|');
            if (currentParticipants.includes(updateUser)) {
                return { success: false, message: "중복참여" };
            }

            // 3. 인원 제한 확인 (998244353은 무제한 설정값)
            //console.log(currentParticipants,currentParticipants.length,membercnt);
            if (membercnt !== 998244353 && currentParticipants.length-1 > membercnt) {
                return { success: false, message: "정원" };
            }

            // 4. 데이터 업데이트 (ID 추가)
            const updatedParticipator = participator + updateUser + "|";
            await conn.query("UPDATE pot SET participator = ? WHERE messageid = ?", [updatedParticipator, messageId]);

            return { success: true, currentCount: currentParticipants.length };
        } catch (err) {
            console.error(err);
            return { success: false, message: "DB 오류 발생" };
        } finally {
            if (conn) conn.release();
        }

    }else{
        try{
            if(!participator.includes(updateUser+'|')){
                return {success : false, message : '미참여'};
            }

            const updatedParticipator = participator.replace(updateUser+'|','');

            await conn.query("UPDATE pot SET participator = ? WHERE messageid = ?", [updatedParticipator, messageId]);

            return {success : true };

        }catch(err){
            console.error(err);
            return { success : false, message : "DB 오류 발생"};
        } finally {
            if(conn)conn.release();
        }
    }
    
}

async function DeletePot(messageId) {
    try {
        // 특정 메시지 ID에 해당하는 팟 정보를 삭제
        const result = await pool.query(
            'DELETE FROM pot WHERE messageid = ?', 
            [messageId]
        );
        if(result.affectedRows){
            return {success : true};
        }else{
            return { success: false, message: "삭제 실패" };
        }
    } catch (error) {
        console.error('삭제 중 오류 발생:', error);
        return { success: false, message: "삭제 실패" };
    }
}

async function GetPagedPots(page = 1, limit = 10) {
    let conn;
    try {
        conn = await pool.getConnection();
        const now = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

        // 1. 지난 데이터 삭제
        await conn.query("DELETE FROM pot WHERE time < ?", [now]);

        // 2. 전체 개수 파악 (페이지 계산용)
        const countRes = await conn.query("SELECT COUNT(*) as cnt FROM pot");
        const totalPots = Number(countRes[0].cnt);

        // 3. 현재 페이지 데이터 조회 (OFFSET 활용)
        const offset = (page - 1) * limit;
        const rows = await conn.query(
            "SELECT * FROM pot ORDER BY time ASC LIMIT ? OFFSET ?", 
            [limit, offset]
        );

        return { rows, totalPots };
    } catch (err) {
        console.error(err);
        return { rows: [], totalPots: 0 };
    } finally {
        if (conn) conn.release();
    }
}

async function GetPotById(id) {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM pot WHERE id = ?", [id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    pool,
    InsertPot,
    UpdatePot,
    DeletePot,
    GetPotMembers,
    GetPagedPots,
    GetPotById,
}