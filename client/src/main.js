// Plugins
import { registerPlugins } from '@/plugins';

// Components
import App from './App.vue';

// Composables
import { createApp } from 'vue';

// Styles
import 'unfonts.css';

BigInt.prototype.toJSON = function () {
  return Number(this);
};
BigInt.prototype.fromJSON = function (val) {
  return BigInt(Number(val));
};
window.emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, {detail}));
window.listen = addEventListener;
window.removeListener = removeEventListener;

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

