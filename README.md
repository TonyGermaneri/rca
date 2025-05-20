# RCA Wasmer Package

Rust Cellular Automata

For random values to work run: RUSTFLAGS='--cfg getrandom_backend="wasm_js"'


Based on https://docs.wasmer.io/wasmer-pack

## Building:
`cargo build --target wasm32-unknown-unknown`

### Check output
`file target/wasm32-unknown-unknown/debug/*.wasm`

### Inspect wasm file
`wasmer inspect target/wasm32-unknown-unknown/debug/<file name>`

## Local Development

### Build for development

First build Wasmer package

`wasm-pack build --target web -s ca`

Then cd to the pkg directory where package.json was created and run:

`npm link`

next move to your test application then:

`npm link --name of your package in /pkg/package.json--`

Run your test application


