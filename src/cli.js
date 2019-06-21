#!/usr/bin/env node
const fs = require('fs')
const fetch = require('node-fetch')
const { readJSON } = require('./util')

const clientGenerator = require('./generate-api-client')
const cliGenerator = require('./generate-api-cli')

const isBlank = v => v === undefined || v === null || v === ''

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
    .action(async (swaggerFile, cmd) => {
      const targetDir = cmd.target

      let swagger = await readSwagger(swaggerFile)

      fs.stat(targetDir, (err, stat) => {
        if (err) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        clientGenerator.generate(swagger, targetDir).then(() => {
          return cliGenerator
            .generate(swagger, targetDir)
            .then(() => {
              console.info('done')
              console.info(`To use the tools you have to install them:


> cd ${targetDir} && npm pack && npm install -g *.tgz

              `)
            })
            .catch(err => {
              console.error(err)
            })
        })
      })
    })
  program
    .command('generate-client <swagger-file>')
    .description('Generate the client module')
    .option(
      '--target <target>',
      'Target directory for the generated files, defaulting to ./generated',
      './generated'
    )
    .action(async (swaggerFile, cmd) => {
      const targetDir = cmd.target
      let swagger = await readSwagger(swaggerFile)

      fs.stat(targetDir, (err, stat) => {
        if (err) {
          fs.mkdirSync(targetDir)
        }
        clientGenerator
          .generate(swagger, targetDir)
          .then(() => {
            console.info('done')
          })
          .catch(err => {
            console.error(err)
          })
      })
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
