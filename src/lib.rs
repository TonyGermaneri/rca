use wasm_bindgen::prelude::*;
use rand::Rng;

pub const E: f32 = 2.71828182845904523536028747135266250_f32; // 2.7182818284590451f64

/// Parameters controlling how cells gain or lose brightness.
/// They can be tweaked while the simulation is running to explore different
/// ecological dynamics without recompiling.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub struct LifeParams {
    pub rule: u32,
    pub decay_step: u8,
    pub recovery_step: u8,
    pub sat_recovery_factor: f32,
    pub sat_decay_factor: f32,
    pub lum_decay_factor: f32,
    pub life_decay_factor: f32,
    pub sat_ghost_factor: f32,
    pub hue_drift_strength: f32,
    pub hue_lerp_factor: f32,
}

/// The simulation universe.  The `params` field makes the life‑cycle tunable at runtime.
#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<Individual>,
    next: Vec<Individual>,
    draw_buffer: Vec<bool>,
    params: LifeParams,
}

impl LifeParams {
    pub fn new(
        rule: u32,
        decay_step: u8,
        recovery_step: u8,
        sat_recovery_factor: f32,
        sat_decay_factor: f32,
        lum_decay_factor: f32,
        life_decay_factor: f32,
        sat_ghost_factor: f32,
        hue_drift_strength: f32,
        hue_lerp_factor: f32,
    ) -> Self {
        Self {
            rule,
            decay_step,
            recovery_step,
            sat_recovery_factor,
            sat_decay_factor,
            lum_decay_factor,
            life_decay_factor,
            sat_ghost_factor,
            hue_drift_strength,
            hue_lerp_factor,
        }
    }
}

impl Default for LifeParams {
    fn default() -> Self {
        Self::new(770, 1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1)
    }
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Individual {
  hue: u8,
  saturation: u8,
  luminance: u8,
  lifetime: u8,
}


fn rgb_to_hsl(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g.max(b));
    let min = r.min(g.min(b));
    let l = (max + min) / 2.0;

    if max == min {
        return (0.0, 0.0, l);
    }

    let d = max - min;
    let s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };

    let h = if max == r {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if max == g {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };

    (h, s, l)
}


#[wasm_bindgen]
impl Universe {
  #[wasm_bindgen(constructor)]
  pub fn new(width: u32, height: u32) -> Self {
      let size = (width * height) as usize;
      Self {
          width,
          height,
          cells: vec![Individual::default(); size],
          next: vec![Individual::default(); size],
          draw_buffer: vec![false; size],
          params: LifeParams::default(),
      }
  }


  /// Create a universe with custom parameters.
  pub fn with_params(width: u32, height: u32, params: LifeParams) -> Self {
      Self { params, ..Self::new(width, height) }
  }

  pub fn set_params(
      &mut self,
      rule: u32,
      decay_step: u8,
      recovery_step: u8,
      sat_recovery_factor: f32,
      sat_decay_factor: f32,
      lum_decay_factor: f32,
      life_decay_factor: f32,
      sat_ghost_factor: f32,
      hue_drift_strength: f32,
      hue_lerp_factor: f32,
  ) {
      self.params = LifeParams::new(
          rule,
          decay_step,
          recovery_step,
          sat_recovery_factor,
          sat_decay_factor,
          lum_decay_factor,
          life_decay_factor,
          sat_ghost_factor,
          hue_drift_strength,
          hue_lerp_factor,
      );
  }

  #[inline]
  pub fn index(&self, row: u32, col: u32) -> usize {
    (row * self.width + col) as usize
  }

  /// Returns the eight neighbour indices of `(row, col)` on a toroidal grid
  #[inline]
  fn neighbour_indices(&self, row: u32, col: u32) -> [usize; 8] {
      let north = (row + self.height - 1) % self.height;
      let south = (row + 1) % self.height;
      let west  = (col + self.width  - 1) % self.width;
      let east  = (col + 1) % self.width;

      [
          self.index(north, west),
          self.index(north, col),
          self.index(north, east),
          self.index(row,   west),
          self.index(row,   east),
          self.index(south, west),
          self.index(south, col),
          self.index(south, east),
      ]
  }

  pub fn set_grid(&mut self, h: u8, s: u8, l: u8, t: u8) {
    for cell in self.cells.iter_mut() {
      *cell = Individual {
        hue: h,
        saturation: s,
        luminance: l,
        lifetime: t,
      };
    }
  }


  pub fn randomize(&mut self) {
    let mut rng = rand::rng();
    for cell in self.cells.iter_mut() {
      if rng.random_bool(0.5) {
        *cell = Individual {
          hue: rng.random_range(0..=255),
          saturation: rng.random_range(100..=255),
          luminance: rng.random_range(100..=255),
          lifetime: 255,
        };
      } else {
        *cell = Individual::default();
      }
    }
  }

  pub fn clear(&mut self) {
    for cell in self.cells.iter_mut() {
      *cell = Individual {
        hue: 0,
        saturation: 0,
        luminance: 0,
        lifetime: 0,
      };
    }
  }

