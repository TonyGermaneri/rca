<template>
  <v-slider
    v-model="internalValue"
    v-bind="$attrs"
    density="compact"
    style="height: 30px"
    @mousedown.stop
  >
    <template #append>
      <v-number-input
        v-model="internalValue"
        :max="$attrs.max"
        density="compact"
        :min="$attrs.min"
        :precision="$attrs.precision"
        :step="$attrs.step"
        single-line
        style="width: 110px; scale: 0.8;"
        control-variant="stacked"
        @keydown.stop
      />
    </template>
  </v-slider>
</template>

<script>
  export default {
    name: 'Slider',
    inheritAttrs: false,
    props: {
      modelValue: {
        type: Number,
        default: 0,
      },
    },
    emits: ['update:modelValue'],
    computed: {
      internalValue: {
        get () {
          return this.modelValue;
        },
        set (value) {
          this.$emit('update:modelValue', value);
        },
      },
    },
  };
</script>
