# RCA Wasmer Package

WASM/GL 32bit HLSA Multichannel Rust Cellular Automata

# Demo

FLASHING LIGHTS WARNING!

https://tonygermaneri.github.io/rca/

# Running

`make run`

# Packaging

`make package`

# Development

In one terminal, build the Rust WASM package:
  `make package`
  `cd pkg`
  `npm link`
  `cd ..`
  `make watch`

Make watch will watch the rust src directory for changes and rebuild.
If you just want to build the package again without watching run `make package`

In another, install the web dev server and link the ca package from the previous step:
  `cd web-client`
  `npm i`
  `npm link @ca/ca`
  `npm run dev`

NPM link creates a simlink from the ./pkg directory to ./web-client/node_modules/@ca/ca.

Now any changes to the Rust or JS source will auto build and hot-reload for JS changes or reload for Rust changes.
