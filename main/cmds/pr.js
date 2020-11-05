const data = require('../utility/data')
const async = require('async')
const id = require('./id')

async function getPr(ship, dmg, kills, win) {
  let ship_id = (await id.shipid(ship)).ship_id

  let ship_expected_values = data.enmap.get('expected_values', ship_id)

  let rWins
  if (win.toLowerCase() === 'w') rWins = 1 / (ship_expected_values.win_rate / 100)
  else rWins = 0

  let rFrags = kills / ship_expected_values.average_frags
  let rDmg = dmg * 1000 / ship_expected_values.average_damage_dealt

  let nDmg = Math.max(0, (rDmg - 0.4) / (1 - 0.4))
  let nFrags = Math.max(0, (rFrags - 0.1) / (1 - 0.1))
  let nWins = Math.max(0, (rWins - 0.7) / (1 - 0.7))

  let PR = 700 * nDmg + 300 * nFrags + 150 * nWins

  return Math.round(PR)
}

exports.getPr = getPr
