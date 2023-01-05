const discord = require('discord.js');
const sqlite3 = require('sqlite3');
const backup = require("discord-backup");
const schedule = require('node-schedule');
const Database = require('better-sqlite3');
const db = new Database('data.db');
const express = require('express');
const { Routes } = require('discord-api-types/v9');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { REST } = require('@discordjs/rest');
const fetch = require("node-fetch");
const { randomUUID } = require('crypto');
const app = express()
const embed_name = "WAPING ALL BACKUP" // 임베드 제목
const backup_log_channel = "939872755829063710" // 백업 로그 채널 아이디
const license_log_channel = "938738720742453259" // 라이센스 생성 로그 채널 아이디
const ba_log_channel = "938738706653790230" // 등록 로그 채널 아이디
const bac_log_channel = "938742653535813652" // 복구 로그 채널 아이디
const TOKEN = ""; // 봇 토큰
let CLIENT_ID = '' // 디스코드 OAuth2 CLIENT ID
let CLIENT_SECRET = '' // 디스코드 OAuth2 CLIENT SECRET
const usertkn = new REST().setToken("");
const bottkn = new REST().setToken(TOKEN);
let REDIRECT_URL = 'https://google.com/callback/' // 도메인
const port = 80; // 외부 포트
const staff = ["683944346772308008"] // 관리자 아이디

async function discord_excharge_code(gid, code) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URL
    });
    let resp = await fetch(`https://discord.com/api/v8/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        
    })
    return await resp.json();
}
async function discord_refresh_token(refresh_token) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
    });
    let resp = await fetch(`https://discord.com/api/v8/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        
    })
    return await resp.json();

}

backup.setStorageFolder(__dirname+"/backups/");

const { MessageEmbed } = require('discord.js');
const client = new discord.Client({
    intents: new discord.Intents(32767),
})
function sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
}

app.get('/callback/', async (req, res) => {
    let gid = req.query.state;
    let row = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(gid);
    let row2 = db.prepare(`SELECT * FROM role WHERE guild_id=?`).get(gid);
    if(!row) {
        console.log("1")
        return res.render("fail_guild.ejs")
    }
    let exp = new Date(Date.parse(row.timestamp))
    if (exp < Date.now()){
        console.log("2")
        return res.render("fail_guild.ejs")
    }
    let code = req.query.code;
    let result = await discord_excharge_code(gid, code);
    console.log(result)
    if (result.scope != "identify guilds.join") {
        console.log("3")
        return res.render("fail_scope.ejs")
    }
    let refresh_token = result.refresh_token;
    let user = new REST().setToken(result.access_token);
    let user_id;
    try {
        user_id = await user.get(Routes.user(), {"authPrefix": "Bearer"}).catch(() => {

        })
        user_name = user_id["username"] + "#" + user_id["discriminator"];
        if (user_id["avatar"] != null) {
            user_avatar = "https://cdn.discordapp.com/avatars/" + user_id["id"] + "/" + user_id["avatar"] + ".png?size=128";
        }
        if (user_id["avatar"] == null) {
            user_avatar = null
        }
        
        user_id = user_id["id"];
        console.log(user_name, user_avatar, user_id)
    } catch (error) {
        console.log(error)
        return res.render("fail_re.ejs")
    }
    if (row2) {
        try {
            await bottkn.put(Routes.guildMemberRole(gid, user_id, row2.role_id)).catch(()=>{

            })
        } catch (error) {
            
        }
    }
    let row123 = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(gid);
    try {
        if (user_avatar != null) {
            if(row123.webhook != ""){
                const hook = new Webhook(row123.webhook);
                const embed = new MessageBuilder()
                    .setTitle(`${embed_name}`)
                    .setColor('#DBE6F6')
                    .addField('인증 유저', `${user_name}(${user_id})`, false)
                    .setThumbnail(user_avatar)
                hook.send(embed)
            }
        } else {
            if(row123.webhook != ""){
                const hook = new Webhook(row123.webhook);
                const embed2 = new MessageBuilder()
                    .setTitle(`${embed_name}`)
                    .setColor('#DBE6F6')
                    .addField('인증 유저', `${user_name}(${user_id})`, false)
                    .setThumbnail(user_avatar)
                hook.send(embed2)
            }
            
        }
    } catch (error) {
        console.log(error)
    }

    db.prepare(`DELETE FROM backup_users WHERE guild_id=? and member_id=?;`).run(gid, user_id);
    db.prepare("INSERT INTO backup_users (guild_id, member_id, refresh_token) VALUES (?, ?, ?)").run(gid, user_id, refresh_token);
    return res.render("success.ejs")
})

