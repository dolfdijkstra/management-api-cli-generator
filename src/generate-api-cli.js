const fs = require('fs')
const _ = require('lodash')
const path = require('path')

const toParameterName = name =>
  name === 'default' ? '_default' : _.camelCase(name)

const paramValue = p => {
  if (p.in === 'header' && p.name === 'X-Requested-With') {
    return 'xRequestedWith: "XMLHttpRequest"'
  }
  if (p.in === 'body') return toParameterName(p.name)
  return toParameterName(p.name)
}

const requiredFirst = (a, b) => {
  if (a.required === b.required) {
    return 0
  }
  if (a.required) return -1
  return 1
}

const escapeQuotes = v => (v ? v.replace("'", "\\'") : '')
const escapeDescription = param => escapeQuotes(param.description)

const onlyFirst = (e, i) => i === 0

const { readJSON } = require('./util')
const addBins = (targetDir, bins) => {
  return readJSON(path.join(targetDir, 'package.json'))
    .then(json => ({ ...json, ...bins }))
    .then(json => {
      fs.writeFileSync(
        path.join(targetDir, 'package.json'),
        JSON.stringify(json, null, 2)
      )
    })
}
const generateCommandSource = ([operationId, m]) => {
  let source = `program.command('${operationId}')`
  source += `.description('${escapeQuotes(m.summary)}')`
  const bodyParams = m.parameters.filter(p => p.in === 'body').filter(onlyFirst)
  const otherParams = m.parameters
    .filter(p => p.in !== 'body')
    .filter(p => !(p.in === 'header' && p.name === 'X-Requested-With'))
  const optionParams = m.parameters
    .filter(p => !(p.in === 'header' && p.name === 'X-Requested-With'))
    .sort(requiredFirst)
  source += otherParams
    .map(
      p =>
        `.option('--${_.camelCase(p.name)} <value>','${escapeQuotes(p.description)}')`
    )
    .join('\n')
  const otherMapper = p =>
    'const ' + toParameterName(p.name) + '=' + 'cmd.' + _.camelCase(p.name)
  const bodyMapper = p =>
    `const  ${toParameterName(p.name)} = await readStdIn()`
  source += `.action(async cmd => {
           ${otherParams.map(otherMapper).join('\n')}
           ${bodyParams.map(bodyMapper).join('\n')}
        op.${operationId}({${m.parameters
  .map(paramValue)
  .join(',')}}).then(responseHandler).catch(err => { console.error(err) })
      })
      `
  return source
}
const generate = (swagger, targetDir) => {
  let version = swagger.info.version
  if (version.split('.') < 3) version = version + '.0'
  const tags = swagger.tags.reduce((aggr, o) => ({ ...aggr, [o.name]: {} }), {})

  const paths = Object.entries(swagger.paths)
  paths.forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, op]) => {
      op.tags.forEach(tag => {
        if (!tags[tag]) {
          throw new Error(tag)
        }
        tags[tag][op.operationId] = { method, path, ...op }
      })
    })
  })
  const files = ['cli-util.js', 'login.js', 'enc.js']
  files.forEach(fileName => {
    fs.createReadStream(path.join(__dirname, fileName)).pipe(
      fs.createWriteStream(path.join(targetDir, 'src', fileName))
    )
  })
  fs.createReadStream(path.join(__dirname, 'cli-base.js')).pipe(
    fs.createWriteStream(path.join(targetDir, 'src', 'cli.js'))
  )

  Object.entries(tags).map(([tag, ops]) => {
    let source = `#!/usr/bin/env node
    ;(async () => {
    const program = require('commander');
    const {readConfig,readStdIn ,responseHandler} = require('./cli-util')
    const {host,auth} = await readConfig()
    if(process.stdout.isTTY) console.log('Using OCE at '+ host)

    const { client } = require('./client');
    const op = client(host, auth).${_.camelCase(tag)}

    program.version('${version}')
    ${Object.entries(ops)
    .map(generateCommandSource)
    .join('\n')}
  
      
    program.parse(process.argv)
        // if not command is found, print help
        if (program.args.length === 0) {
          // e.g. display usage
          program.help();
        }
      })().catch(console.error) 
        `
    fs.writeFileSync(
      path.join(targetDir, 'src/cli-' + _.camelCase(tag) + '.js'),
      source,
      'utf-8',
      err => {
        if (err) {
          console.error(err)
        }
      }
    )
  })
  const cmds = Object.keys(tags)
  const packageCommands = {
    bin: cmds.reduce(
      (aggr, key) => ({
        ...aggr,
        ['oce-management-' + _.camelCase(key)]: `./src/cli-${_.camelCase(
          key
        )}.js`
      }),
      { 'oce-management': './src/cli.js' }
    )
  }
  return addBins(targetDir, packageCommands)
}

module.exports = { generate }