  #[wasm_bindgen]
  pub fn draw_stamp_at(&mut self, x: u32, y: u32, stamp_w: u32, stamp_h: u32, data: &[u8]) {
      for sy in 0..stamp_h {
          let uy = y + sy - stamp_h / 2;
          if uy >= self.height { continue; }

          for sx in 0..stamp_w {
              let ux = x + sx - stamp_w / 2;
              if ux >= self.width { continue; }

              let i = ((sy * stamp_w + sx) * 4) as usize;
              let r = data[i] as f32 / 255.0;
              let g = data[i + 1] as f32 / 255.0;
              let b = data[i + 2] as f32 / 255.0;
              let a = data[i + 3] as f32 / 255.0;

              if a <= 0.001 { continue; }

              let (h, s, l) = rgb_to_hsl(r, g, b);
              let target_h = (h * 255.0).round() as u8;
              let target_s = (s * 255.0).round() as u8;
              let target_l = (l * 255.0).round() as u8;

              let idx = self.index(uy, ux);
              let old = self.cells[idx];

              let (new_h, new_s, new_l) = if a >= 0.999 {
                  (target_h, target_s, target_l)
              } else {
                  let lerp = |a: u8, b: u8, t: f32| -> u8 {
                      ((a as f32 * (1.0 - t)) + (b as f32 * t)).round() as u8
                  };
                  (
                      lerp(old.hue, target_h, a),
                      lerp(old.saturation, target_s, a),
                      lerp(old.luminance, target_l, a),
                  )
              };

              self.set_cell(uy, ux, new_h, new_s, new_l, 255);
          }
      }
  }

  pub fn draw_brush(&mut self, cx: u32, cy: u32, radius: u32, add_mode: bool, h: u8, s: u8, l: u8) {
      let r2 = (radius * radius) as i32;

      for dy in -(radius as i32)..=(radius as i32) {
          let y = cy as i32 + dy;
          if y < 0 || y >= self.height as i32 {
              continue;
          }
          let dy2 = dy * dy;

          for dx in -(radius as i32)..=(radius as i32) {
              let dx2 = dx * dx;
              if dx2 + dy2 > r2 {
                  continue;
              }
              let x = cx as i32 + dx;
              if x < 0 || x >= self.width as i32 {
                  continue;
              }

              let (hue, sat, lum) = if add_mode {
                  (
                      h,
                      s,
                      l,
                  )
              } else {
                  (0, 0, 0)
              };

              self.set_cell(y as u32, x as u32, hue, sat, lum, 255);
          }
      }
  }


