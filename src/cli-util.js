const printJSON = json => {
  console.log(JSON.stringify(json, null, 2))
}
const printText = text => {
  console.log(text)
}
const printBlob = blob => {
  if (process.stdout.isTTY) {
    console.log('<blob>')
  } else {
    console.log(blob)
  }
}
const responseHandler = response => {
  const contentType = response.headers.get('content-type')
  if (response.ok) {
    if (contentType && contentType.includes('application/json')) {
      return response.json().then(printJSON)
    } else if (contentType && contentType.includes('text/')) {
      return response.text().then(printText)
    } else {
      return response.blob().then(printBlob)
    }
  } else {
    console.error('Error with ' + response.status, contentType)
    if (contentType && contentType.includes('application/json')) {
      return response.json().then(printJSON)
    } else if (contentType && contentType.includes('text/')) {
      return response.text().then(printText)
    } else {
      return response.blob().then(printBlob)
    }
  }
}

const readStdIn = () => {
  return new Promise((resolve, reject) => {
    process.stdin.setEncoding('utf8')
    let data = ''
    if (process.stdin.isTTY) {
      console.log(
        'Please provide a body to send with the request. End the input with Ctrl-D.\n'
      )
    }
    process.stdin.on('readable', () => {
      let chunk
      // Use a loop to make sure we read all available data.
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk
      }
    })

    process.stdin.on('end', () => {
      resolve(data)
    })
  })
}
const readConfig = async () => {
  let host = process.env.OCE_HOST
  let auth = process.env.OCE_AUTH
  if (host && auth) {
    host = new URL(host).origin
    return { host, auth }
  }
  const env = process.env.OCE_CLI_CONFIG
  if (env) {
    const { decrypt } = require('./enc')
    let { host, auth } = JSON.parse(await decrypt(env))
    return { host, auth }
  }

  const fs = require('fs')
  const path = require('path')
  const homedir = require('os').homedir()
  const cwd = path.resolve(process.cwd())
  let parent = cwd
  let parts = []

  while (parts.length < 5 && parent.split(path.sep).length > 1) {
    parts.push(path.join(parent, '.oce-config.json'))
    parent = path.dirname(parent)
  }
  const homeConfig = path.join(homedir, '.oce-config.json')
  if (parts.indexOf(homeConfig) === -1) parts.push()
  const config = parts.reduce((a, f) => {
    return a.host && a.token
      ? a
      : fs.existsSync(f)
      ? JSON.parse(fs.readFileSync(f))
      : a
  }, '')
  if (config === '') {
    throw new Error(
      `.oce-config.json could not be found in '${parts.join(
        ','
      )}' or does not have a host and token fields.`
    )
  }
  return { host: new URL(config.host).origin, auth: `Bearer ${config.token}` }
}
module.exports = { readConfig, readStdIn, responseHandler }