client.on('ready', async () => {
    console.log(`[+] WAPING ALL BACKUP BOT ON!`)

    while (true) {
        client.user.setActivity(`${client.guilds.cache.size}개의 서버 관리`, { type: 'PLAYING' })
        console.log("Scheule Started")
        const embed3 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('서버 백업이 시작되었습니다.');
        client.channels.cache.get(`${backup_log_channel}`).send({ embeds: [embed3] });
        let rows = db.prepare(`SELECT * FROM guild`).all();
        
        for (let index = 0; index < rows.length; index++){
            let row = rows[index];
            let guild = client.guilds.cache.get(row.guild_id);
            if (guild != undefined) {
                try {
                    console.log(`${guild.name} | Backup Started`)
                    let backup_data = await backup.create(guild, {
                        jsonBeautify: true,
                        jsonSave: true,
                    })
                    console.log(`${guild.name} | Backup Finished`)
                    db.prepare(`UPDATE guild SET filename=? WHERE guild_id=?;`).run(backup_data.id, row.guild_id);

                    let a = guild.members.cache.toJSON()
                    let c = guild.roles.cache.toJSON()
                    let JsonOBJ  = {}
                    
                    try{
                    for (let i of a){
                        
                        // console.log(i.toJSON())
                        let b = i.toJSON()
                        let roles = []
                        // JsonOBJ[b['userId']] = b['roles']
                        
                        for (let ii of b['roles']) {
                            
                            let co = 0;
                            for (let iii of c) {
                                if (ii == iii.id) {
                                    if (co != 0){
                                        console.log(co)
                                        roles.push(co);
                                    }
                                    break;
                                }
                                co++;
                            }
                        }
                        console.log(roles)
                        JsonOBJ[b['userId']] = roles
                    }
                } catch (error) {
                    console.log(error)
                }
                    console.log(JsonOBJ)
                    fs.writeFileSync("./role_backups/" + guild.id + ".json", JSON.stringify(JsonOBJ))
                    console.log(`${guild.name} | RoleBackup Finished`)

                    try {
                        console.log(`${guild.name} | Removing File - ${row.filename}`)
                        await backup.remove(row.filename)
                        console.log(`${guild.name} | Removing File - Success`)
                    } catch (error) {
                        console.log(`${guild.name} | Removing File - Failed`)
                    }
                } catch (error) {
                    
                }
            }
        }
        console.log("Scheule Finished");
        const embed4 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('서버 백업이 종료되었습니다.');
        client.channels.cache.get(`${backup_log_channel}`).send({ embeds: [embed4] });
        await sleep(18000000);
    }
    
});
client.on("guildCreate", (guild) => {
    console.log(`[+] 새로운 서버에 추가됨. 서버 이름 : ${guild.name}`);
    client.user.setActivity(`${client.guilds.cache.size}개의 서버 관리`, { type: 'PLAYING' })
});
function isInt(value) {
    return !isNaN(value) && 
           parseInt(Number(value)) == value && 
           !isNaN(parseInt(value, 10));
}
function dateAdd(date, interval, units) {
    if(!(date instanceof Date))
      return undefined;
    var ret = new Date(date);
    var checkRollover = function() { if(ret.getDate() != date.getDate()) ret.setDate(0);};
    switch(String(interval).toLowerCase()) {
      case 'year'   :  ret.setFullYear(ret.getFullYear() + units); checkRollover();  break;
      case 'quarter':  ret.setMonth(ret.getMonth() + 3*units); checkRollover();  break;
      case 'month'  :  ret.setMonth(ret.getMonth() + units); checkRollover();  break;
      case 'week'   :  ret.setDate(ret.getDate() + 7*units);  break;
      case 'day'    :  ret.setDate(ret.getDate() + units);  break;
      case 'hour'   :  ret.setTime(ret.getTime() + units*3600000);  break;
      case 'minute' :  ret.setTime(ret.getTime() + units*60000);  break;
      case 'second' :  ret.setTime(ret.getTime() + units*1000);  break;
      default       :  ret = undefined;  break;
    }
    return ret;
  }


