package:
	wasm-pack build --target web -s ca

watch:
	fswatch -o ./src | xargs -n1 -I{} sh -c 'clear && printf "\\e[3J" && wasm-pack build --target web -s ca'