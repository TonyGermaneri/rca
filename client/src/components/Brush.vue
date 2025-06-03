<template>
  <div class="brush" />
</template>
<script>
  import { getRandomColor, hexToHslaU8, newId } from '../utils.js';
  export default {
    data () {
      return {
        ca              : null,
        drawMode        : 'add',
        brushRadius     : 0,
        brushColor      : '#FFFFFFFF',
        drawing         : false,
        drawingSessionId: newId(),
        x               : 0,
        y               : 0,
      }
    },
    computed: {
      brushColorHSL () {
        return hexToHslaU8(this.brushColor);
      },
    },
    mounted () {
      listen('mousedown', this.mousedown);
      listen('mouseup', this.mouseup);
      listen('mouseleave', this.mouseup);
      listen('contextmenu', e => e.preventDefault());
      listen('ca:mouse', this.mousemove);
      listen('ca:init', e => this.ca = e.detail);
      listen('brush:radius', this.setRadius);
      listen('brush:color', this.setColor);
    },
    methods: {
      drawBrush (x, y) {
        this.ca.universe.draw_brush(
          this.x,
          this.y,
          this.brushRadius,
          this.drawMode === 'add',
          this.brushColorHSL.h,
          this.brushColorHSL.s,
          this.brushColorHSL.l,
          this.drawingSessionId
        );
      },
      mouseup (e) {
        this.drawing = false;
      },
      mousedown (e) {
        if (e.target !== this.ca.canvas) { return; }
        e.preventDefault();
        this.drawMode = e.button === 2 ? 'remove' : 'add';
        this.drawing = true;
        this.drawingSessionId = newId();
        this.drawBrush();
      },
      mousemove (e) {
        this.x = e.detail.x;
        this.y = e.detail.y;
        if (!this.drawing) { return ;}
        this.drawBrush();
      },
      setRadius (e) {
        this.brushRadius = e.detail;
        emit('brush:radius-set', this.brushRadius);
      },
      setColor (e) {
        this.brushColor = e.detail;
        emit('brush:color-set', this.brushRadius);
      },
    },
  }
</script>