  /// Advance the automaton by one generation.
  ///
  /// `params.rule` is an 18-bit birth/survival mask laid out as
  /// ```text
  /// bit  0-8  : B0‥B8   (center cell currently dead)
  /// bit 9-17 : S0‥S8   (center cell currently alive)
  /// ```
  /// so classic Conway “B3/S23” is
  /// `0b0000001_00000100_00001000u32  // 0x0408`
  pub fn tick(&mut self) {
      use std::f32::consts::TAU;

      let LifeParams {
          rule,
          decay_step,
          recovery_step,
          sat_recovery_factor,
          sat_decay_factor,
          lum_decay_factor,
          life_decay_factor,
          sat_ghost_factor,
          hue_drift_strength,
          hue_lerp_factor,
      } = self.params;

      for row in 0..self.height {
          for col in 0..self.width {
              let idx = self.index(row, col);

              /* pixels the UI has just “painted” stay unchanged one tick    */
              if std::mem::take(&mut self.draw_buffer[idx]) {
                  self.next[idx] = self.cells[idx];
                  continue;
              }

              /* ---------- count live neighbours & accumulate colour data -------- */
              let mut live_neighbors = 0u8;
              let mut sat_sum = 0.0f32;
              let mut lum_sum = 0.0f32;

              for nidx in self.neighbour_indices(row, col) {
                  let n = self.cells[nidx];
                  if n.lifetime > 0 {
                      live_neighbors += 1;
                      sat_sum += n.saturation as f32;
                      lum_sum += n.luminance as f32;
                  }
              }

              let cell = self.cells[idx];

              /* ---------- decide if the cell is alive next frame ---------------- */
              let bit_index = live_neighbors as u32 + if cell.saturation > 0 { 9 } else { 0 };
              let next_alive = ((rule >> bit_index) & 1) == 1;

              /* ---------- build the next‐generation pixel ----------------------- */
              let next_cell = match (cell.lifetime > 0, next_alive) {
                  /* --- survive --------------------------------------------------- */
                  (true, true) => {
                      let new_sat = (cell.saturation as f32
                          + recovery_step as f32 * sat_recovery_factor)
                          .min(255.0);
                      Individual { saturation: new_sat as u8, ..cell }
                  }

                  /* --- death ----------------------------------------------------- */
                  (true, false) => {
                      let new_sat = (cell.saturation as f32
                          - decay_step as f32 * E * sat_decay_factor)
                          .max(0.0);
                      let new_lum = (cell.saturation as f32
                          - decay_step as f32 * E * lum_decay_factor)
                          .max(0.0);
                      let new_life = (cell.lifetime as f32
                          - decay_step as f32 * E * life_decay_factor)
                          .max(0.0);
                      Individual {
                          hue: cell.hue,
                          saturation: new_sat as u8,
                          luminance: new_lum as u8,
                          lifetime: new_life as u8,
                      }
                  }

                  /* --- birth ----------------------------------------------------- */
                  (false, true) => {
                      /* helpers */
                      let avg = |sum: f32| {
                          if live_neighbors == 0 {
                              0
                          } else {
                              (sum / live_neighbors as f32).round() as u8
                          }
                      };

                      /* brightest neighbour’s hue */
                      let mut strongest_hue = 0u8;
                      let mut max_lum = 0u8;
                      for nidx in self.neighbour_indices(row, col) {
                          let n = self.cells[nidx];
                          if n.luminance > max_lum {
                              max_lum = n.luminance;
                              strongest_hue = n.hue;
                          }
                      }

                      /* circular mean hue blended toward strongest hue */
                      let (mut sin_sum, mut cos_sum) = (0.0f32, 0.0f32);
                      for nidx in self.neighbour_indices(row, col) {
                          let n = self.cells[nidx];
                          if n.lifetime > 0 {
                              let angle = (n.hue as f32 / 255.0) * TAU;
                              sin_sum += angle.sin();
                              cos_sum += angle.cos();
                          }
                      }
                      let mean_angle =
                          if sin_sum == 0.0 && cos_sum == 0.0 { 0.0 } else { sin_sum.atan2(cos_sum) };
                      let strongest_angle = (strongest_hue as f32 / 255.0) * TAU;
                      let mixed_angle = (1.0 - hue_lerp_factor) * mean_angle
                          + hue_lerp_factor * strongest_angle;
                      let drift = (rand::random::<f32>() - 0.5) * hue_drift_strength * 2.0;
                      let final_angle = (mixed_angle + drift).rem_euclid(TAU);
                      let hue = ((final_angle / TAU) * 255.0).round() as u8;

                      Individual {
                          hue,
                          saturation: avg(sat_sum),
                          luminance: avg(lum_sum).saturating_add(1),
                          lifetime: 255,
                      }
                  }

                  /* --- remain dead ---------------------------------------------- */
                  _ => Individual {
                      hue: cell.hue,
                      saturation: (cell.saturation as f32 * sat_ghost_factor) as u8,
                      luminance: (cell.luminance as f32 * lum_decay_factor) as u8,
                      lifetime: (cell.luminance as f32 * life_decay_factor) as u8,
                  },
              };

              self.next[idx] = next_cell;
          }
      }

      std::mem::swap(&mut self.cells, &mut self.next);
  }



  pub fn resize(&mut self, new_width: u32, new_height: u32) {
    let new_size = (new_width * new_height) as usize;
    let mut new_cells = vec![Individual::default(); new_size];
    let mut new_next = vec![Individual::default(); new_size];
    let mut new_draw_buffer = vec![false; new_size];
    let min_width  = self.width.min(new_width);
    let min_height = self.height.min(new_height);
    for row in 0..min_height {
      for col in 0..min_width {
        let old_idx = self.index(row, col);
        let new_idx = (row * new_width + col) as usize;
        new_cells[new_idx] = self.cells[old_idx];
        new_next[new_idx] = self.next[old_idx];
        new_draw_buffer[new_idx] = self.draw_buffer[old_idx];
      }
    }
    self.width = new_width;
    self.height = new_height;
    self.cells = new_cells;
    self.next = new_next;
    self.draw_buffer = new_draw_buffer;
  }

  pub fn set_cell(&mut self, row: u32, col: u32, hue: u8, sat: u8, lum: u8, t: u8) {
    if row < self.height && col < self.width {
      let idx = self.index(row, col);
      self.cells[idx] = Individual { hue, saturation: sat, luminance: lum, lifetime: t};
      self.draw_buffer[idx] = true;
    }
  }

  #[wasm_bindgen]
  pub fn cells_ptr(&self) -> *const u8 {
    self.cells.as_ptr() as *const u8
  }

  #[wasm_bindgen]
  pub fn cells_len(&self) -> usize {
    self.cells.len() * std::mem::size_of::<Individual>()
  }

  pub fn width(&self) -> u32 { self.width }
  pub fn height(&self) -> u32 { self.height }

  pub fn toggle(&mut self, row: u32, col: u32) {
    let idx = self.index(row, col);
    let cell = &mut self.cells[idx];
    cell.luminance = if cell.luminance > 0 { 0 } else { 255 };
  }
}


#[cfg(feature = "console_error_panic_hook")]
#[wasm_bindgen(start)]
pub fn start() {
  console_error_panic_hook::set_once();
  wasm_logger::init(wasm_logger::Config::default());
  log::info!("starting up");
}

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;
