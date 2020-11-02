require('dotenv').config({
  path: __dirname + '/../.env'
});

const {
  Client,
  Attachment,
  MessageAttachment
} = require('discord.js');

const Discord = require('discord.js');
const bot = new Client();
const fs = require('fs')
const cron = require('cron')
const memberStats = require('./cmds/memberStats')
const history = require('./cmds/history')
const graph = require('./cmds/graph')
const id = require('./cmds/id')
const link = require('./cmds/link')
const help = require('./cmds/help')
const test = require('./cmds/test')
const ballistics = require('./cmds/ballistics/data')

bot.on('ready', async () => {
  console.info(`Logged in as ${bot.user.tag}!`);
  graph.init()
  const initStats = cron.job('0 3 * * *', () => graph.init())
  const updateStats = cron.job('*/10 * * * *', () => graph.update())
  initStats.start()
  updateStats.start()
});

bot.on('message', async message => {
  if (message.content.toLowerCase().includes("thunderer") == true) {
    console.info('Loading Ace Copypasta...')
    const attachment = new MessageAttachment('https://cdn.discordapp.com/attachments/700145176655691893/760377207738204172/image0.png');
    message.channel.send(attachment);
  } 
  if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

  var command = message.content.toLowerCase().slice(process.env.PREFIX.length).split(' ')[0];

  var args = message.content.split(' ').slice(1);
  if (message.channel.id != '707382908242886757') {
    return;
  } 
  if (message.author.id == '329081343797624832') {
    switch (command) {
      case 'lb':
        ballistics.listKeys()
        break

      case 'backup':
        graph.backup(args[0])
        break

      case 'll':
      case 'listLinks':
        message.channel.send(link.listLinks())
        break

      case 'i':
      case 'import':
        link.importUsers(args[0])
        break
      case 'loadballistics':
        console.info('Loading ballistic data...')
        await ballistics.init()
        console.info('Done!')
        message.channel.send('Ballistic data has been loaded.')
        break

      case 'debug':
      case 'listGraph':
        graph.debug(args[0])
        break

      case 'test':
        test.test()
        break

      case 'init':
        graph.init()
        break

      case 'id':
        let userid = await id.id(args[0])
        message.channel.send(userid.response)
        break

      case 'shipid':
        let shipid = await id.shipid(args[0])
        message.channel.send(`${shipid.ship_name}: ${shipid.ship_id}`)
        break

      case 'a':
      case 'add':
        try {
          var response = await link.add(args[0])
          message.channel.send(`\`${response}\` added to database.`)
        } catch (err) {
          message.channel.send(err.message)
        }
        break
    }
  }

  switch (command) {

    case 'help':
      message.channel.send({
        embed: help.help()
      })
      break

    case 'ballistics-menu':
    case 'bm':
      await ballistics.test(bot, message)
      break

    case 'b':
    case 'ballistics':
      try {
        await ballistics.generateBallisticsGraph(args, true)
        const attachment = new Discord.MessageAttachment('./ballistics.png')
        message.channel.send('', attachment)
      } catch (err) {
        message.channel.send(err.message)
      }
      break

    case 'h':
    case 'history':
      try {
        let embed = await history.history(args[0], args[1])
        message.channel.send({
          embed
        })
      } catch (err) {
        message.channel.send(err.message)
      }
      break

    case 'ct':
    case 'clantop':
      try {
        let isCompact = args[2] == 'e' ? false : true
        let embed = await memberStats.memberStats(args[0], args[1], isCompact)
        message.channel.send({
          embed
        })
      } catch (err) {
        message.channel.send(err.message)
      }
      break

    case 'g':
    case 'graph':
      let user = message.author.id
      let shipQuery = args[0]
      let mode = args[1]
      if (args[1]) {
        shipQuery = args[1]
        mode = args[2]
        try {
          user = getUserFromMention(args[0]).id
        } catch (err) {
          user = {
            username: args[0]
          }
        }
      }
      try {
        await graph.graph(user, shipQuery, mode)
        const attachment = new Discord.MessageAttachment('./graph.png')
        message.channel.send('', attachment)
      } catch (err) {
        message.channel.send(err.message)
      }
      break

    case 'u':
    case 'update':
      await graph.update()
      message.channel.send('Stats have been updated.')
      break

    case 'link':
      let author = message.author
      let name = args[0]
      if (args[1]) {
        author = getUserFromMention(args[0])
        name = args[1]
      }
      try {
        let response = await link.link(author.id, name)
        message.channel.send(`${author} has been linked to \`${response}\``)
      } catch (err) {
        message.channel.send(err.message)
      }
      break
  }

})

function getUserFromMention(mention) {
  if (!mention) return;

  if (mention.startsWith('<@') && mention.endsWith('>')) {
    mention = mention.slice(2, -1)

    if (mention.startsWith('!')) {
      mention = mention.slice(1)
    }
    return bot.users.get(mention)
  } else {
    throw new Error('Please enter a valid user')
  }
}

bot.login();
