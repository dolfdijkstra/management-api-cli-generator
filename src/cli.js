#!/usr/bin/env node
const fs = require('fs')

const clientGenerator = require('./generate-api-client')
const cliGenerator = require('./generate-api-cli')

const isBlank = v => v === undefined || v === null || v === ''

if (require.main === module) {
  const program = require('commander')
  program.version('0.0.1')
  program
    .command('generate-all <swagger-file>')
    .description('Generate the client module and the command line tools')
    .action(function (swaggerFile, cmd) {
      if (isBlank(swaggerFile)) {
        throw new Error('A swagger file must be provided')
      }
      const targetDir = './generated'
      fs.stat(targetDir, (err, stat) => {
        if (err) {
          fs.mkdirSync(targetDir)
        }
        clientGenerator.generate(swaggerFile, targetDir).then(() => {
          return cliGenerator
            .generate(swaggerFile, targetDir)
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
        clientGenerator.generate(swaggerFile, targetDir).then(() => {
          console.info('done')
        })
      }).catch(err => {
        console.error(err)
      })
    })

  program
    .command('generate-cli <swagger-file>')
    .description('Generate the cec managent-api command line utilities.')
    .action(function (swaggerFile, cmd) {
      if (isBlank(swaggerFile)) {
        throw new Error('A swagger file must be provided')
      }
      const targetDir = './generated'
      fs.stat(targetDir, (err, stat) => {
        if (err) {
          fs.mkdirSync(targetDir)
        }
        cliGenerator
          .generate(swaggerFile, targetDir)
          .then(bins => {
            // TODO, update package.json
            console.log(JSON.stringify(bins, null, 2))
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
