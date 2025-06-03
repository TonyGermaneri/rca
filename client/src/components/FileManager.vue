<template>
  <div>
    <v-card>
      <v-tabs v-model="tab">
        <v-tab value="save">Save</v-tab>
        <v-tab value="load">Load</v-tab>
        <v-tab value="upload">Upload</v-tab>
      </v-tabs>
      <v-card-text>
        <v-tabs-window v-model="tab">
          <v-tabs-window-item eager value="load">
            <v-select
              v-model="selectedCa"
              item-title="name"
              item-value="id"
              :items="localCa"
              label="Load Local CAs"
              @keydown.stop
              @mousedown.stop
            />
            <v-btn :disabled="!selectedCa" @click="load">Load</v-btn>
            <v-btn class="ml-2" :disabled="!selectedCa" @click="deleteRecordById(selectedCa)">Delete</v-btn>
          </v-tabs-window-item>
          <v-tabs-window-item eager value="save">
            <v-text-field v-model="saveName" autocomplete="off" label="CA Name" @keydown.stop />
            <v-checkbox v-model="includeBuffer" label="Include CA Buffer" />
            <v-checkbox v-model="incudeLoadedBackgroundImage" label="Include Loaded Background Image" />
            <v-btn :disabled="!saveName" @click="save">Save</v-btn>
            <v-btn class="ml-2" :disabled="!saveName" @click="download">Download</v-btn>
          </v-tabs-window-item>
          <v-tabs-window-item eager value="upload">
            <v-file-input @change="upload" />
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
    </v-card>
  </div>
