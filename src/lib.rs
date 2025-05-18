use wasm_bindgen::prelude::*;
use rand::Rng;

#[wasm_bindgen]
pub struct Universe {
  width: u32,
  height: u32,
  cells: Vec<Individual>,
  next: Vec<Individual>,
  draw_buffer: Vec<bool>,
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
  pub fn new(width: u32, height: u32) -> Universe {
    let size = (width * height) as usize;
    Universe {
      width,
      height,
      cells: vec![Individual::default(); size],
      next: vec![Individual::default(); size],
      draw_buffer: vec![false; size],
    }
  }
  #[inline]
  fn index(&self, row: u32, col: u32) -> usize {
    (row * self.width + col) as usize
  }

  #[inline]
  fn live_neighbor_count(&self, row: u32, col: u32) -> u8 {
      let w = self.width;
      let h = self.height;
      let mut count = 0;
      let neighbors = [
          (-1, -1), (-1,  0), (-1, 1),
          ( 0, -1),          ( 0, 1),
          ( 1, -1), ( 1,  0), (1, 1),
      ];
      for (dr, dc) in neighbors {
          let r = ((row as i32 + dr + h as i32) % h as i32) as u32;
          let c = ((col as i32 + dc + w as i32) % w as i32) as u32;
          let idx = self.index(r, c);
          if self.cells[idx].luminance > 0 {
              count += 1;
          }
      }
      count
  }
  pub fn randomize(&mut self) {
    let mut rng = rand::rng();
    for cell in self.cells.iter_mut() {
      if rng.random_bool(0.5) {
        *cell = Individual {
          hue: rng.random_range(0..=255),
          saturation: rng.random_range(100..=255),
          luminance: 255,
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

  pub fn tick(&mut self) {
      let mut rng = rand::rng();
      for row in 0..self.height {
          for col in 0..self.width {
              let idx = self.index(row, col);
              if self.draw_buffer[idx] {
                  self.next[idx] = self.cells[idx];
                  self.draw_buffer[idx] = false;
                  continue;
              }
              let live_neighbors = self.live_neighbor_count(row, col);
              let cell = self.cells[idx];
              self.next[idx] = match (cell.luminance > 0, live_neighbors) {
                  (true, 2) => cell,
                  (_, 3) => {
                      if cell.luminance > 0 {
                          // survive with decay
                          Individual {
                              luminance: cell.luminance.saturating_sub(1),
                              ..cell
                          }
                      } else {
                          // new cell
                          Individual {
                              hue: rng.random_range(0..=255),
                              saturation: rng.random_range(180..=255),
                              luminance: 255,
                          }
                      }
                  }
                  _ => Individual::default(),
              };
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
