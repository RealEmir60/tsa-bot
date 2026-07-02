const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');



const fetch = require('node-fetch');

const {

    Client,

    GatewayIntentBits,

    EmbedBuilder,

    REST,

    Routes,

    ApplicationCommandOptionType,

    PermissionFlagsBits,

    ActivityType,

    ModalBuilder,

    TextInputBuilder,

    TextInputStyle,

    ActionRowBuilder,

    ButtonBuilder,

    ButtonStyle

} = require('discord.js');



const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const noblox = require('noblox.js');

const http = require('http');

const fs = require('fs');



const AYARLAR = {

    DISCORD_TOKEN: process.env.DISCORD_TOKEN,

    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,

    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,

    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "",

    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "",

    BRANS_YETKILI_ROL_ID: "1518357724880961656",

    IZIN_ROL_ID: process.env.IZIN_ROL_ID || "0",

    OYUN_ID: process.env.OYUN_ID || "0",

    PORT: process.env.PORT || 3000,

    BOT_SAHIBI_ID: process.env.BOT_SAHIBI_ID || ""

};



const BRANSLAR = {

    "Özel Kuvvetler Komutanlığı": 901158188,

    "Askeri İnzibat": 751296173,

    "Deniz Kuvvetleri Komutanlığı": 594898013,

    "Hava Kuvvetleri Komutanlığı": 850943288,

    "Jandarma Genel Komutanlığı": 523316183,

    "Kara Kuvvetleri Komutanlığı": 683890016,

    "Milli İstihbarat Teşkilatı": 460437686,

    "Sürücü Okulu": 315627660

};



const TUM_RUTBELER = [

    { name: '[OR-1] Acemi Er', value: 1 },

    { name: '[OR-2] Onbaşı', value: 2 },

    { name: '[OR-3] Uzman Onbaşı', value: 3 },

    { name: '[OR-4] Çavuş', value: 4 },

    { name: '[OR-5] Uzman Çavuş', value: 5 },

    { name: '[OF-1/B] Teğmen', value: 11 },

    { name: '[OF-2] Yüzbaşı', value: 13 },

    { name: '[OF-5] Albay', value: 16 }

];



let aktiflikVerisi = new Map();

let izinVerisi = new Map();

let cookieStatus = { aktif: false, sonHata: null, sonKontrol: null };



function verileriYukle() {

    try {

        if (fs.existsSync('./aktiflik.json'))

            aktiflikVerisi = new Map(JSON.parse(fs.readFileSync('./aktiflik.json')));



        if (fs.existsSync('./izinler.json'))

            izinVerisi = new Map(JSON.parse(fs.readFileSync('./izinler.json')));



        console.log('[Veri] Yüklendi');

    } catch {

        console.log('[Veri] Yeni dosya oluşturulacak');

    }

}



function verileriKaydet() {

    try {

        fs.writeFileSync('./aktiflik.json', JSON.stringify([...aktiflikVerisi]));

        fs.writeFileSync('./izinler.json', JSON.stringify([...izinVerisi]));

    } catch (e) {

        console.error('[Veri] Kayıt hatası:', e.message);

    }

}



setInterval(verileriKaydet, 60000);



const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMembers,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.GuildVoiceStates

    ]

});



async function robloxGiris(cookie = null) {

    try {

        const use = cookie || AYARLAR.ROBLOX_COOKIE;

        if (!use) throw new Error("Cookie yok");



        const user = await noblox.setCookie(use);



        cookieStatus = { aktif: true, sonHata: null, sonKontrol: Date.now() };

        AYARLAR.ROBLOX_COOKIE = use;



        return { basarili: true, user: user.UserName };

    } catch (err) {

        cookieStatus = { aktif: false, sonHata: err.message, sonKontrol: Date.now() };

        return { basarili: false, hata: err.message };

    }

}



const clientReady = () => {

    console.log(`[Discord] ${client.user.tag} aktif`);

    client.user.setActivity('TSA System', { type: ActivityType.Watching });

    verileriYukle();

    robloxGiris();

};



client.once('ready', clientReady);



client.on('interactionCreate', async interaction => {



    if (interaction.isAutocomplete()) {

        const focused = interaction.options.getFocused().toLowerCase();

        const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused));

        return interaction.respond(filtered.slice(0, 25));

    }



    if (interaction.isButton()) {

        if (interaction.customId === 'cookie_yenile_btn') {

            if (interaction.user.id !== AYARLAR.BOT_SAHIBI_ID)

                return interaction.reply({ content: 'Yetkisiz', ephemeral: true });



            const modal = new ModalBuilder()

                .setCustomId('cookie_modal')

                .setTitle('Cookie');



            const input = new TextInputBuilder()

                .setCustomId('cookie_input')

                .setLabel('Cookie')

                .setStyle(TextInputStyle.Paragraph);



            modal.addComponents(new ActionRowBuilder().addComponents(input));

            return interaction.showModal(modal);

        }

    }



    if (interaction.isModalSubmit()) {

        if (interaction.customId === 'cookie_modal') {



            const cookie = interaction.fields.getTextInputValue('cookie_input');



            await interaction.deferReply({ ephemeral: true });



            const res = await robloxGiris(cookie);



            return interaction.editReply({

                content: res.basarili

                    ? `OK: ${res.user}`

                    : `FAIL: ${res.hata}`

            });

        }

    }



    if (!interaction.isChatInputCommand()) return;



    const { commandName, member, guild } = interaction;

    await interaction.deferReply();



    try {



        if (['rütbe-değiştir', 'terfi', 'tenzil'].includes(commandName)) {

            if (!member.permissions.has(PermissionFlagsBits.ManageRoles))

                return interaction.editReply('Yetki yok');

        }



        if (commandName === 'rütbe-değiştir') {

            const name = interaction.options.getString('roblox-isim');

            const rank = interaction.options.getInteger('yeni-rütbe');



            const id = await noblox.getIdFromUsername(name);



            await noblox.setRank(AYARLAR.GROUP_ID, id, rank);



            return interaction.editReply('Rütbe değişti');

        }



        if (commandName === 'terfi') {

            const name = interaction.options.getString('roblox-isim');

            const id = await noblox.getIdFromUsername(name);



            await noblox.promote(AYARLAR.GROUP_ID, id);



            return interaction.editReply('Terfi edildi');

        }



        if (commandName === 'tenzil') {

            const name = interaction.options.getString('roblox-isim');

            const id = await noblox.getIdFromUsername(name);



            await noblox.demote(AYARLAR.GROUP_ID, id);



            return interaction.editReply('Tenzil edildi');

        }



    } catch (e) {

        return interaction.editReply('Hata: ' + e.message);

    }

});



client.on('messageCreate', msg => {

    if (msg.author.bot) return;



    const d = aktiflikVerisi.get(msg.author.id) || { mesaj: 0, ses: 0 };

    d.mesaj++;

    aktiflikVerisi.set(msg.author.id, d);

});



client.on('voiceStateUpdate', (oldS, newS) => {

    const id = newS.member?.id || oldS.member?.id;

    if (!id) return;



    const data = aktiflikVerisi.get(id) || { mesaj: 0, ses: 0, join: null };



    if (!oldS.channelId && newS.channelId) {

        data.join = Date.now();

    }



    if (oldS.channelId && !newS.channelId && data.join) {

        data.ses += Math.floor((Date.now() - data.join) / 1000);

        data.join = null;

    }



    aktiflikVerisi.set(id, data);

});



client.login(AYARLAR.DISCORD_TOKEN);



const server = http.createServer((_, res) => {

    res.end('OK');

});



server.listen(AYARLAR.PORT);
