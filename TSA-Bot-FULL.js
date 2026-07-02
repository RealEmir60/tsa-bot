const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

const komutlar = [
    new SlashCommandBuilder()
        .setName('ses-katıl')
        .setDescription('Botu sesli kanala sokar')
        .addChannelOption(o => o.setName('kanal').setDescription('Girilecek ses kanalı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ses-çıkış')
        .setDescription('Botu sesli kanaldan çıkarır'),
    
    new SlashCommandBuilder()
        .setName('çal')
        .setDescription('YouTube linkinden müzik çalar')
        .addStringOption(o => o.setName('link').setDescription('YouTube linki').setRequired(true))
].map(c => c.toJSON());

client.once('clientReady', async () => {
    console.log(`[Discord] | TSA Ses Bot | ${client.user.tag} aktif!`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: komutlar });
        console.log(`[Discord] ✅ ${komutlar.length} komut yüklendi`);
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const n = i.commandName;
    
    try {
        if (n === 'ses-katıl') {
            const kanal = i.options.getChannel('kanal');
            if (!kanal.isVoiceBased()) return i.reply({ content: '❌ Ses kanalı seç!', ephemeral: true });
            
            const connection = joinVoiceChannel({
                channelId: kanal.id,
                guildId: i.guild.id,
                adapterCreator: i.guild.voiceAdapterCreator,
            });
            
            connection.subscribe(player);
            await i.reply({ content: `✅ ${kanal} kanalına katıldım!`, ephemeral: true });
        }
        
        else if (n === 'ses-çıkış') {
            const connection = getVoiceConnection(i.guild.id);
            if (!connection) return i.reply({ content: '❌ Zaten bir kanalda değilim!', ephemeral: true });
            
            player.stop();
            connection.destroy();
            await i.reply({ content: '✅ Sesli kanaldan çıktım!', ephemeral: true });
        }
        
        else if (n === 'çal') {
            await i.deferReply();
            const link = i.options.getString('link');
            const connection = getVoiceConnection(i.guild.id);
            
            if (!connection) return i.editReply('❌ Önce `/ses-katıl` ile bir kanala girmeliyim!');
            
            try {
                const stream = await play.stream(link, { discordPlayerCompatibility: true });
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                
                player.play(resource);
                await i.editReply(`🎵 Çalıyor: ${link}`);
            } catch (e) {
                console.error(e);
                await i.editReply('❌ Müzik çalınamadı! YouTube linki olduğundan emin ol.');
            }
        }
    } catch (e) {
        console.error(e);
        await i.reply({ content: '❌ Hata oluştu!', ephemeral: true }).catch(() => {});
    }
});

player.on(AudioPlayerStatus.Idle, () => {
    console.log('[Müzik] Çalma bitti');
});

player.on('error', error => {
    console.error('[Müzik] Hata:', error);
});

client.login(TOKEN);