</template>
<script>
  import { LifeChannel } from '@ca/ca';
  import { hslaToRgbaFlatArray } from '../utils.js';

  export default {
    data () {
      return {
        tab: null,
        selectedCa: null,
        currentCa: null,
        ca: null,
        includeBuffer: false,
        incudeLoadedBackgroundImage: false,
        localCa: [],
        saveName: '',
        saveId: null,
        dbName: 'rca',
        state: {
          rule: 770,
          tickInterval: 0,
          decayStep: 1,
          recoveryStep: 60,
          satRecoveryFactor: 0.8,
          satDecayFactor: 0.6,
          lumDecayFactor: 0.95,
          lifeDecayFactor: 0.95,
          satGhostFactor: 0.9,
          hueDriftStrength: 0.01,
          hueLerpFactor: 0.1,
          lifeChannel: 'Alpha',
          pixelScale: 0.25,
          brushRadius: 20,
          brushColor: '#FFFFFFFF',
          colorModel: 'HSLA',
          listeners: {},
          background: null,
          buffer: [],
          bufferWidth: 0,
          bufferHeight: 0,
          randomizeShape: true,
          stampOnRandom: true,
        },
      }
    },
    mounted () {
      listen('image:stamp-on-random', this.setStampOnRandom);
      listen('image:randomize-shape-on-random', this.setRandomizeShape);
      listen('ca:parameters-set', this.parametersSet);
      listen('brush:radius-set', this.setBrushRadius);
      listen('brush:color-set', this.setBrushColor);
      listen('image:background-set', this.updateBackground);
      listen('midi:update-listeners', this.updateMidiListeners);
      listen('ca:init', e => this.ca = e.detail);
      this.initDB();
    },
    methods: {
      setRandomizeShape (e) {
        this.randomizeShape = e.detail;
      },
      setStampOnRandom (e) {
        this.stampOnRandom = e.detail;
      },
      setBrushRadius (e) {
        this.state.brushRadius = e.detail;
      },
      setBrushColor (e) {
        this.state.brushColor = e.detail;
      },
      newId () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8); // eslint-disable-line
          return v.toString(16);
        });
      },
      parametersSet (e) {
        const parameters = e.detail;
        Object.keys(parameters).forEach(key => {
          if (key === 'lifeChannel') {
            switch(parameters.lifeChannel) {
              case 0: this.state.lifeChannel = 'Hue'; break;
              case 1: this.state.lifeChannel = 'Saturation'; break;
              case 2: this.state.lifeChannel = 'Luminance'; break;
              case 3: this.state.lifeChannel = 'Alpha'; break;
            }
          } else {
            this.state[key] = parameters[key];
          }
        });
      },
      updateMidiListeners (e) {
        this.state.listeners = JSON.parse(JSON.stringify(e.detail.listeners));
      },
      getDataUrlFromImg (img) {
        const c = document.createElement('canvas');
        c.height = img.naturalHeight;
        c.width = img.naturalWidth;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL();
      },
      updateBackground (e) {
        this.state.background = {
          isShape: e.detail.isShape,
          image: this.getDataUrlFromImg(e.detail.image),
        };
      },
      initDB () {
        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = event => {
          const db = event.target.result;
          const store = db.createObjectStore('cas', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        };

        request.onsuccess = () => {
          this.refreshLocalCaList();
        };

        request.onerror = event => {
          console.error('IndexedDB error:', event.target.error);
        };
      },
      refreshLocalCaList () {
        const request = indexedDB.open(this.dbName, 1);

        request.onsuccess = event => {
          const db = event.target.result;
          const tx = db.transaction('cas', 'readonly');
          const store = tx.objectStore('cas');
          const items = [];

          store.openCursor().onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
              items.push({ id: cursor.value.id, name: cursor.value.name });
              cursor.continue();
            } else {
              this.localCa = items;
            }
          };
        };
      },
      save () {
        if (!this.saveName) {
          return;
        }

        const existingCa = this.localCa.find(ca => {
          return ca.name === this.saveName;
        });

        const id = existingCa ? existingCa.id : this.newId()

        const data = {
          id,
          name: this.saveName,
          state: JSON.parse(JSON.stringify(this.state)),
        };

        if (!this.includeBuffer) {
          data.state.buffer = [];
        } else {
          data.state.buffer = this.ca.buffer;
          data.state.bufferWidth = this.ca.universe.width();
          data.state.bufferHeight = this.ca.universe.height();
        }

        if (!this.incudeLoadedBackgroundImage) {
          data.state.background = [];
        }

        const request = indexedDB.open(this.dbName, 1);
        request.onsuccess = event => {
          const db = event.target.result;
          const tx = db.transaction('cas', 'readwrite');
          const store = tx.objectStore('cas');
          store.add(data);
          tx.oncomplete = () => this.refreshLocalCaList();
        };
      },

      loadState () {
        emit('midi:set-listeners', this.state.listeners);
        if (this.state.background) {
          emit('image:load-background', this.state.background.image);
          emit('image:set-is-shape', this.state.background.isShape);
        }
        if (this.state.buffer && this.state.buffer.length > 0) {
          emit('ca:load-buffer', {
            width: this.state.bufferWidth,
            height: this.state.bufferHeight,
            buffer: hslaToRgbaFlatArray(this.state.buffer),
          });
        }

        emit('image:set-randomize-shape-on-random', this.randomizeShape);
        emit('image:set-stamp-on-random', this.stampOnRandom);

        emit('control-panel:set-parameters', {
          rule: this.state.rule,
          decayStep: this.state.decayStep,
          recoveryStep: this.state.recoveryStep,
          satRecoveryFactor: this.state.satRecoveryFactor,
          satDecayFactor: this.state.satDecayFactor,
          lumDecayFactor: this.state.lumDecayFactor,
          lifeDecayFactor: this.state.lifeDecayFactor,
          satGhostFactor: this.state.satGhostFactor,
          hueDriftStrength: this.state.hueDriftStrength,
          hueLerpFactor: this.state.hueLerpFactor,
          lifeChannel: this.state.lifeChannel,
          pixelScale: this.state.pixelScale,
          tickInterval: this.state.tickInterval,
          useAlpha: this.state.isAlpha,
          useRGB: this.state.isRGB,
        });
      },
      deleteRecordById (id) {
        if (!id) { return; }
        const request = indexedDB.open(this.dbName, 1);

        request.onsuccess = event => {
          const db = event.target.result;
          const tx = db.transaction('cas', 'readwrite');
          const store = tx.objectStore('cas');

          const deleteRequest = store.delete(id);

          deleteRequest.onsuccess = () => {
            this.selectedCa = '';
            this.refreshLocalCaList();
          };

          deleteRequest.onerror = event => {
            console.error('Error deleting record:', event.target.error);
          };
        };

        request.onerror = event => {
          console.error('Database open error:', event.target.error);
        };
      },
      load () {
        if (!this.selectedCa) return;

        const request = indexedDB.open(this.dbName, 1);
        request.onsuccess = event => {
          const db = event.target.result;
          const tx = db.transaction('cas', 'readonly');
          const store = tx.objectStore('cas');
          store.get(this.selectedCa).onsuccess = e => {
            const record = e.target.result;
            if (record) {
              this.state = record.state;
              this.saveName = record.name;
              this.saveId = record.id;
              this.setTitle();
              this.loadState();
            }
          };
        };
      },
      download () {
        const data = JSON.stringify(this.state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.saveName || 'ca'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      setTitle (){
        document.title = this.saveName + ' - RCA'
      },
      upload (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
          try {
            const data = JSON.parse(event.target.result);
            this.saveName = file.name.replace(/\.json$/ig, '');
            this.state = data;
            this.setTitle();
            this.loadState();
          } catch (err) {
            console.error('Failed to parse uploaded file', err);
          }
        };
        reader.readAsText(file);
      },
    },
  };
</script>
