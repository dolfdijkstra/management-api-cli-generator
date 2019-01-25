const fs = require('fs')
const _ = require('lodash')
const path = require('path')

const toParameterName = name =>
  name === 'default' ? '_default' : _.camelCase(name)

const paramValue = p => {
  if (p.in === 'header' && p.name === 'X-Requested-With') {
    return '"XMLHttpRequest"'
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

const escapeDescription = param =>
  param.description ? param.description.replace("'", "\\'") : ''

const onlyFirst = (e, i) => i === 0

const readJSON = require('./util').readJSON
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
  source += `.description('${m.summary}')`
  const bodyParams = m.parameters.filter(p => p.in === 'body').filter(onlyFirst)
  const otherParams = m.parameters
    .filter(p => p.in !== 'body')
    .filter(p => !(p.in === 'header' && p.name === 'X-Requested-With'))
  const optionParams = m.parameters
    .filter(p => !(p.in === 'header' && p.name === 'X-Requested-With'))
    .sort(requiredFirst)
  source += optionParams
    .map(
      p =>
        `.option('--${_.camelCase(p.name)} <value>','${escapeDescription(p)}')`
    )
    .join('\n')
  const otherMapper = p =>
    'const ' + toParameterName(p.name) + '=' + 'cmd.' + _.camelCase(p.name)
  const bodyMapper = p =>
    `const  ${toParameterName(p.name)} = await readStdIn()`
  source += `.action(async cmd => {
           ${otherParams.map(otherMapper).join('\n')}
           ${bodyParams.map(bodyMapper).join('\n')}
        op.${operationId}(${m.parameters
  .map(paramValue)
  .join(',')}).then(responseHandler).catch(err => { console.error(err) })
      })
      `
  return source
}
const generate = (swaggerFile, targetDir) => {
  return readJSON(swaggerFile).then(json => {
    let version = json.info.version
    if(version.split('.') < 3 ) version = version +'.0'
    const tags = json.tags.reduce((aggr, o) => ({ ...aggr, [o.name]: {} }), {
      Tokens: {}
    })

    Object.entries(json.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, op]) => {
        op.tags.forEach(tag => {
          if (!tags[tag]) {
            throw new Error(tag)
          }
          tags[tag][op.operationId] = { method, path, ...op }
        })
      })
    })
    fs.createReadStream(path.join(__dirname, 'cli-util.js')).pipe(
      fs.createWriteStream(path.join(targetDir, 'src', 'cli-util.js'))
    )

    Object.entries(tags).map(([tag, ops]) => {
      let source = `#!/usr/bin/env node

    const program = require('commander');
    const {readConfig,readStdIn ,responseHandler} = require('./cli-util')
    const {${_.camelCase(tag)}} = require('./client');
    const {host,auth} = readConfig()
    console.log('Using CEC at '+ host)

    const op = ${_.camelCase(tag)}(host, auth)
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
        
        `
      fs.writeFile(
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
    const packageCommands = {
      bin: Object.keys(tags).reduce(
        (aggr, key) => ({
          ...aggr,
          ['cec-' + _.camelCase(key)]: `./src/cli-${_.camelCase(key)}.js`
        }),
        {}
      )
    }
    return addBins(targetDir, packageCommands)
  })
}
module.exports = { generate }