function formatDate(date){
    return ('{0}-{1}-{3} {4}:{5}:{6}').replace('{0}', date.getFullYear()).replace('{1}', date.getMonth() + 1).replace('{3}', date.getDate()).replace('{4}', date.getHours()).replace('{5}', date.getMinutes()).replace('{6}', date.getSeconds())
}
client.on('message', async (message) => {
    if (message.author.bot) return;
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (message.content.startsWith(".생성")){
    if (!staff.includes(message.author.id)) return
    let license = randomUUID();
    const embed40 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`||**${license}**||`);
    message.author.send({ embeds: [embed40] });
    const embed42 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`생성자 : <@${message.author.id}>(${message.author.username}#${message.author.discriminator})\n라이센스 : ||${license}||(30일)`);
    client.channels.cache.get(`${license_log_channel}`).send({ embeds: [embed42] });
    db.prepare(`INSERT INTO license VALUES (?);`).run(license);
}

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++//

if (message.content.startsWith(".생싱")){
    if (!staff.includes(message.author.id)) return
    let license2 = randomUUID();
    const embed41 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`||**${license2}**||`);
    message.author.send({ embeds: [embed41] });
    const embed43 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`생성자 : <@${message.author.id}>(${message.author.username}#${message.author.discriminator})\n라이센스 : ||${license2}||(10년)`);
    client.channels.cache.get(`${license_log_channel}`).send({ embeds: [embed43] });
    db.prepare(`INSERT INTO license2 VALUES (?);`).run(license2);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (message.content.startsWith(".등록")) {
    if(message.author.id != message.guild.ownerId){
        const embed5 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
        return message.channel.send({ embeds: [embed5] });
    }
    try {
        await message.delete()
    } catch (error) {
    }
    let args = message.content.trim().split(/ +/g);
    if (args.length != 2) {
        const embed6 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('``.등록 [라이센스]`` 형식으로 명령어를 이용해주세요.');
        return message.channel.send({ embeds: [embed6] });
    }
    let row = db.prepare("SELECT * FROM license WHERE license=?").all(args[1]);
    if (row.length == 0) {
        const embed7 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('해당 라이센스는 존재하지 않습니다.');
        return message.channel.send({ embeds: [embed7] });
    } 
    db.prepare("DELETE FROM license WHERE license=?").run(args[1])
    let guild = message.guild;
    let guild_id = guild.id;
    let backup_code = randomUUID();
    let exp = dateAdd(new Date(), "month", 1);
    row = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(guild_id);
    if (row == undefined) {
        db.prepare(`INSERT INTO guild VALUES (?, ?, ?, ?, ?);`).run(guild_id, backup_code, "", formatDate(exp), "");
    } else {
        backup_code = row.backup_code
        let cur_exp = new Date(Date.parse(row.timestamp))
        if (cur_exp > Date.now()){
            exp = dateAdd(cur_exp, "month", 1)
        }
        db.prepare(`UPDATE guild SET timestamp=? WHERE guild_id=?;`).run(formatDate(exp), guild_id);
    }
    const embed8 = new MessageEmbed()
    .setTitle(`${message.guild.name}`)
    .setColor('DBE6F6')
    .setDescription(`복구키 : ||${backup_code}||\n**복구키**는 복구를 할때 쓰이니 꼭 기억해주세요.`);
    message.author.send({ embeds: [embed8] });
    const embed9 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`등록자 : <@${message.author.id}>(${message.author.username}#${message.author.discriminator})\n복구키 : ||${backup_code}||\n서버 : ${message.guild.name}(${message.guild.id})\n라이센스 : ${args}(30일)`);
    client.channels.cache.get(`${ba_log_channel}`).send({ embeds: [embed9] });
    const embed10 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription('DM을 확인해주세요.');
    message.channel.send({ embeds: [embed10] });
}

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++//

