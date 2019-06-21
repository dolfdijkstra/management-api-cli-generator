# management-api-cli-generator
Command line generator for management api from a swagger file

# How to build the command-line tool.

```
node src/cli.js generate-all

or

node src/cli.js generate-all "<location of swagger file>"

cd generated/
prettier-standard src/*
standard --fix src/*
npm pack
npm install cec-management-api-client-<version>.tgz -g
```
