<template>
  <v-card class="image-tab">
    <div class="mt-2">
      <v-btn @click="setShape('circle');">Circle</v-btn>
      <v-btn @click="setShape('square');">Square</v-btn>
      <v-btn @click="setShape('triangle');">Triangle</v-btn>
      <v-btn @click="setShape('hexagon');">Hexagon</v-btn>
    </div>
    <v-file-input
      v-if="!internalImage"
      ref="file"
      accept="image/*"
      class="mt-4"
      hide-details
      label="Upload image"
      @change="onFileChange"
    />

    <v-select v-model="backgroundMode" class="mt-4" :items="modes" label="Mode" />
    <div>
      <v-btn class="mt-4" @click="setBackground">Set As Background</v-btn>
      <v-btn class="mt-4" @click="clear">Clear</v-btn>
      <v-checkbox v-model="stampOnRandom" label="Stamp On Random" />
      <v-checkbox v-model="randomizeShape" label="Random Shape On Random" />
    </div>
    <v-img
      v-if="internalImage"
      aspect-ratio="1.77"
      class="my-2 w-50 d-inline-block border px-4"
      cover
      :src="internalImage"
      style="vertical-align: top;"
    />
    <v-color-picker
      v-if="isShape"
      v-model="shapeColor"
      class="px-4 w-50 my-2 d-inline-block"
      style="vertical-align: top;"
      @mousedown.stop
    />
    <Slider
      v-if="isShape"
      v-model="shapeScale"
      class="mx-auto w-50 d-inline-block pa-4"
      label="Size"
      :max="2"
      :min="0.01"
      :precision="2"
      :step="0.01"
      :style="{marginTop: '-160px'}"
    />
    <i v-else class="d-block mt-6 mx-2">No Image Selected.  Upload an image or click a shape.</i>
  </v-card>
</template>

