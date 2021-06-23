const Discord = require("discord.js");

const client = new Discord.Client();

const config = require("./config.json");

const svg2img = require("svg2img");

const { MessageEmbed } = require("discord.js");

const svgCaptcha = require("svg-captcha");

const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./data/database.db", sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {

  if (err) {

    console.error(err.message);

  }

  console.log("Connected to the database.");

});

 

db.run(`CREATE TABLE IF NOT EXISTS guilds(

  id TEXT  

)

`)

 

client.getGuildConfig = (id) => {

  return new Promise((resolve, reject) => {

    let quary = "SELECT * FROM guilds WHERE id = ?"

    db.get(quary, [id], (err, row) => {

      if (err) return console.log(err);

 

      return row

    })

  })

};

 

client.getConfig = async (guild) => {

  let guildConfig;

  let defaultConfig;

  if (guild) await client.getGuildConfig(guild.id).then(result => guildConfig = result[0]);

  await client.getGuildConfig(0).then(result => defaultConfig = result[0]);

  const defaults = defaultConfig || {};

  const guildData = guildConfig || {};

  const returnObject = {};

  Object.keys(defaults).forEach((key) => {

    returnObject[key] = guildData[key] ? guildData[key] : defaults[key];

  });

  return returnObject;

};

 

client.updateGuildConfig = (guild, key, value) => {

  db.run(`UPDATE guilds SET ${key} = ? WHERE id = ?`, [value, guild.id], async function(err, rows)

  {

    if (err) return console.log("An error occurred while trying to update guild settings.", err);

  });

};

 

client.addBan = (user) => {

  db.run("INSERT OR IGNORE INTO banlist (id) VALUES (?)", [user], async function(err, rows)

  {

    if (err) return console.log("An error occurred while trying to add into banlist", err);

  });

};

 

client.getBans = () => {

  return new Promise((resolve, reject) => {

    const banlist = [];

    db.all("SELECT id FROM banlist", function(err, rows)

    {

      if (err) reject(err);

      rows.forEach(r => {

        banlist.push(r.id);

      });

      resolve(banlist);

    });

  });

};

 

const options = {

  background: "#7289DA",

  color: false,

  size: 6 

};

 

client.img = (data) => {

  return new Promise((resolve, reject) => {

    svg2img(data, function(error, buffer) {

      return resolve(buffer);

    });

  });

};

 

client.awaitReply = async (msg, question, limit = 60000) => {

  const filter = m=>m.author.id == msg.author.id;

  await msg.channel.send(question);

  try {

    const collected = await msg.channel.awaitMessages(filter, { max: 1, time: limit, errors: ["time"] });

    return collected.first().content;

  } catch (e) {

    return false;

  }

};

 

client.awaitReplyDM = async (member, msg, question, limit = 60000) => {

  const filter = m => member.id == member.id;

  // const msg = await member.send(question);

  try {

    const collected = await msg.channel.awaitMessages(filter, { max: 1, time: limit, errors: ["time"] });

    return collected.first().content;

  } catch (e) {

    return false;

  }

};

 

client.wait = require("util").promisify(setTimeout);

 

