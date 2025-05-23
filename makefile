run:
	cd web-client && npm i && printf "\\e[3J" && npm run dev

package:
	#rm -rf ./web-client/node_modules/@ca/ca
	export RUSTFLAGS='--cfg getrandom_backend="wasm_js"' && npx --yes wasm-pack build --target web -s ca --out-dir ./web-client/node_modules/@ca/ca

watch:
	fswatch -o ./src | xargs -n1 -I{} sh -c 'clear && printf "\\e[3J" && make develop'