if (message.content.startsWith(".등럭")) {
    if(message.author.id != message.guild.ownerId){
        const embed11 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
        return message.channel.send({ embeds: [embed11] });
    }
    try {
        await message.delete()
    } catch (error) {
    }
    let args = message.content.trim().split(/ +/g);
    if (args.length != 2) {
        const embed12 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('``?등럭 [라이센스]`` 형식으로 명령어를 이용해주세요.');
        return message.channel.send({ embeds: [embed12] });
    }
    let row = db.prepare("SELECT * FROM license2 WHERE license2=?").all(args[1]);
    if (row.length == 0) {
        const embed13 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('해당 라이센스는 존재하지 않습니다.');
        return message.channel.send({ embeds: [embed13] });
    } 
    db.prepare("DELETE FROM license2 WHERE license2=?").run(args[1])
    let guild = message.guild;
    let guild_id = guild.id;
    let backup_code = randomUUID();
    let exp = dateAdd(new Date(), "year", 10);
    row = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(guild_id);
    if (row == undefined) {
        db.prepare(`INSERT INTO guild VALUES (?, ?, ?, ?, ?);`).run(guild_id, backup_code, "", formatDate(exp), "");
    } else {
        backup_code = row.backup_code
        let cur_exp = new Date(Date.parse(row.timestamp))
        if (cur_exp > Date.now()){
            exp = dateAdd(cur_exp, "year", 10)
        }
        db.prepare(`UPDATE guild SET timestamp=? WHERE guild_id=?;`).run(formatDate(exp), guild_id);
    }
    const embed14 = new MessageEmbed()
    .setTitle(`${message.guild.name}`)
    .setColor('DBE6F6')
    .setDescription(`복구키 : ||${backup_code}||\n**복구키**는 복구를 할때 쓰이니 꼭 기억해주세요.`);
    message.author.send({ embeds: [embed14] });
    const embed15 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription(`등록자 : <@${message.author.id}>(${message.author.username}#${message.author.discriminator})\n복구키 : ||${backup_code}||\n서버 : ${message.guild.name}(${message.guild.id})\n라이센스 : ${args}(10년)`);
    client.channels.cache.get(`${ba_log_channel}`).send({ embeds: [embed15] });
    const embed16 = new MessageEmbed()
    .setTitle(`${embed_name}`)
    .setColor('DBE6F6')
    .setDescription('DM을 확인해주세요.');
    message.channel.send({ embeds: [embed16] });
    }
    if (message.content.startsWith(".권한")) {
        if(message.author.id != message.guild.ownerId){
            const embed17 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
            return message.channel.send({ embeds: [embed17] });
        }
        try {
            await message.delete()
        } catch (error) {
            
        }
        let guild = message.guild;
        let guild_id = guild.id;
        let row = db.prepare(`SELECT * FROM role WHERE guild_id=?`).get(guild_id);
        let args1 = message.content.trim().split(/ +/g);
        if (args1.length != 2) {
            const embed18 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription('``.권한 [@권한]`` 형식으로 명령어를 이용해주세요.');
            return message.channel.send({ embeds: [embed18] });
        }
        let role = args1[1].replace("<@", "").replace("!", "").replace("&", "").replace(">", "");
        if (row == undefined) {
            db.prepare(`INSERT INTO role VALUES (?, ?);`).run(guild_id, role);
        } else {
            db.prepare(`UPDATE role SET role_id=? WHERE guild_id=?;`).run(role, guild_id);
        }
        const embed19 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription(`인증이 완료된 유저에게\n<@&${role}>권한이 자동으로 지급됩니다.`);
        message.channel.send({ embeds: [embed19] });
    }
    if (message.content.startsWith(".인증")) {
        if(message.author.id != message.guild.ownerId){
            const embed22 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
            return message.channel.send({ embeds: [embed22] });
        }
        try {
            await message.delete()
        } catch (error) {
            
        }
        let guild_id = message.guild.id
        let row = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(guild_id);
        if (row == undefined){
            const embed23 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription(`해당 서버의 라이센스를 찾지 못하였습니다.`);
            return message.channel.send({ embeds: [embed23] });
        } 
        let exp = new Date(Date.parse(row.timestamp))
        if (exp < Date.now()){
            const embed24 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription(`해당 서버의 라이센스를 찾지 못하였습니다.`);
            return message.channel.send({ embeds: [embed24] });
        }
        let url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&state=${message.guild.id}&response_type=code&scope=identify%20guilds.join`
        const embed25 = new discord.MessageEmbed()
            .setColor('#DBE6F6')
            .setTitle(`${message.guild.name}`)
            .setDescription(`Please authorize your account [here](${url}) to see other channels.\n다른 채널을 보려면 [여기](${url})를 눌러 계정을 인증해주세요.`) // 다른 채널을 보려면 [여기](${url})를 눌러 계정을 인증해주세요.
        
        message.channel.send({ embeds: [embed25] });

    }
    if (message.content.startsWith('.웹훅')) {
        if(message.author.id != message.guild.ownerId){
            const embed20 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
            return message.channel.send({ embeds: [embed20] });
        }
        let guild_id = message.guild.id
        let argv = message.content.split(" ")[1]
        db.prepare(`UPDATE guild SET webhook=? WHERE guild_id=?;`).run(argv, guild_id);
        const embed21 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription('웹훅 세팅이 완료되었습니다.');
        message.channel.send({ embeds: [embed21] });
        
    }
    if (message.content == (".라이센스")) {
        if (message.author.id != message.guild.ownerId) {
            const embed26 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription('당신은 서버 소유권 보유자가 아닙니다.');
            message.channel.send({ embeds: [embed26] });
        }
        else{
            let gid = message.guild.id;
            let row12 = db.prepare(`SELECT * FROM guild WHERE guild_id=?`).get(gid);
            let row23 = db.prepare(`SELECT * FROM backup_users WHERE guild_id=?`).all(gid);
            let exp = row12.timestamp
            const embed27 = new MessageEmbed()
            .setTitle(`${message.guild.name}`)
            .setColor('DBE6F6')
            .setDescription(`만료일 : ${String(exp)}\n복구 인원 : ${row23.length}명`);
            message.channel.send({ embeds: [embed27] });
        }
    }
    if (message.content.startsWith('.복구')) {
        if (message.author.id != message.guild.ownerId) return
        try {
            await message.delete()
        } catch (error) {}
        const embed28 = new MessageEmbed()
        .setTitle(`${embed_name}`)
        .setColor('DBE6F6')
        .setDescription(`복구키를 입력해주세요.`);
        message.channel.send({ embeds: [embed28] });
        let message_backup_id = await message.channel.awaitMessages({
            filter: m => m.author.id === message.author.id,
            max: 1,
            time: 20000,
            errors: ["time"]
        }).catch((err) => {
            const embed29 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription(`시간 초과`);
            return message.channel.send({ embeds: [embed29] });
        });
        try {
            
            await message_backup_id.first().delete();
        } catch (error) {
            
        }
        let backup_code = message_backup_id.first().content
        let guild_data = db.prepare(`SELECT * FROM guild WHERE backup_code=?`).get(backup_code);
        if (guild_data == undefined) {
            const embed30 = new MessageEmbed()
            .setTitle(`${embed_name}`)
            .setColor('DBE6F6')
            .setDescription(`해당 복구키는 존재하지 않습니다.`);
            return message.channel.send({ embeds: [embed30] });
        } else { 
            if (guild_data.guild_id != message.guild.id) {
                
                let old_guild = client.guilds.cache.get(guild_data.guild_id);
                if (old_guild != undefined) {
                    old_guild.leave();
                }
                const embed31 = new MessageEmbed()
                .setTitle(`${message.guild.name}`)
                .setColor('DBE6F6')
                .setDescription(`서버 복구를 시작하였습니다.\n완료되면 **DM**으로 알려드리겠습니다.`);
                message.author.send({ embeds: [embed31] });
                let backup_users = db.prepare(`SELECT * FROM backup_users WHERE guild_id=?`).all(guild_data.guild_id);
                for (let index = 0; index < backup_users.length; index++) {

                    let backup_user = backup_users[index]
                    let result = await discord_refresh_token(backup_user.refresh_token);
                    let user = new REST().setToken(result.access_token);
                    let user_id = backup_user.member_id;
                    let users = String(backup_user.member_id);
                    let guild = message.guild;
                    const yep = String(users)
                    db.prepare(`UPDATE backup_users SET refresh_token=? WHERE member_id=?;`).run(result.refresh_token, user_id);
                    try {
                        await bottkn.put(Routes.guildMember(guild.id, yep), {body: {"access_token": result.access_token}}).catch((error)=>{
                            console.log(error)
                            db.prepare(`DELETE FROM backup_users WHERE guild_id=? and member_id=?;`).run(guild.id, user.member_id);
                        });
                    } catch (error) {
                    }
                }
                db.prepare(`UPDATE guild SET guild_id=? WHERE guild_id=?;`).run(message.guild.id, guild_data.guild_id);
                db.prepare(`UPDATE guild SET guild_id=? WHERE guild_id=?;`).run(message.guild.id, guild_data.guild_id);
                let guild = message.guild;
                let user = message.channel;
                let guild_id = guild.id;
                let backup_code = randomUUID();
                db.prepare(`UPDATE guild SET backup_code=? WHERE guild_id=?;`).run(backup_code, guild_id);
                const embed32 = new MessageEmbed()
                .setTitle(`${message.guild.name}`)
                .setColor('DBE6F6')
                .setDescription(`복구키 : ||${backup_code}||\n**복구키**는 복구를 할때 쓰이니 꼭 기억해주세요.`);
                message.author.send({ embeds: [embed32] });

                try {
                    await backup.load(guild_data.filename, message.guild);
                    const embed33 = new MessageEmbed()
                    .setTitle(`${message.guild.name}`)
                    .setColor('DBE6F6')
                    .setDescription(`서버 복구가 완료되었습니다.\n기존 라이센스는 이동됩니다.`);
                    message.author.send({ embeds: [embed33] });
                    const embed44 = new MessageEmbed()
                    .setTitle(`${embed_name}`)
                    .setColor('DBE6F6')
                    .setDescription(`복구자 : <@${message.author.id}>(${message.author.username}#${message.author.discriminator})\n복구키 : ||${backup_code}||\n서버 : ${message.guild.name}(${message.guild.id})`);
                    client.channels.cache.get(`${bac_log_channel}`).send({ embeds: [embed44] });
                    backup.remove(guild_data.filename);

                    let c = guild.roles.cache.toJSON()
                    const role_file = JSON.parse(fs.readFileSync("./role_backups/" + guild_data.guild_id + ".json"))
                    
                    for(let i of guild.members.cache.toJSON()){
                        for(let role_index of role_file[i.user.id]){
                            console.log(role_index)
                            console.log(c[role_index])
                            
                            i.roles.add(c[role_index]).catch(res =>{ })
                        }
                    }

                } catch (error) {
                    const embed34 = new MessageEmbed()
                    .setTitle(`${message.guild.name}`)
                    .setColor('DBE6F6')
                    .setDescription(`오류 발생으로 복구를 실패하였습니다.`);
                    message.author.send({ embeds: [embed34] });
                }

            } else {
                try{
                    const embed35 = new MessageEmbed()
                    .setTitle(`${message.guild.name}`)
                    .setColor('DBE6F6')
                    .setDescription(`해당 서버는 원본 서버입니다.`);
                    message.author.send({ embeds: [embed35] });
                }
                catch(error){

                }
            }
        }

    }
});
  
client.login(TOKEN);

app.listen(port, () => {
    console.log(`[+] 외부 포트를 ${port}로 열었습니다.`)
})