client.clean = async (client, text) => {

  if (text && text.constructor.name == "Promise")

    text = await text;

  if (typeof evaled !== "string")

    text = require("util").inspect(text, {depth: 1});

 

  text = text

    .replace(/`/g, "`" + String.fromCharCode(8203))

    .replace(/@/g, "@" + String.fromCharCode(8203))

    .replace(client.token, "");

 

  return text;

};

 

client.on("ready", async () => {

  console.log(`Logged in as ${client.user.tag}`);

});

 

client.on("guildCreate", guild => {

  console.log(`New guild added ${client.user.tag}: ${guild.name} (${guild.id}) with ${guild.memberCount - 1} members`);

  db.run("INSERT INTO guilds (id) VALUES (?)", guild.id, function(err, rows)

  {

 

  });

});

 

 

client.on("guildMemberAdd", async member => {

  const banlist = await client.getBans().then(r => r);

  if (banlist.includes(member.id)) return member.ban({ days: 1, reason: "Auto-Banned by Protection - Bot Detected" }); // if account ID is in the banlist, it'll get bananed from the server

  const Config = await client.getConfig(member.guild).then(r => r);

  if (config.type === "password") {

    const msg = await member.send(`**${member.guild.name}** is password protected. Please enter the password.`);

    const response = await client.awaitReplyDM(member, msg, 60000);

    if (response.includes(config.password)) {

      msg.reply("Successfully authenticated... Granting access...");

      member.addRole(config.role);

    } else {

      msg.reply(`Wrong password. Type \`${config.prefix}password\` for another try.`);

    }

  } else if (config.type === "captcha") {

    member.send(`This server is protected by captcha. Type \`${config.prefix}verify\` in <#${member.guild.channels.cache.find(c => c.name === config.verificationChannel).id}>`);

  }
 
});

 

 

client.on("message", async message => {
  
  if (message.guild) {

    const verChan = message.guild.channels.cache.find(c => c.name === config.verificationChannel);

    if (verChan) {

      if (message.channel.name === verChan.name && (config.autoban === "true")) {

        if (message.content.includes("http")) { // bots usually post links, this will check if message contains a link, and ban the account but also add it to the global banlist

          await client.addBan(message.author.id);

          message.guild.fetchMember(message.author).then(m => {

            m.ban({ days: 1, reason: "Auto-Banned by Protection - Bot Detected" });

          });

        }

      }

    }

  }

 

  const args = message.content.split(" ").slice(1);

 

  if (message.content.startsWith(`${config.prefix}eval`)) {

    if (message.author.id) return;

    const code = args.join(" ");

    try {

      const evaled = eval(code);

      const clean = await client.clean(client, evaled);

      message.channel.send(`\`\`\`js\n${clean}\n\`\`\``);

    } catch (err) {

      message.channel.send(`\`ERROR\` \`\`\`xl\n${await client.clean(client, err)}\n\`\`\``);

    }

  }

 

  if (message.content.startsWith(`${config.prefix}help`)) {

    message.delete();

    const embed = new MessageEmbed()

      .setColor("1ABC9C")

      .setTitle("Available Commands")

      .setDescription(`This server's prefix: \`${config.prefix}\`

      \`setup\` - bot setup on your server, avg completion 2 minutes.

      \`config\` - bot configuration for this server, you can change settings here

      \`verify\` - captcha verification command for new members, can only be used in the verification channel

      \`password\` - can only be used in the verification channel to re-try the server password by new members\n

      **[ADD TO SERVER](https://discordapp.com/oauth2/authorize?client_id=566995429330518026&scope=bot&permissions=76822) | [SUPPORT SERVER](https://discord.gg/WRPvpt8KyS) | [UPVOTE](https://discordbots.org/bot/$${client.user.id}/vote)**

      `);

    message.channel.send(embed);

  }

 

  if (message.content.startsWith(`${config.prefix}verify`)) {

    message.delete();

    if (message.channel.name !== config.verificationChannel) return;

    if (message.channel.type === "dm") return message.channel.send("This command does not work via DM.");

    const captcha = await svgCaptcha.create(options);

    const attachment = new Discord.Attachment(await client.img(captcha.data).then(r => r), "captcha.png");

    const embed = new MessageEmbed()

      .setColor("1ABC9C")

      .setDescription("Reply with the captcha (case-sensitive)")

      .attachFile(attachment)

      .setImage("attachment://captcha.png");

    const m1 = await message.author.send("Generating captcha...").catch(async () => { 

      const delmsg = await message.reply("I'm unable to send you a direct message. Make sure to allow direct messages from server members in the privacy settings!"); 

      await client.wait(7000);

      return delmsg.delete();

    });

    m1.delete();

    const msg = await message.author.send(embed);

    const response = await client.awaitReplyDM(message.member, msg, 60000);

    if (!response) return message.author.send("Expired.").catch(async () => { 

      const delmsg = await message.reply("I'm unable to send you a direct message. Make sure to allow direct messages from server members in the privacy settings!"); 

      await client.wait(7000);

      return delmsg.delete();

    });

    if (response.includes(captcha.text)) {

      msg.reply("You passed the captcha... Granting access...");

      const role = await message.guild.roles.cache.find(r => r.name.toLowerCase() === config.role.toLowerCase());

      if (role) message.member.addRole(role.id);

    } else {

      const logs = message.guild.channels.cache.find(c => c.name === config.logsChannel);

      if (logs) logs.send(`Failed captcha attempt by ${message.author.tag}`);

      return msg.reply(`Wrong captcha! Try again by typing \`${config.prefix}verify\` again in <#${message.guild.channels.cache.find(c => c.name === config.verificationChannel).id}>`);

    }

  }

  if (message.content.startsWith(`${config.prefix}password`)) {

    message.delete();

    if (message.channel.type === "dm") return message.channel.send("This command does not work via DM.");

    const msg = await message.member.send(`**${message.guild.name}** is password protected. Please enter the password.`);

    const response = await client.awaitReplyDM(message.member, msg, 60000);

    if (response.includes(config.password)) {

      msg.reply("Successfully authenticated... Granting access...");

      const role = await message.guild.roles.cache.find(r => r.name.toLowerCase() === config.role);

      if (role) message.member.addRole(role.id);

    } else {

      const logs = message.guild.channels.cache.find(c => c.name === config.logsChannel);

      if (logs) logs.send(`Failed password attempt by ${message.author.tag}`);

      msg.reply(`Wrong password. Type \`${config.prefix}password\` for another try.`);

    }

  }

 

  if (message.content.startsWith(`${config.prefix}config`)) {

    if (!message.member.hasPermission("ADMINISTRATOR")) return message.channel.send("Sorry, but you must have the `ADMINISTRATOR` permission to use this command.");

    if (message.channel.type === "dm") return message.channel.send("This command does not work via DM.");

    if (!args.length) {

      const embed = new MessageEmbed()

        .setColor("1ABC9C")

        .setTitle(`Configuration for ${message.guild.name}`)

        .addField("Protection Type", `You can choose between captcha or server password\n**Current**: \`${config["type"]}\`\n\`${config.prefix}config type [password | captcha]\``)

        .addField("Password", `Server password. Only valid if protection type is set to password.\n**Current**: \`${config.password}\`\n\`${config.prefix}config password [new-password]\``)

        .addField("Verification Channel", `This is the channel where new members will be able to type \`${config.prefix}verify\`\n**Current**: ${config["verificationChannel"]}\n\`${config.prefix}config verificationChannel [channel-name]\``)

        .addField("Verified Role", `This is the role that new members will receive after they succcessfully pass the captcha\n**Current**: ${config["role"]}\n\`${config.prefix}config role [role-name]\``)

        .addField("Logs Channel", `This is the channel that will log all verifications\n**Current**: ${config["logsChannel"]}\n\`${config.prefix}config logsChannel [channel-name]\``)

        .addField("AutoBan", `This option will autoban detected bots\n**Current**: ${config.autoban}\n\`${config.prefix}config autoban [true | false]\``)

        .addField("Prefix", `Prefix of the bot in this server\n**Current**: ${config["prefix"]}\n\`${config.prefix}config prefix [prefix]\``);

      return message.channel.send(embed);

    }

 

    const key = args[0];

    if (!key) return message.reply("Please specify a setting that you want to change.");

    if (!config[key]) return message.reply("That is not a setting.");

    if (key.toLowerCase() === "id") return message.reply("You can't edit this setting, it's your server's ID.");

    if (!args[1].length) return message.reply("Please specify a new value");

    if (args[1] === config[key]) return message.reply("This setting already has that value!");

    const types = ["password", "captcha"];

    const autoban = ["true", "false"];

    if (key.toLowerCase() === "type" && !types.includes(args[1])) return message.reply("Protection type must be either `password` or `captcha`");

    if (key.toLowerCase() === "autoban" && !autoban.includes(args[1])) return message.reply("Autoban must be either `true` for enabled or `false` for disabled");

    if (key.toLowerCase() === "role" && !message.guild.roles.cache.find(r => r.name.toLowerCase() === args[1].toLowerCase())) return message.reply("Couldn't find that role in this server!"); 

    if (key.toLowerCase() === "verificationchannel" && !message.guild.channels.cache.find(r => r.name.toLowerCase() === args[1].toLowerCase())) return message.reply("Couldn't find that channel in this server!"); 

    if (key.toLowerCase() === "logschannel" && !message.guild.channels.cache.find(r => r.name.toLowerCase() === args[1].toLowerCase())) return message.reply("Couldn't find that channel in this server!"); 

 

    client.updateGuildConfig(message.guild, key, args[1]);

    message.reply(`\`${key}\` successfully edited to \`${args[1]}\``);

  }

 

  if (message.content.startsWith(`${config.prefix}setup`)) {

    if (!message.member.hasPermission("ADMINISTRATOR")) return message.channel.send("Sorry, but you must have the `ADMINISTRATOR` permission to use this command.");

    const e1 = new MessageEmbed()

      .setColor("1ABC9C")

      .setDescription(`Welcome to <@${client.user.id}>'s setup. To get started, type \`captcha\` for captcha protection or \`password\` for password protection.`);

    const re1 = await client.awaitReply(message, e1, 60000);

    if (!re1) return message.channel.send("Setup waiting period expired. Type the setup command to go through it again!");

    const types = ["password", "captcha"];

    if (!types.includes(re1)) {

      message.reply("Server protection must be either `captcha` or `password`");

    } else {

      client.updateGuildConfig(message.guild, "type", re1);

      message.reply(`Protection type successfully set to \`${re1}\``);

    }

    if (re1 === "captcha") {

      const e2 = new MessageEmbed()

        .setColor("1ABC9C")

        .setDescription(`Please enter the name of the verification channel. This is the channel where new members will have to type \`${config.prefix}verify\` to get access to the server.`);

      const re2 = await client.awaitReply(message, e2, 60000);

      if (!re2) return message.channel.send("Setup waiting period expired. Type the setup command to go through it again!");

      const chan = message.guild.channels.cache.find(c => c.name.toLowerCase() === re2.toLowerCase());

      if (!chan) {

        message.reply("Can't find that channel! Make sure you only type the channel name!");

      } else {

        client.updateGuildConfig(message.guild, "VerificationChannel", re2);

        message.reply(`Verification channel successfully set to \`${re2}\``);

      }

    } else if (re1 === "password") {

      const e2 = new MessageEmbed()

        .setColor("1ABC9C")

        .setDescription(`Please enter the name of the verification channel. This is the channel where new members will have to type \`${config.prefix}password\` incase they type the wrong password via DM.`);

      const re2 = await client.awaitReply(message, e2, 60000);

      if (!re2) return message.channel.send("Setup waiting period expired. Type the setup command to go through it again!");

      const chan = message.guild.channels.cache.find(c => c.name.toLowerCase() === re2.toLowerCase());

      if (!chan) {

        message.reply("Can't find that channel! Make sure you only type the channel name!");

      } else {

        client.updateGuildConfig(message.guild, "VerificationChannel", re2);

        message.reply(`Verification channel successfully set to \`${re2}\``);

      }

      const e3 = new MessageEmbed()

        .setColor("1ABC9C")

        .setDescription("Please enter the server password you want. New members will be asked for this password via DM to get access to the server.");

      const re3 = await client.awaitReply(message, e3, 60000);  

      if (!re3) return message.channel.send("Setup waiting period expired. Type the setup command to go through it again!");  

      client.updateGuildConfig(message.guild, "password", re3);

      message.reply(`Password successfully set to \`${re3}\``);

    }

 

    const e4 = new MessageEmbed()

      .setColor("1ABC9C")

      .setDescription("Please enter the name of the verified role. This protection is based on permissions, this role will have normal permissions that will give access to most of the server to new members, while the @ everyone must be denied of all permissions except for the verification channel.");

    const re4 = await client.awaitReply(message, e4, 60000);

    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === re4.toLowerCase());

    if (!re4) return message.channel.send("Setup waiting period expired. Type the setup command to go through it again!");

    if (!role) {

      message.channel.send("Couldn't find that role. Make sure you enter only the name of the role.");

    } else {

      client.updateGuildConfig(message.guild, "role", re4);

      message.reply(`Role successfully set to \`${re4}\``);

      if (role.position >= message.guild.me.roles.highest.position) message.channel.send("Move my role higher up in the role hierarchy or I won't be able to give out this role!");

    }

 

    const e5 = new MessageEmbed()

      .setColor("1ABC9C")

      .setDescription(`Last but not least, would you like <@${client.user.id}> to deny permissions to all channels for @ everyone except for the Verification Channel? Reply with \`Yes\` or \`No\``);

    const re5 = await client.awaitReply(message, e5, 60000);

    const res = ["yes", "no"];

    if (res.includes(re5.toLowerCase())) {

      if (re5.toLowerCase() === "yes") {

        message.channel.send("Setting permissions...");

        const everyone = message.guild.roles.cache.find(r => r.name === "@everyone");

        message.guild.channels.cache.forEach(async (channel, id) => {

          await channel.overwritePermission(everyone, {

            READ_MESSAGES: false

          });

        });

        await client.wait(2000);

      } 

    } else {

      message.channel.send("You must respond with `Yes` or `No`");

    }

 

    const e6 = new MessageEmbed()

      .setColor("1ABC9C")

      .setDescription(`Basic setup complete! You may review your configuration via the \`${config.prefix}config\` command where you can also modify other settings that were excluded from the setup!`);

    return message.channel.send(e6);

  }

 

});

 

 

client.login(config.token);

 