import { defineConfig } from 'eslint/config';
import vuetifyConfig from 'eslint-config-vuetify';

export default defineConfig([
  ...vuetifyConfig,
  {
    languageOptions: {
      globals: {
        emit: 'writable',
        listen: 'readonly',
        removeListener: 'readonly',
      },
    },
  },
]);
