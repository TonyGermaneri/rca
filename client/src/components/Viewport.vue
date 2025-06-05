<template>
  <div class="viewport">
    <universe />
    <brush />
    <control-panel />
  </div>
</template>
<script>
  import ControlPanel from './ControlPanel.vue';
  import Universe from './Universe.vue';
  import Brush from './Brush.vue';
  export default {
    components: { ControlPanel, Universe, Brush },
    data () {
      return {}
    },
    computed: {},
    mounted () {},
    methods: {},
  }
</script>
