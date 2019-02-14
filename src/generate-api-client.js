const readJSON = require('./util').readJSON
const querystring = require('querystring')
const path = require('path')

const fs = require('fs')
const _ = require('lodash')
const toParameterName = name =>
  name === 'default' ? '_default' : _.camelCase(name)
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
const copyPackage = targetPath => {
  const packageJSON = require('../package-cli.json')
  fs.writeFileSync(
    path.join(targetPath, 'package.json'),
    JSON.stringify(packageJSON, null, 2),
    'utf-8'
  )
  if (!fs.existsSync(path.join(targetPath, 'src'))) {
    fs.mkdirSync(path.join(targetPath, 'src'))
  }
}
const generate = (swaggerFilePath, targetPath) => {
  // copy package-cli to targetPath
  copyPackage(targetPath)
  return readJSON(swaggerFilePath).then(json => {
    //group all operationsIds under a tag
    const tags = json.tags.reduce((aggr, o) => ({ ...aggr, [o.name]: {} }), {})
    const basePath = json.basePath
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
    const moduleBlock = new SourceBlock()
    moduleBlock.sourceLine("const querystring = require('querystring')")
    moduleBlock.sourceLine("const fetch = require('node-fetch')")
    moduleBlock.sourceLine("const https = require('https')")
    moduleBlock.sourceLine(`const toQS = ${toQS.toString()}
const agent = new https.Agent({
  keepAlive: true
})`)
    const blocks = Object.entries(tags).map(([tag, ops]) => {
      const subBlock = new SourceBlock()

      subBlock.sourceLine(`/** ${tag} */`)
      subBlock.sourceLine(
        `module.exports.${_.camelCase(tag)} = (host, authorization) => {`
      )
      Object.entries(ops).forEach(([operationId, m]) => {
        // console.log(m)
        const pathParams = m.parameters.filter(p => p.in === 'path')
        const queryParams = m.parameters.filter(p => p.in === 'query')
        const headerParams = m.parameters.filter(p => p.in === 'header')
        const bodyParams = m.parameters.filter(p => p.in === 'body')
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
            ? `const qs = ''\n`
            : `const qs = toQS(queryParams)\n`

        const replacedPath = pathParams
          .map(p => p.name)
          .map(
            part => '.replace("{' + part + '}",' + toParameterName(part) + ')'
          )
          .join('')
        functionBody += `const path = "${basePath}${
          m.path
        }"${replacedPath} + qs\n`
        const hp = headerParams
          .map(
            header => ", '" + header.name + "': " + toParameterName(header.name)
          )
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
        functionBody += `if(process.env.CEC_FETCH) console.log(host+path, JSON.stringify(options))\n`
        functionBody += `return fetch(host + path,options)\n`
        subBlock.sourceLine(`/**  @function ${operationId} - ${m.summary}.`)
        m.parameters.forEach(param => {
          subBlock.sourceLine(
            `* @param {${param.type}} ${toParameterName(param.name)} - ${
              param.description
            }.`
          )
        })
        subBlock.sourceLine(`*/`)
        subBlock.sourceLine(
          `   const ${operationId} = (${m.parameters
            .map(p => p.name)
            .map(toParameterName)
            .join(',')}) => { ${functionBody}}`
        )
      })
      subBlock.sourceLine(`return { ${Object.keys(ops).join(',')}}`)
      subBlock.sourceLine(`}`)
      return { tag, source: subBlock.toString() }
    })
    const moduleCode = [
      moduleBlock.toString(),
      blocks.map(block => block.source).join('\n')
    ].join('\n')
    fs.writeFileSync(
      path.join(targetPath, 'src', 'client.js'),
      moduleCode,
      'utf-8'
    )
  })
}
module.exports = { generate }
