const { readJSON } = require('./util')

readJSON(process.argv[2])
  .then(json => {
    Object.entries(json.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, op]) => {
        const pathParam = op.parameters
          .filter(p => p.in === 'path')
          .map(p => p.name)
        pathParam
          .filter(name => path.indexOf(`{${name}}`) === -1)
          .forEach(name => {
            console.log(
              `Path parameter "${name}"  is not defined in ${path} for operationId "${
                op.operationId
              }"`
            )
          })
      })
    })
  })
  .catch(console.error)
