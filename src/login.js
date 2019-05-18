const readline = require('readline')
const { encrypt } = require('./enc')
const login = async () => {
  const stdin = process.openStdin()
  const cl = readline.createInterface(process.stdin, process.stdout)
  const question = function (q) {
    return new Promise(resolve => {
      cl.question(q, answer => {
        resolve(answer)
      })
    })
  }
  const hiddenQuestion = query =>
    new Promise(resolve => {
      process.stdin.on('data', char => {
        char = char + ''
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.pause()
            break
          default:
            process.stdout.clearLine()
            readline.cursorTo(process.stdout, 0)
            process.stdout.write(query + Array(cl.line.length + 1).join('*'))
            break
        }
      })
      cl.question(query, value => {
        cl.history = cl.history.slice(1)
        resolve(value)
      })
    })
  const host_ = await question('OCE host ? ')
  const { origin } = new URL(host_)

  const username = await question('Your username? ')
  let password = await hiddenQuestion('Your password? ')
  const data = Buffer.from(`${username}:${password}`).toString('base64')
  password = ''
  const auth = `Basic ${data}` // process.env.OCE_AUTH
  const token = await encrypt(JSON.stringify({ host: origin, auth }))
  console.log(
    `set OCE_CLI_CONFIG in your environment to bypass login next time. `
  )
  console.log(`export OCE_CLI_CONFIG="${token}"`)
  process.env.OCE_AUTH = `${token}`
  return token
}

module.exports = { login }
