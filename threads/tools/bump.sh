#!/bin/sh
# Sets the version in package.json and the README's first paragraph: sh tools/bump.sh 0.4.157
[ -n "$1" ] || { echo "usage: sh tools/bump.sh <version>"; exit 1; }
cd "$(dirname "$0")/.." || exit 1
sed -i.bak "s/\"version\": *\"[^\"]*\"/\"version\": \"$1\"/" package.json && rm package.json.bak
sed -i.bak "1,5s/Version [0-9][0-9.]*\./Version $1./" README.md && rm README.md.bak
echo "version $1"
