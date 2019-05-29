rm -Rf generated/
node src/cli.js generate-all "$1"
cd generated/
prettier-standard src/*
standard --fix src/*
npm pack
