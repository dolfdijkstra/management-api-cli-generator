const fs = require('fs')
const _ = require('lodash')
const path = require('path')
const copydir = require('copy-dir')

const jsKeywords = [
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield'
]
const toParameterName = name =>
  jsKeywords.indexOf(name) !== -1 ? `_${_.camelCase(name)}` : _.camelCase(name)

const paramValue = p => {
  if (p.in === 'header' && p.name === 'X-Requested-With') {
    return 'xRequestedWith: "XMLHttpRequest"'
  }
  if (p.in === 'body') return toParameterName(p.name)
  return toParameterName(p.name)
}

const escapeQuotes = v => (v ? v.replace(/'/g, "\\'") : '')
const escapeBackticks = v => (v ? v.replace(/`/g, '\\`') : '')

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
const generateCommandSource = paramRefs => ([operationId, m]) => {
  let source = `program.command('${operationId}')`
  source += `.description('${escapeQuotes(m.summary)}')`
  const parameters = (m.parameters || []).map(p =>
    p.$ref ? paramRefs(p.$ref) : p
  )
  const bodyParams = parameters.filter(p => p.in === 'body').filter(onlyFirst)
  const otherParams = parameters
    .filter(p => p.in !== 'body')
    .filter(p => !(p.in === 'header' && p.name === 'X-Requested-With'))

  source += otherParams
    .map(
      p =>
        `.${p.required ? 'requiredOption' : 'option'}('--${_.camelCase(
          p.name
        )} <value>',\`${escapeBackticks(p.description)}\`)`
    )
    .join('\n')
  const otherMapper = p =>
    `const ${toParameterName(p.name)} = cmd.${_.camelCase(p.name)}`
  const bodyMapper = p =>
    `const  ${toParameterName(p.name)} = await readStdIn()`
  source += `.action(async cmd => {
           ${otherParams.map(otherMapper).join('\n')}
           ${bodyParams.map(bodyMapper).join('\n')}
           const op = await getOp()

        return op.${operationId}({${parameters
    .map(paramValue)
    .join(',')}}).then(responseHandler).catch(err => { console.error(err) })
      })
      `
  return source
}
const generate = (swagger, targetDir, prefix = 'oce-management') => {
  let version = swagger.info.version
  if (version.split('.').length < 3) version = version + '.0'
  const tags = swagger.tags.reduce((aggr, o) => ({ ...aggr, [o.name]: {} }), {})

  const paths = Object.entries(swagger.paths)
  paths.forEach(([path, methods]) => {
    Object.entries(methods)
      .filter(([method, op]) => op.tags)
      .forEach(([method, op]) => {
        const operationId = op.operationId || _.camelCase(op.summary)

        op.tags.forEach(tag => {
          if (!tags[tag]) {
            throw new Error(tag)
          }
          tags[tag][operationId] = { method, path, ...op }
        })
      })
  })
  copydir.sync(path.join(__dirname, 'target'), path.join(targetDir, 'src'))

  const paramRefs = refName => {
    const name = refName.split('/').slice(-1)[0]
    const param = swagger.parameters[name]
    return param
  }
  Object.entries(tags).map(([tag, ops]) => {
    const source = `#!/usr/bin/env node
    if (require.main === module) {
    ;(async () => {
    const program = require('commander');
    const {readConfig, readStdIn, responseHandler} = require('./cli-util')
    const getOp = async () => {
      const {host,auth} = await readConfig()
      if(process.stdout.isTTY) console.log('Using OCE at '+ host)
  
      const { client } = require('./client');
      return client(host, auth).${_.camelCase(tag)}
    }
   
    program.version('${version}')
    ${Object.entries(ops)
      .map(generateCommandSource(paramRefs))
      .join('\n')}
  
      program.on('command:*', function () {
        console.error('Invalid command: %s\\n', program.args.join(' '))
        program.help()
        process.exit(1)
      })
      await program.parseAsync(process.argv)
        // if not command is found, print help
        if (process.argv.length === 2) {
          // e.g. display usage
          program.help();
        }

      })().catch(console.error) 
    }
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
        [`${prefix}-${_.kebabCase(key)}`]: `./src/cli-${_.camelCase(key)}.js`
      }),
      { [prefix]: './src/oauth/login-oauth-cli.js' }
    )
  }
  return addBins(targetDir, packageCommands)
}

module.exports = { generate }
