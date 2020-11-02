const superagent = require('superagent');
const async = require('async')
const fs = require('fs')
const _ = require('lodash')
const Enmap = require("enmap");
const shipGenerator = require(`${__dirname}/../utility/shipGenerator`)
const cron = require('cron')
const plotly = require('plotly')('Shadow_Storm419', 'TxSRgxqeDWdxtwTxzt2H')
const id = require('./id')
const data = require('../utility/data')

const userDataApi = 'https://api.worldofwarships.com/wows/ships/stats/'
const expectedPrApi = 'https://api.wows-numbers.com/personal/rating/expected/json/'
const memberNameApi = 'https://api.worldofwarships.com/wows/account/info/'
const apikey = '3e2c393d58645e4e4edb5c4033c56bd8'

console.log(data.enmap.keyArray());

class ShipStats {
  constructor(games_list, all_stats, last_battle_time) {
    this.games_list = games_list
    this.all_stats = all_stats
    this.last_battle_time = last_battle_time
  }

  updateStats(updated_stats, last_battle_time) {
    this.last_battle_time = last_battle_time
    if (updated_stats.battles == this.all_stats.battles) return console.log('No new games played in randoms.')
    var newStatBlock = {
      damage_dealt: updated_stats.damage_dealt - this.all_stats.damage_dealt,
      wins: updated_stats.wins - this.all_stats.wins,
      frags: updated_stats.frags - this.all_stats.frags,
      battles: updated_stats.battles - this.all_stats.battles
    }
    this.all_stats = updated_stats
    this.games_list.push(newStatBlock)
  }

  async getPRGraph(ship_id) {
    var graph = [{
      x: [],
      y: [],
      type: 'scatter'
    }]
    var point = {
      damage_dealt: 0,
      wins: 0,
      frags: 0,
      battles: 0
    }
    for (var i = 0; i < this.games_list.length; i++) {
      point.damage_dealt += this.games_list[i].damage_dealt
      point.wins += this.games_list[i].wins
      point.frags += this.games_list[i].frags
      point.battles += this.games_list[i].battles
      let pr = await generatePR(point, ship_id)
      graph[0].x.push(point.battles)
      graph[0].y.push(pr)
    }
    return graph
  }

  getOtherGraph(mode) {
    var graph = [{
      x: [],
      y: [],
      type: 'scatter'
    }]
    var point = {
      battles: 0,
      data: 0
    }
    let finder
    let titlemode
    switch (mode) {
      case 'dmg':
        finder = 'damage_dealt'
        titlemode = 'Avg DMG'
        break
      case 'wr':
        finder = 'wins'
        titlemode = 'WR'
        break
      case 'kills':
        finder = 'frags'
        titlemode = 'Avg Kills'
        break
    }
    for (var i = 0; i < this.games_list.length; i++) {
      point.data += this.games_list[i][finder]
      point.battles += this.games_list[i].battles
      let data = point.data / point.battles
      if (mode == 'wr') data *= 100
      graph[0].x.push(point.battles)
      graph[0].y.push(data)
    }
    return [graph, titlemode]
  }

  static cast(object) {
    return new ShipStats(object.games_list, object.all_stats, object.last_battle_time)
  }
}

async function updateHandler() {
  console.log('Updating...                          ' + new Date);
  let idList = data.enmap.get('ids')
  idList = Object.keys(idList)
  for (var i = 0; i < idList.length; i++) {
    await update(idList[i])
  }
  console.log('Done!');
}

async function initHandler() {
  await shipGenerator.shipGenerator()

  let expected_values = await superagent.get(expectedPrApi)
  expected_values = expected_values.body.data

  data.enmap.set('expected_values', expected_values)

  fs.writeFileSync(`./enmap-backup${(new Date()).getDate()}.json`, data.enmap.export())
}

function debug(key) {
  console.log(data.enmap.get(key))
}

async function update(playerid) {

  let prevStats = await data.enmap.get(playerid)

  let updated_stats = await superagent.get(userDataApi).query({
    application_id: apikey,
    account_id: playerid,
    fields: 'last_battle_time, ship_id, pvp.battles, pvp.damage_dealt, pvp.wins, pvp.frags'
  })

  let memberName = await superagent.get(memberNameApi).query({
    application_id: apikey,
    account_id: playerid,
    fields: 'nickname, hidden_profile'
  })

  if (memberName.body.data[playerid].hidden_profile) return
  if (updated_stats.body.data[playerid] === null) return

  updated_stats = updated_stats.body.data[playerid]

  for (var i = 0; i < updated_stats.length; i++) {
    if (!prevStats[updated_stats[i].ship_id]) {
      data.enmap.set(playerid, new ShipStats([updated_stats[i].pvp], updated_stats[i].pvp, updated_stats[i].last_battle_time),
        updated_stats[i].ship_id)
      continue
    }
    if (prevStats[updated_stats[i].ship_id].last_battle_time < updated_stats[i].last_battle_time) {
      let prevShipStats = data.enmap.get(playerid, updated_stats[i].ship_id)
      prevShipStats = ShipStats.cast(prevShipStats)
      prevShipStats.updateStats(updated_stats[i].pvp, updated_stats[i].last_battle_time)
      data.enmap.set(playerid, prevShipStats, updated_stats[i].ship_id)
    }
  }
}

