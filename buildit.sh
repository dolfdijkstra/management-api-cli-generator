rm -Rf generated/
node src/cli.js generate-all "$1"
prettier-standard generated/src/*
standard --fix generated/src/*
cd generated/
npm pack
