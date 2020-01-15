const _ = require('lodash')

const generate = (swagger) => {
  const basePath = swagger.basePath || ''
  const paths = Object.entries(swagger.paths)
  const paramRefs = refName => {
    const name = refName.split('/').slice(-1)[0]
    const param = swagger.parameters[name]
    return param
  }
  return _.flatten(paths.map(([path, methods]) => {
    return Object.entries(methods)
      .filter(([_method, op]) => op.tags)
      .map(([method, op]) => {
        const parameters = (op.parameters || []).map(p =>
          p['$ref'] ? paramRefs(p['$ref']) : p
        )
        return {operationId: op.operationId, summary: op.summary, method,path : basePath+path, parameters: parameters.map(p => p.name)}       
      })
  }))
}

module.exports =  generate 