async function generatePR(player_stats, ship_id) {
  let ship_expected_values = data.enmap.get('expected_values', ship_id)

  let rWins = (player_stats.wins / player_stats.battles) / (ship_expected_values.win_rate / 100)
  let rFrags = (player_stats.frags / player_stats.battles) / ship_expected_values.average_frags
  let rDmg = player_stats.damage_dealt / player_stats.battles / ship_expected_values.average_damage_dealt

  let nDmg = Math.max(0, (rDmg - 0.4) / (1 - 0.4))
  let nFrags = Math.max(0, (rFrags - 0.1) / (1 - 0.1))
  let nWins = Math.max(0, (rWins - 0.7) / (1 - 0.7))

  let PR = 700 * nDmg + 300 * nFrags + 150 * nWins

  return Math.round(PR)
}



async function init(playerid) {

  // data.enmap.clear()

  // test data
  // let testData = fs.readFileSync(`${__dirname}/../playerData/1023637668.json`)
  // let playerstats = JSON.parse(testData)

  if (!data.enmap.has(playerid) || !data.enmap.has(playerid.toString())) {

    let playerstats = await superagent.get(userDataApi).query({
      application_id: apikey,
      account_id: playerid,
      fields: 'last_battle_time, ship_id, pvp.battles, pvp.damage_dealt, pvp.wins, pvp.frags'
    })

    playerstats = playerstats.body.data[playerid]

    console.log(`Adding new stats...`)

    data.enmap.set(playerid, {})

    for (var i = 0; i < playerstats.length; i++) {
      data.enmap.set(playerid, new ShipStats([playerstats[i].pvp], playerstats[i].pvp, playerstats[i].last_battle_time),
        playerstats[i].ship_id)
    }
    console.log('Done!')
  }
}

async function sendGraph(discord_id, shipQuery, mode) {

  let player_id
  let player_name

  if (typeof discord_id === 'object') {
    try {
      console.log(discord_id.username);
      player_id = await id.id(discord_id.username)
      player_id = player_id.data
    } catch (err) {
      throw new Error('Please enter a valid username.')
    }

    let players = Object.keys(data.enmap.get('ids'))

    if (!players.includes(player_id.account_id.toString()) && !players.includes(player_id.account_id)) throw new Error(`${player_id.nickname} is not on the database`)
    player_name = player_id.nickname
    player_id = player_id.account_id
  } else {
    // throw an error if the player is not linked
    if (!data.enmap.has('link', discord_id)) throw new Error('Player is not linked.')

    player_id = data.enmap.get('link', discord_id)
    let players = Object.keys(data.enmap.get('ids'))
    let usernames = Object.values(data.enmap.get('ids'))
    let index = players.indexOf(player_id.toString()) == -1 ? players.indexOf(player_id) : players.indexOf(player_id.toString())
    player_name = usernames[index]
  }

  let ship_id = id.shipid(shipQuery)

  // throw an error if the entered ship does not exist
  if (!ship_id) throw new Error('Please enter an actual ship u big dumb')

  // throw an error if player does not have any games in the specified ship
  if (!data.enmap.has(player_id, ship_id.ship_id)) throw new Error('Player does not have any games in the specified ship.')

  let trace

  console.log(data.enmap.get(player_id, ship_id.ship_id));

  let titlemode

  if (!mode || mode.toLowerCase() == 'pr') {
    trace = await (ShipStats.cast(data.enmap.get(player_id, ship_id.ship_id))).getPRGraph(ship_id.ship_id)
    titlemode = 'PR'
  } else {
    if (['wr', 'kills', 'dmg'].includes(mode.toLowerCase())) {
      trace = await (ShipStats.cast(data.enmap.get(player_id, ship_id.ship_id))).getOtherGraph(mode)
      titlemode = trace[1]
      trace = trace[0]
    } else {
      throw new Error('Please enter an accepted mode (wr, kills, dmg)')
    }
  }


  var layout = {
    title: `${titlemode} Chart of ${player_name}'s ${ship_id.ship_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`,
    xaxis: {
      dtick: 1,
    }
  }

  let figure = {
    'data': trace,
    layout: layout
  }

  let imgOpts = {
    format: 'png',
  }

  await generateImage(figure, imgOpts)
}

async function importBackup(index) {
  const backup = await fs.readFileSync(`./enmap-backup${index}.json`)
  data.enmap.import(backup)
}

function generateImage(figure, imgOpts) {
  return new Promise((resolve, reject) => {
    plotly.getImage(figure, imgOpts, (err, imageStream) => {
      if (err) return reject(err);
      var fileStream = fs.createWriteStream('./graph.png');
      imageStream.pipe(fileStream);
      fileStream.on('error', reject);
      fileStream.on('finish', resolve);
    })
  })
}

exports.init = initHandler
exports.initId = init
exports.graph = sendGraph
exports.update = updateHandler
exports.debug = debug
exports.pr = generatePR
exports.backup = importBackup
