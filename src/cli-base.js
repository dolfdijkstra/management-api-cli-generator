#!/usr/bin/env node

const program = require('commander')
const { login } = require('./login')

program
  .command('login')
  .description('login for OCE')
  .action(async cmd => {
    login().catch(err => {
      console.error(err)
      process.exit(-1)
    })
  })

program.parse(process.argv)
// if not command is found, print help
if (program.args.length === 0) {
  // e.g. display usage
  program.help()
}
