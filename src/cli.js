#!/usr/bin/env node
const fs = require('fs')
const fetch = require('node-fetch')
const { readJSON } = require('./util')

const clientGenerator = require('./generate-api-client')
const cliGenerator = require('./generate-api-cli')

const isBlank = v => v === undefined || v === null || v === ''

if (require.main === module) {
  var version = require('./package.json').version
  const program = require('commander')
  program.version(version)
  program
    .command('generate-all [swagger-file]')
    .description('Generate the client module and the command line tools')
    .action(async swaggerFile => {
      const targetDir = './generated'

      let swagger = null

      if (isBlank(swaggerFile)) {
        const response = await fetch(
          'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-manage-content/swagger.json'
        )
        if (!response.ok) {
          throw new Error("Swagger file can't be downloaded.")
        }
        const body = await response.json()
        swagger = body
      } else {
        swagger = await readJSON(swaggerFile)
      }

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


> cd generated && npm pack && npm install -g *.tgz

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
    .action(function (swaggerFile, cmd) {
      if (isBlank(swaggerFile)) {
        throw new Error('A swagger file must be provided')
      }
      const targetDir = './generated'
      fs.stat(targetDir, (err, stat) => {
        if (err) {
          fs.mkdirSync(targetDir)
        }
        clientGenerator
          .generate(swaggerFile, targetDir)
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