<script>
  import Slider from './Slider.vue';
  import { getRandomColor, getRandomFloatInclusive } from '../utils.js';

  export default {
    name: 'Image',
    components: { Slider },
    props: {
      modelValue: {
        type: String,
        default: null,
      },
    },
    data () {
      return {
        ca: null,
        isShape: false,
        stampOnRandom: true,
        randomizeShape: true,
        shapeScale: 0.1,
        pixelScale: 1.0,
        selectedShape: 'circle',
        shapeColor: '#FF0000FF',
        internalImage: this.modelValue,
        backgroundMode: 'center',
        modes: [
          'stretch',
          'center',
          'full',
          'repeat',
        ],
        shapes: null,
      };
    },
    watch: {
      stampOnRandom () {
        emit('image:stamp-on-random', this.stampOnRandom);
      },
      randomizeShape () {
        emit('image:randomize-shape-on-random', this.randomizeShape);
      },
      modelValue (newVal) {
        this.internalImage = newVal;
      },
      shapeColor () {
        emit('image:shape-color', this.shapeColor);
        this.updateShapes();
        this.setShape(this.selectedShape);
      },
      shapeScale () {
        emit('image:shape-scale', this.shapeScale);
        this.updateShapes();
        this.setShape(this.selectedShape);
      },
    },
    mounted () {
      listen('image:set-is-shape', this.setIsShape);
      listen('image:load-background', this.loadImage);
      listen('image:set-shape-color', this.setShapeColor);
      listen('image:set-shape-scale', this.setShapeScale);
      listen('image:set-background', this.setBackground);
      listen('image:set-random-shape', this.setRandomShape);
      listen('image:set-randomize-shape-on-random', this.setRandomizeShape);
      listen('image:set-stamp-on-random', this.setStampOnRandom);
      listen('ca:init', e => this.ca = e.detail);
      listen('ca:set-parameters', e => this.pixelScale = e.detail.pixelScale);
      this.updateShapes();
    },
    methods: {
      setStampOnRandom (e) {
        this.stampOnRandom = e.detail;
      },
      setRandomizeShape (e) {
        this.randomizeShape = e.detail;
      },
      setIsShape (e) {
        this.isShape = e.detail;
      },
      loadImage (e) {
        const img = new Image();
        img.onload = () => {
          this.internalImage = img;
          emit('image:background-set', { image: img, isShape: this.isShape });
        };
        img.src = e.detail;
      },
      setRandomShape () {
        const keys = Object.keys(this.shapes);
        const index = Math.floor(Math.random() * keys.length);
        this.setShape(keys[index]);
        this.shapeColor = getRandomColor();
        this.shapeScale = getRandomFloatInclusive(0.01, 0.05);
      },
      setShapeColor (e) {
        this.shapeColor = e.detail;
      },
      setShapeScale (e) {
        this.shapeScale = e.detail;
      },
      updateShapes () {
        const width = innerWidth;
        const height = innerHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const size = (Math.min(width, height) * this.shapeScale);

        this.shapes = {
          circle: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="${this.shapeColor}"/>
        </svg>`,

          square: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${centerX - size / 2}" y="${centerY - size / 2}" width="${size}" height="${size}" fill="${this.shapeColor}"/>
        </svg>`,

          triangle: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <polygon fill="${this.shapeColor}" points="
            ${centerX},${centerY - size / 2}
            ${centerX + size / 2},${centerY + size / 2}
            ${centerX - size / 2},${centerY + size / 2}
          "/>
        </svg>`,

          hexagon: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <polygon fill="${this.shapeColor}" points="
            ${centerX},${centerY - size * 0.5}
            ${centerX + size * 0.433},${centerY - size * 0.25}
            ${centerX + size * 0.433},${centerY + size * 0.25}
            ${centerX},${centerY + size * 0.5}
            ${centerX - size * 0.433},${centerY + size * 0.25}
            ${centerX - size * 0.433},${centerY - size * 0.25}
          "/>
        </svg>`,
        };
      },
      setShape (shape) {
        const svgShape = this.shapes[shape];
        this.selectedShape = shape;
        const img = new Image();
        img.onload = () => {
          this.internalImage = img;
          this.isShape = true;
          emit('image:background-set', { image: img, isShape: this.isShape });
        };
        img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShape);

      },
      setBackground () {
        if (!this.internalImage) {
          return;
        }
        const universeWidth = this.ca.universe.width();
        const universeHeight = this.ca.universe.height();

        // Create a temporary canvas to draw and extract image data
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        let drawWidth, drawHeight;
        let offsetX = 0, offsetY = 0;

        switch (this.backgroundMode) {
          case 'stretch':
            drawWidth = universeWidth;
            drawHeight = universeHeight;
            tempCanvas.width = drawWidth;
            tempCanvas.height = drawHeight;
            ctx.drawImage(this.internalImage, 0, 0, drawWidth, drawHeight);
            break;

          case 'full': {
            const scale = Math.max(universeWidth / this.internalImage.width, universeHeight / this.internalImage.height);
            drawWidth = this.internalImage.width * scale;
            drawHeight = this.internalImage.height * scale;
            offsetX = (universeWidth - drawWidth) / 2;
            offsetY = (universeHeight - drawHeight) / 2;
            tempCanvas.width = universeWidth;
            tempCanvas.height = universeHeight;
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(this.internalImage, offsetX, offsetY, drawWidth, drawHeight);
            break;
          }

          case 'center':
            drawWidth = this.internalImage.width;
            drawHeight = this.internalImage.height;
            tempCanvas.width = drawWidth;
            tempCanvas.height = drawHeight;
            ctx.drawImage(this.internalImage, 0, 0);
            offsetX = (universeWidth - drawWidth) / 2;
            offsetY = (universeHeight - drawHeight) / 2;
            break;

          default: // repeat
            tempCanvas.width = universeWidth;
            tempCanvas.height = universeHeight;
            const pattern = ctx.createPattern(this.internalImage, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, universeWidth, universeHeight);
            drawWidth = universeWidth;
            drawHeight = universeHeight;
            break;
        }

        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = new Uint8Array(imageData.data);

        const cx = Math.floor((offsetX || 0) + drawWidth / 2);
        const cy = Math.floor((offsetY || 0) + drawHeight / 2);

        emit('ca:draw-stamp', { x: cx, y: cy, width: imageData.width, height: imageData.height, image: data });

      },
      clear () {
        this.internalImage = null;
        this.isShape();
      },
      onFileChange (e) {
        if (!e || !e.target || !e.target.files || !e.target.files[0]) { return; }
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = e => {
          const img = new Image();
          img.onload = () => {
            this.internalImage = img;
            this.isShape = false;
            emit('image:background-set', { image: img, isShape: this.isShape });
            this.$emit('update:modelValue', this.internalImage);
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      },
    },
  };
</script>
<style scoped>
.image-tab {
  overflow: scroll;
}
</style>
