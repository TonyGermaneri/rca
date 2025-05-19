use wasm_bindgen::prelude::*;
use rand::Rng;

/// Parameters controlling how cells gain or lose brightness.
/// They can be tweaked while the simulation is running to explore different
/// ecological dynamics without recompiling.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub struct LifeParams {
    /// How quickly brightness fades when the environment is poor (higher ⇒ faster fade)
    pub decay_step: u8,
    /// How quickly brightness recovers in a healthy environment (higher ⇒ faster brighten)
    pub recovery_step: u8,
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
    /// Construct new parameters at runtime in a clear and ergonomic way.
    pub fn new(decay_step: u8, recovery_step: u8) -> Self {
        Self { decay_step, recovery_step }
    }
}

impl Default for LifeParams {
    fn default() -> Self {
        Self::new(1, 1)
    }
}



#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Individual {
  hue: u8,
  saturation: u8,
  luminance: u8,
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

  /// Update the life‑cycle parameters while the simulation is running.
  /// Call with primitive values so UI sliders can feed directly into the engine.
  pub fn set_params(&mut self, decay_step: u8, recovery_step: u8) {
      self.params = LifeParams::new(decay_step, recovery_step);
  }


  #[inline]
  fn index(&self, row: u32, col: u32) -> usize {
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

  pub fn randomize(&mut self) {
    let mut rng = rand::rng();
    for cell in self.cells.iter_mut() {
      if rng.random_bool(0.5) {
        *cell = Individual {
          hue: rng.random_range(0..=255),
          saturation: 255,
          luminance: rng.random_range(100..=255),
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
      };
    }
  }

  pub fn draw_brush(&mut self, cx: u32, cy: u32, radius: u32, add_mode: bool, h: u8, s: u8, l: u8) {
      let mut rng = rand::rng();
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

              self.set_cell(y as u32, x as u32, hue, sat, lum);
          }
      }
  }


  /// Advance the universe by a single generation, with soft gradient transitions.
  pub fn tick(&mut self) {
      let LifeParams { decay_step, recovery_step } = self.params;

      for row in 0..self.height {
          for col in 0..self.width {
              let idx = self.index(row, col);

              // Pixels just painted by UI skip simulation.
              if std::mem::take(&mut self.draw_buffer[idx]) {
                  self.next[idx] = self.cells[idx];
                  continue;
              }

              let mut live_neighbors = 0u8;
              let mut hue_sum: f32 = 0.0;
              let mut sat_sum: f32 = 0.0;
              let mut lum_sum: f32 = 0.0;

              for nidx in self.neighbour_indices(row, col) {
                  let n = self.cells[nidx];
                  if n.saturation > 0 {
                      live_neighbors += 1;
                      hue_sum += n.hue as f32;
                      sat_sum += n.saturation as f32;
                      lum_sum += n.luminance as f32;
                  }
              }

              let cell = self.cells[idx];
              let next_cell = match (cell.saturation > 0, live_neighbors) {
                  (true, 2 | 3) => {
                      // Smooth recovery and color blending
                      let new_sat = (cell.saturation as f32 + recovery_step as f32 * 0.8).min(255.0);
                      Individual {
                          hue: cell.hue,
                          saturation: new_sat as u8,
                          luminance: cell.luminance,
                      }
                  }

                  (true, _) => {
                      // Gradual fade with slight hue shift for artistic wash-out
                      let new_sat = (cell.saturation as f32 - decay_step as f32 * 0.6).max(0.0);
                      Individual {
                          hue: cell.hue,
                          saturation: new_sat as u8,
                          luminance: (cell.luminance as f32 * 0.95) as u8,
                      }
                  }

                  (false, 3) => {
                    let avg = |sum: f32| (sum / live_neighbors as f32).round() as u8;

                    // Convert hue to radians (0..2π), sum as vectors
                    let mut sum_sin = 0.0f32;
                    let mut sum_cos = 0.0f32;

                    for nidx in self.neighbour_indices(row, col) {
                        let n = self.cells[nidx];
                        if n.saturation > 0 {
                            let angle = (n.hue as f32 / 255.0) * std::f32::consts::TAU;
                            sum_sin += angle.sin();
                            sum_cos += angle.cos();
                        }
                    }

                    let base_angle = sum_sin.atan2(sum_cos); // average angle in radians

                    // Drift: small angular offset
                    let hue_drift_strength = 0.02; // radians — tweak to control drift speed
                    let drift = rand::random::<f32>() * hue_drift_strength * 2.0 - hue_drift_strength;
                    let hue_angle = base_angle + drift;

                    // Normalize angle to [0.0, 1.0), then scale to u8 hue
                    let hue = ((hue_angle / std::f32::consts::TAU).rem_euclid(1.0) * 255.0).round() as u8;

                    Individual {
                        hue,
                        saturation: avg(sat_sum),
                        luminance: avg(lum_sum).saturating_add(1),
                    }
                  }

                  _ => {
                      // Dead cell slowly ghosts away
                      Individual {
                          hue: cell.hue,
                          saturation: (cell.saturation as f32 * 0.9) as u8,
                          luminance: (cell.luminance as f32 * 0.8) as u8,
                      }
                  }
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

  pub fn set_cell(&mut self, row: u32, col: u32, hue: u8, sat: u8, lum: u8) {
    if row < self.height && col < self.width {
      let idx = self.index(row, col);
      self.cells[idx] = Individual { hue, saturation: sat, luminance: lum };
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
}

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;
