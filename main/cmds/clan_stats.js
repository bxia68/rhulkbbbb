const superagent = require('superagent');
const async = require('async')
const fs = require('fs')
const _ = require('lodash')
const Enmap = require("enmap");
const cron = require('cron')
const plotly = require('plotly')('Shadow_Storm419', 'TxSRgxqeDWdxtwTxzt2H')
const id = require('./id')
const data = require('../utility/data')
const Discord = require('discord.js');

const imageApi = 'https://api.worldofwarships.com/wows/encyclopedia/ships/'
const userDataApi = 'http://vortex.worldofwarships.com/api/accounts/'
const expectedPrApi = 'https://api.wows-numbers.com/personal/rating/expected/json/'
const memberNameApi = 'https://api.worldofwarships.com/wows/account/info/'
const apikey = '3e2c393d58645e4e4edb5c4033c56bd8'

async function getClanStats(player, ship, season=11) {
  let nickname = (await id.id(player)).data
  let account_id = nickname.account_id
  nickname = nickname.nickname
  let ship_id = await id.shipid(ship)
  let ship_name = ship_id.ship_name
  ship_id = ship_id.ship_id

  console.log(`retrieving ${ship_name} stats for ${nickname}`)
  let stats = (await superagent.get(userDataApi.concat(account_id, '/ships/', ship_id))).body.data[account_id]
  if (stats.hidden_profile) return
  stats = stats.statistics[ship_id].seasons[season].clan

  let pr = await generatePR({
    'wins': stats.wins,
    'battles': stats.battles_count_512,
    'damage_dealt': stats.damage_dealt,
    'frags': stats.frags
  }, ship_id)

  let images = (await superagent.get(imageApi).query({
    application_id: apikey,
    ship_id: ship_id,
    fields: 'images.small'
  })).body.data[ship_id].images.small

  let color
  if (pr < 750) color = '#FE0E00'
  else if (pr < 1100) color = '#FE7903'
  else if (pr < 1350) color = '#FFC71F'
  else if (pr < 1550) color = '#44B300'
  else if (pr < 1750) color = '#318000'
  else if (pr < 2100) color = '#02C9B3'
  else if (pr < 2450) color = '#D042F3'
  else color = '#A00DC5'

  const embed = {
    color: color,
    title: `[Clan] Stats of ${nickname}'s ${ship_name} (NA)`,
    thumbnail: {
      url: images,
    },
    description: `**Battles**: ${stats.battles_count_512} (${stats.wins}W/${stats.losses}L/${stats.battles_count_512-stats.wins-stats.losses}T - WR: ${Math.round(stats.wins/stats.battles_count_512*100)}% - SR: ${Math.round(stats.survived/stats.battles_count_512*100)}%)\n**PR**: ${pr}`,
    fields: [{
        name: 'Average scores',
        value: `- Damage: ${Math.round(stats.damage_dealt/stats.battles_count_512)}\n- Kills: ${round(stats.frags/stats.battles_count_512, 2)}\n- Planes destroyed: ${round(stats.planes_killed/stats.battles_count_512, 2)}`,
        inline: true,
      },
      {
        name: 'Best scores',
        value: `- Damage: ${stats.max_damage_dealt}\n- Kills: ${stats.max_frags}\n- Planes destroyed: ${stats.max_planes_killed}`,
        inline: true,
      },
      {
        name: 'Main battery',
        value: `- Kills: ${stats.frags_by_main} (Max: ${stats.max_frags_by_main})\n- Shots: ${stats.shots_by_main} (Acc: ${Math.round(stats.hits_by_main/stats.shots_by_main*100) || 0}%)`,
        inline: true,
      },
      {
        name: 'Torpedoes',
        value: `- Kills: ${stats.frags_by_tpd} (Max: ${stats.max_frags_by_tpd})\n- Shots: ${stats.shots_by_tpd} (Acc: ${Math.round(stats.hits_by_tpd/stats.shots_by_tpd*100) || 0}%)`,
        inline: true,
      },
      {
        name: 'Secondary battery',
        value: `- Kills: ${stats.frags_by_atba} (Max: ${stats.max_frags_by_atba})\n- Shots: ${stats.shots_by_atba} (Acc: ${Math.round(stats.hits_by_atba/stats.shots_by_atba*100 || 0)}%)`,
        inline: true,
      },
      {
        name: 'Others',
        value: `- Ramming: ${stats.frags_by_ram} (Max: ${stats.max_frags_by_ram})\n- Aircraft: ${stats.frags_by_planes} (Max: ${stats.max_frags_by_planes})`,
        inline: true,
      },
    ],
  }

  return embed
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

function round(num, places) {
    var multiplier = Math.pow(10, places);
    return Math.round(num * multiplier) / multiplier;
}

exports.getStats = getClanStats

// getClanStats('Shadow_Storm419', 'petro', 11)
