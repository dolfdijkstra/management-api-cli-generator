#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const fetch = require('node-fetch')
const { readJSON } = require('./util')

const clientGenerator = require('./generate-api-client')
const cliGenerator = require('./generate-api-cli')
const listOperationIds = require('./documentation')

const readSwagger = async location => {
  const swaggerFile =
    location ||
    'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-manage-content/swagger.json'

  if (swaggerFile.startsWith('https://')) {
    const response = await fetch(swaggerFile)
    if (!response.ok) {
      throw new Error("Swagger file can't be downloaded.")
    }
    return response.json()
  } else {
    return readJSON(swaggerFile)
  }
}

if (require.main === module) {
  var version = require('../package.json').version
  const program = require('commander')
  program.version(version)
  program
    .command('generate-all [swagger-file]')
    .description('Generate the client module and the command line tools')
    .option(
      '--target <target>',
      'Target directory for the generated files, defaulting to ./generated',
      './generated'
    )
    .option(
      '--name <name>',
      'Name for the node package.',
      'oce-management-api-client'
    )
    .option('--cmdPrefix <prefix>', 'Prefix .', 'oce-management')
    .action(async (swaggerFile, cmd) => {
      const { target, name, cmdPrefix } = cmd
      try {
        let swagger = await readSwagger(swaggerFile)
        const dest = path.resolve('packages')

        fs.mkdirSync(target, { recursive: true })
        fs.mkdirSync(dest, { recursive: true })

        await clientGenerator.generate(swagger, target, name)
        await cliGenerator.generate(swagger, target, cmdPrefix)

        exec(
          `prettier-standard src/*.js; standard --fix src/*.js; npm pack && cp *.tgz "${dest}"`,
          { cwd: path.resolve(target) },
          (err, stdout, stderr) => {
            if (err) {
              console.error(err)

              return
            }
            if (stderr) {
              console.error(stderr)
            }
            console.log(stdout)
            console.info('done')
          }
        )
      } catch (err) {
        console.error(err)
      }
    })

  program
    .command('list-operationIds <swagger-file>')
    .description('List the operationIds of the swagger file')
    .action(async (swaggerFile, cmd) => {
      let swagger = await readSwagger(swaggerFile)

      const ops = await listOperationIds(swagger)
      console.log(ops.map(({operationId, method,path,summary,parameters}) => `${method} - ${operationId} - ${path} - "${summary}" - "[${parameters.join(',')}]"`).sort().join('\n'))
      //console.log(ops.map(({operationId, method,path,summary,parameters}) => `${operationId}`).sort().join('\n'))

    })
    program
    .command('generate-client <swagger-file>')
    .description('Generate the client module')
    .option(
      '--target <target>',
      'Target directory for the generated files, defaulting to ./generated',
      './generated/cli'
    )
    .option(
      '--name <name>',
      'Name for the node package.',
      'oce-management-api-client'
    )
    .action(async (swaggerFile, cmd) => {
      const { target, name } = cmd
      let swagger = await readSwagger(swaggerFile)

      fs.mkdirSync(target, { recursive: true })
      await clientGenerator.generate(swagger, target, name)

      console.info('done')
    })

  // error on unknown commands
  program.on('command:*', function () {
    console.error('Invalid command: %s\n', program.args.join(' '))
    program.help()
    process.exit(1)
  })
  program.parse(process.argv)

  // if not command is found, print help
  if (program.args.length === 0) {
    // e.g. display usage
    program.help()
  }
}
