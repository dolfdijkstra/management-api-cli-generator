const querystring = require('querystring')
const path = require('path')

const fs = require('fs')
const _ = require('lodash')

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

const toQS = queryParams => {
  for (const propName in queryParams) {
    if (queryParams[propName] === null || queryParams[propName] === undefined) {
      delete queryParams[propName]
    }
  }
  return Object.keys(queryParams).length > 0
    ? '?' + querystring.stringify(queryParams)
    : ''
}
class SourceBlock {
  constructor () {
    this.lines = []
  }

  sourceLine (line) {
    this.lines.push(line)
  }

  toString () {
    return this.lines.join('\n')
  }
}
const copyPackage = (targetPath, name, info) => {
  const packageJSON = {
    name: name,
    version: '3.' + info.version,
    description: info.title,
    main: 'src/client.js',
    author: 'Dolf Dijkstra',
    license: 'MIT',
    dependencies: {
      commander: '^4.1.0',
      lodash: '^4.17.11',
      'node-fetch': '^2.3.0',
      debug: '^4.1.1',
      moment: '^2.24.0',
      inquirer: '^7.0.3'
    }
  }
  fs.writeFileSync(
    path.join(targetPath, 'package.json'),
    JSON.stringify(packageJSON, null, 2),
    'utf-8'
  )
  if (!fs.existsSync(path.join(targetPath, 'src'))) {
    fs.mkdirSync(path.join(targetPath, 'src'))
  }
}
const moduleBlock = (tags, tagMapper) => {
  const children = Object.entries(tags).map(tagMapper)
  const moduleReturn = Object.keys(tags)
    .map(
      tag => `${_.camelCase(tag)}: ${_.camelCase(tag)}_(host, authorization)`
    )
    .join(', ')

  const exports_ = Object.keys(tags)
    .map(tag => `module.exports.${_.camelCase(tag)}= ${_.camelCase(tag)}_`)
    .join('\n')
  const block = `
const querystring = require('querystring')
const fetch = require('node-fetch')
const https = require('https')
const debug = require('debug')('oce-fetch')
const toQS = ${toQS.toString()}
const agent = new https.Agent({keepAlive: true})

${children.map(block => block.source).join('\n')}
${exports_}
const client = (host, authorization) =>{return {${moduleReturn} }}
module.exports.readConfig = require('./cli-util').readConfig
module.exports.client = client 

`

  return block
}

const tagMapper = (basePath, paramRefs) => ([tag, ops]) => {
  const subBlock = new SourceBlock()

  subBlock.sourceLine(`/** ${tag} */`)
  subBlock.sourceLine(`const ${_.camelCase(tag)}_ = (host, authorization) => {`)
  Object.entries(ops).forEach(([operationId, m]) => {
    const parameters = (m.parameters || []).map(p =>
      p.$ref ? paramRefs(p.$ref) : p
    )
    const pathParams = parameters.filter(p => p.in === 'path')
    const queryParams = parameters.filter(p => p.in === 'query')
    const headerParams = parameters.filter(p => p.in === 'header')
    const bodyParams = parameters.filter(p => p.in === 'body')
    let functionBody = '\n'

    const qArray = queryParams
      .map(p => '"' + p.name + '":' + toParameterName(p.name))
      .join(',')
    functionBody +=
      queryParams.length === 0 ? '' : `const queryParams = {${qArray}}\n`

    let hasData = false
    if (bodyParams.length === 1) {
      hasData = true
      const bodyVar = bodyParams.map(p => p.name).map(toParameterName)[0]
      functionBody += `// consumes ${
        m.consumes ? m.consumes.join(',') : ' UNKOWN'
      }\nconst data = typeof ${bodyVar} === 'string' ? ${bodyVar} : JSON.stringify(${bodyVar})\n`
    }
    functionBody +=
      queryParams.length === 0
        ? "const qs = ''\n"
        : 'const qs = toQS(queryParams)\n'

    const replacedPath = pathParams
      .map(p => p.name)
      .map(part => '.replace("{' + part + '}",' + toParameterName(part) + ')')
      .join('')
    functionBody += `const path = "${basePath}${m.path}"${replacedPath} + qs\n`
    const hp = headerParams
      .map(header => ", '" + header.name + "': " + toParameterName(header.name))
      .join('')
    functionBody += `const headers = {"Authorization":authorization, "Content-Type":"application/json"${hp}}\n`
    functionBody += `const options = {method: "${m.method.toUpperCase()}", headers, agent ${
      hasData ? ',body: data' : ''
    }}\n`
    if (bodyParams.length > 1) {
      functionBody += `//TODO handle ${bodyParams
        .map(p => p.name)
        .map(toParameterName)}\n`
    }
    functionBody += "debug('%s%s %j', host, path, {method: options.method, headers})\n"
    functionBody += 'return fetch(host + path,options)\n'
    subBlock.sourceLine(`/**  @function ${operationId} - ${m.summary}.`)
    parameters.forEach(param => {
      subBlock.sourceLine(
        `* @param {${param.type}} ${toParameterName(param.name)} - ${
          param.description
        }.`
      )
    })
    subBlock.sourceLine('*/')
    const signature =
      parameters.length === 0
        ? ''
        : `{${parameters
            .map(p => p.name)
            .map(toParameterName)
            .join(',')}}`
    subBlock.sourceLine(
      `   const ${operationId} = (${signature}) => { ${functionBody} }`
    )
  })
  subBlock.sourceLine(`return { ${Object.keys(ops).join(',')}}`)
  subBlock.sourceLine('}')
  return { tag, source: subBlock.toString() }
}

const generate = async (swagger, targetPath, name) => {
  // create package.json in targetPath
  copyPackage(targetPath, name, swagger.info)

  // group all operationsIds under a tag
  const tags = swagger.tags.reduce((aggr, o) => ({ ...aggr, [o.name]: {} }), {})
  const basePath = swagger.basePath || ''
  Object.entries(swagger.paths).forEach(([path, methods]) => {
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

  const paramRefs = refName => {
    const name = refName.split('/').slice(-1)[0]
    const param = swagger.parameters[name]
    return param
  }
  const moduleCode = [moduleBlock(tags, tagMapper(basePath, paramRefs))].join(
    '\n'
  )
  fs.writeFileSync(
    path.join(targetPath, 'src', 'client.js'),
    moduleCode,
    'utf-8'
  )
}
module.exports = { generate }
