# management-api-cli-generator
Command line generator for management api from a swagger file

# How to build the command-line tool.

```
npx cec-man-api-client-generator generate-all "<location of swagger file>"
prettier-standard generated/src/*
standard --fix generated/src/*
cd generated/
npm pack
npm install cec-management-api-client-1.0.0.tgz -g
```
