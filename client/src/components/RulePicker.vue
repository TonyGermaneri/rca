<template>
  <div class="d-grid ga-2 my-2">
    <div>
      <div class="text-caption font-weight-bold mb-1">Binary</div>
      <div class="d-flex flex-wrap gap-1">
        <div
          v-for="i in 18"
          :key="i"
          class="d-flex flex-column align-center"
          style="font-size: 10px"
        >
          <span>{{ bitLabel(18 - i) }}</span>
          <v-checkbox
            color="primary"
            density="compact"
            hide-details
            :model-value="isBitSet(18 - i)"
            @update:model-value="setBit(18 - i, $event)"
          />
        </div>
      </div>
    </div>

    <v-text-field
      v-model.number="decValue"
      hide-details
      label="Decimal"
      :max="262143"
      :min="0"
      type="number"
      @input="onDecimalInput"
      @keydown.stop
    />

    <v-text-field
      v-model="hexValue"
      hide-details
      label="Hexadecimal"
      @input="onHexInput"
      @keydown.stop
    />

    <v-text-field
      v-model="octValue"
      hide-details
      label="Octal"
      @input="onOctInput"
      @keydown.stop
    />
  </div>
</template>

<script>
  export default {
    name: 'RulePicker',
    props: {
      modelValue: {
        type: Number,
        default: 0,
      },
    },
    data () {
      return {
        rule: this.modelValue,
        decValue: 0,
        hexValue: '',
        octValue: '',
      };
    },
    watch: {
      modelValue (newVal) {
        this.rule = newVal;
        this.updateAllFields();
      },
    },
    mounted () {
      this.updateAllFields();
    },
    methods: {
      isBitSet (bit) {
        return (this.rule & (1 << bit)) !== 0;
      },
      setBit (bit, checked) {
        if (checked) {
          this.rule |= 1 << bit;
        } else {
          this.rule &= ~(1 << bit);
        }
        this.$emit('update:modelValue', this.rule);
        this.updateAllFields();
      },
      bitLabel (i) {
        return i >= 9 ? `S${i - 9}` : `B${i}`;
      },
      onDecimalInput () {
        const val = parseInt(this.decValue);
        if (!isNaN(val) && val >= 0 && val <= 262143) {
          this.rule = val;
          this.$emit('update:modelValue', this.rule);
          this.updateAllFields();
        }
      },
      onHexInput () {
        const val = parseInt(this.hexValue, 16);
        if (!isNaN(val) && val <= 262143) {
          this.rule = val;
          this.$emit('update:modelValue', this.rule);
          this.updateAllFields();
        }
      },
      onOctInput () {
        const val = parseInt(this.octValue, 8);
        if (!isNaN(val) && val <= 262143) {
          this.rule = val;
          this.$emit('update:modelValue', this.rule);
          this.updateAllFields();
        }
      },
      updateAllFields () {
        this.decValue = this.rule;
        this.hexValue = this.rule.toString(16).toUpperCase();
        this.octValue = this.rule.toString(8);
      },
    },
  };
</script>
