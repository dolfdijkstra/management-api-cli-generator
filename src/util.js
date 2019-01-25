const fs = require('fs')
const fsp = fs.promises

const readFile = fileName => {
  return fsp.readFile(fileName, 'utf-8').then(s => s.trim())
}

const readJSON = fileName => {
  return fsp.readFile(fileName, 'utf-8').then(j => JSON.parse(j))
}
const token = () => {
  return config().then(c => c.token)
}
const config = () => {
  return readJSON('.cec-config.json')
}
const print = data => {
  console.log(JSON.stringify(data, null, 2))
}
module.exports = {
  readFile,
  readJSON,
  config,
  token,
  print
}
