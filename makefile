run:
	cd web-client && npm i && printf "\\e[3J" && npm run dev

package:
	export RUSTFLAGS='--cfg getrandom_backend="wasm_js"' && npx --yes wasm-pack build --target web -s ca

watch:
	fswatch -o ./src | xargs -n1 -I{} sh -c 'clear && printf "\\e[3J" && make package'