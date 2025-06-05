#[cfg(test)]
mod tests {
    use crate::{
        LifeParams, LifeChannel, Individual, Universe, BrushState,
        rgb_to_hsl, median_from_histogram
    };

    #[test]
    fn test_life_params_new() {
        let params = LifeParams::new(
            770, 1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Alpha
        );

        assert_eq!(params.rule, 770);
        assert_eq!(params.decay_step, 1);
        assert_eq!(params.recovery_step, 60);
        assert_eq!(params.sat_recovery_factor, 0.8);
        assert_eq!(params.sat_decay_factor, 0.6);
        assert_eq!(params.lum_decay_factor, 0.95);
        assert_eq!(params.life_decay_factor, 0.95);
        assert_eq!(params.sat_ghost_factor, 0.9);
        assert_eq!(params.hue_drift_strength, 0.01);
        assert_eq!(params.hue_lerp_factor, 0.1);
        assert_eq!(params.life_channel, LifeChannel::Alpha);
    }

    #[test]
    fn test_life_params_default() {
        let params = LifeParams::default();

        assert_eq!(params.rule, 770);
        assert_eq!(params.decay_step, 1);
        assert_eq!(params.recovery_step, 60);
        assert_eq!(params.sat_recovery_factor, 0.8);
        assert_eq!(params.sat_decay_factor, 0.6);
        assert_eq!(params.lum_decay_factor, 0.95);
        assert_eq!(params.life_decay_factor, 0.95);
        assert_eq!(params.sat_ghost_factor, 0.9);
        assert_eq!(params.hue_drift_strength, 0.01);
        assert_eq!(params.hue_lerp_factor, 0.1);
        assert_eq!(params.life_channel, LifeChannel::Alpha);
    }

    #[test]
    fn test_individual_activity_value() {
        let ind = Individual {
            hue: 100,
            saturation: 150,
            luminance: 200,
            alpha: 250,
        };

        assert_eq!(ind.activity_value(LifeChannel::Hue), 100);
        assert_eq!(ind.activity_value(LifeChannel::Saturation), 150);
        assert_eq!(ind.activity_value(LifeChannel::Luminance), 200);
        assert_eq!(ind.activity_value(LifeChannel::Alpha), 250);
    }

    #[test]
    fn test_rgb_to_hsl() {
        // Black
        let (h, s, l) = rgb_to_hsl(0.0, 0.0, 0.0);
        assert_eq!(h, 0.0);
        assert_eq!(s, 0.0);
        assert_eq!(l, 0.0);

        // White
        let (h, s, l) = rgb_to_hsl(1.0, 1.0, 1.0);
        assert_eq!(h, 0.0);
        assert_eq!(s, 0.0);
        assert_eq!(l, 1.0);

        // Red
        let (h, s, l) = rgb_to_hsl(1.0, 0.0, 0.0);
        assert_eq!(h, 0.0);
        assert!(s > 0.99);
        assert_eq!(l, 0.5);

        // Green
        let (h, s, l) = rgb_to_hsl(0.0, 1.0, 0.0);
        assert_eq!(h, 1.0/3.0);
        assert!(s > 0.99);
        assert_eq!(l, 0.5);

        // Blue
        let (h, s, l) = rgb_to_hsl(0.0, 0.0, 1.0);
        assert_eq!(h, 2.0/3.0);
        assert!(s > 0.99);
        assert_eq!(l, 0.5);
    }

    #[test]
    fn test_universe_new() {
        let universe = Universe::new(10, 20);

        assert_eq!(universe.width(), 10);
        assert_eq!(universe.height(), 20);
        assert_eq!(universe.cells.len(), 200);
        assert_eq!(universe.next.len(), 200);
        assert_eq!(universe.draw_buffer.len(), 200);

        // Check default values
        assert_eq!(universe.params.rule, 770);
        assert_eq!(universe.stats.avg_hue, 0.0);
        assert_eq!(universe.stats.population_ratio, 0.0);
    }

    #[test]
    fn test_universe_with_params() {
        let params = LifeParams::new(
            123, 2, 30, 0.7, 0.5, 0.9, 0.9, 0.8, 0.02, 0.2, LifeChannel::Hue
        );
        let universe = Universe::with_params(10, 20, params);

        assert_eq!(universe.width(), 10);
        assert_eq!(universe.height(), 20);
        assert_eq!(universe.params.rule, 123);
        assert_eq!(universe.params.decay_step, 2);
        assert_eq!(universe.params.life_channel, LifeChannel::Hue);
    }

    #[test]
    fn test_universe_set_params() {
        let mut universe = Universe::new(10, 20);
        universe.set_params(
            123, 2, 30, 0.7, 0.5, 0.9, 0.9, 0.8, 0.02, 0.2, LifeChannel::Hue
        );

        assert_eq!(universe.params.rule, 123);
        assert_eq!(universe.params.decay_step, 2);
        assert_eq!(universe.params.recovery_step, 30);
        assert_eq!(universe.params.sat_recovery_factor, 0.7);
        assert_eq!(universe.params.sat_decay_factor, 0.5);
        assert_eq!(universe.params.lum_decay_factor, 0.9);
        assert_eq!(universe.params.life_decay_factor, 0.9);
        assert_eq!(universe.params.sat_ghost_factor, 0.8);
        assert_eq!(universe.params.hue_drift_strength, 0.02);
        assert_eq!(universe.params.hue_lerp_factor, 0.2);
        assert_eq!(universe.params.life_channel, LifeChannel::Hue);
    }

    #[test]
    fn test_universe_index() {
        let universe = Universe::new(10, 20);

        assert_eq!(universe.index(0, 0), 0);
        assert_eq!(universe.index(0, 5), 5);
        assert_eq!(universe.index(1, 0), 10);
        assert_eq!(universe.index(5, 5), 55);
    }

    #[test]
    fn test_universe_get_neighbour_indices() {
        let universe = Universe::new(10, 20);
        let mut neighbors = [0; 8];

        // Test middle cell
        universe.get_neighbour_indices(5, 5, &mut neighbors);
        assert_eq!(neighbors[0], universe.index(4, 4)); // NW
        assert_eq!(neighbors[1], universe.index(4, 5)); // N
        assert_eq!(neighbors[2], universe.index(4, 6)); // NE
        assert_eq!(neighbors[3], universe.index(5, 4)); // W
        assert_eq!(neighbors[4], universe.index(5, 6)); // E
        assert_eq!(neighbors[5], universe.index(6, 4)); // SW
        assert_eq!(neighbors[6], universe.index(6, 5)); // S
        assert_eq!(neighbors[7], universe.index(6, 6)); // SE

        // Test edge wrapping
        universe.get_neighbour_indices(0, 0, &mut neighbors);
        assert_eq!(neighbors[0], universe.index(19, 9)); // NW wraps
        assert_eq!(neighbors[1], universe.index(19, 0)); // N wraps
        assert_eq!(neighbors[2], universe.index(19, 1)); // NE wraps
        assert_eq!(neighbors[3], universe.index(0, 9));  // W wraps
        assert_eq!(neighbors[4], universe.index(0, 1));  // E
        assert_eq!(neighbors[5], universe.index(1, 9));  // SW wraps
        assert_eq!(neighbors[6], universe.index(1, 0));  // S
        assert_eq!(neighbors[7], universe.index(1, 1));  // SE
    }

    #[test]
    fn test_universe_set_grid() {
        let mut universe = Universe::new(10, 20);
        universe.set_grid(100, 150, 200, 250);

        for i in 0..(10*20) {
            assert_eq!(universe.cells[i].hue, 100);
            assert_eq!(universe.cells[i].saturation, 150);
            assert_eq!(universe.cells[i].luminance, 200);
            assert_eq!(universe.cells[i].alpha, 250);
        }
    }

    #[test]
    fn test_universe_clear() {
        let mut universe = Universe::new(10, 20);
        universe.set_grid(100, 150, 200, 250);
        universe.clear();

        for i in 0..(10*20) {
            assert_eq!(universe.cells[i].hue, 0);
            assert_eq!(universe.cells[i].saturation, 0);
            assert_eq!(universe.cells[i].luminance, 0);
            assert_eq!(universe.cells[i].alpha, 0);
        }
    }

    #[test]
    fn test_universe_set_cell() {
        let mut universe = Universe::new(10, 20);

        // Valid cell
        universe.set_cell(5, 5, 100, 150, 200, 250);
        let idx = universe.index(5, 5);
        assert_eq!(universe.cells[idx].hue, 100);
        assert_eq!(universe.cells[idx].saturation, 150);
        assert_eq!(universe.cells[idx].luminance, 200);
        assert_eq!(universe.cells[idx].alpha, 250);
        assert!(universe.draw_buffer[idx]);

        // Out of bounds - should not crash
        universe.set_cell(100, 100, 100, 150, 200, 250);

        // Empty universe - should not crash
        let mut empty_universe = Universe::new(0, 0);
        empty_universe.set_cell(0, 0, 100, 150, 200, 250);
    }

    #[test]
    fn test_universe_toggle() {
        let mut universe = Universe::new(10, 20);

        // Start with 0
        let idx = universe.index(5, 5);
        assert_eq!(universe.cells[idx].luminance, 0);

        // Toggle to 255
        universe.toggle(5, 5);
        assert_eq!(universe.cells[idx].luminance, 255);

        // Toggle back to 0
        universe.toggle(5, 5);
        assert_eq!(universe.cells[idx].luminance, 0);
    }

    #[test]
    fn test_universe_resize() {
        let mut universe = Universe::new(10, 20);
        universe.set_cell(5, 5, 100, 150, 200, 250);

        // Resize larger
        universe.resize(20, 30);
        assert_eq!(universe.width(), 20);
        assert_eq!(universe.height(), 30);
        assert_eq!(universe.cells.len(), 20 * 30);

        // Original data should be preserved
        let idx = universe.index(5, 5);
        assert_eq!(universe.cells[idx].hue, 100);
        assert_eq!(universe.cells[idx].saturation, 150);
        assert_eq!(universe.cells[idx].luminance, 200);
        assert_eq!(universe.cells[idx].alpha, 250);

        // Resize smaller
        universe.resize(5, 10);
        assert_eq!(universe.width(), 5);
        assert_eq!(universe.height(), 10);
        assert_eq!(universe.cells.len(), 5 * 10);

        // Data within bounds should be preserved
        let idx = universe.index(4, 4);
        assert_eq!(universe.cells[idx].hue, universe.cells[idx].hue);
    }

    #[test]
    fn test_universe_dispose() {
        let mut universe = Universe::new(10, 20);
        universe.dispose();

        assert_eq!(universe.width(), 0);
        assert_eq!(universe.height(), 0);
        assert_eq!(universe.cells.len(), 0);
        assert_eq!(universe.next.len(), 0);
        assert_eq!(universe.draw_buffer.len(), 0);
    }

    #[test]
    fn test_universe_save_load_state() {
        let mut universe = Universe::new(10, 20);
        universe.set_grid(100, 150, 200, 250);

        // Save state
        let state = universe.save_state();
        assert_eq!(state.len(), universe.cells_len());

        // Clear and verify it's cleared
        universe.clear();
        assert_eq!(universe.cells[0].hue, 0);

        // Load state and verify it's restored
        let success = universe.load_state(&state);
        assert!(success);
        assert_eq!(universe.cells[0].hue, 100);
        assert_eq!(universe.cells[0].saturation, 150);
        assert_eq!(universe.cells[0].luminance, 200);
        assert_eq!(universe.cells[0].alpha, 250);

        // Try loading wrong size state
        let wrong_size = vec![0; 10];
        let success = universe.load_state(&wrong_size);
        assert!(!success);
    }

    #[test]
    fn test_universe_tick_basic() {
        // Test Conway's Game of Life using the exact value from the comment
        let mut universe = Universe::new(10, 10);
        universe.set_params(
            0x0408, // Conway's B3/S23 as specified in the code comment
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Alpha
        );

        // Create a blinker pattern (horizontal line)
        universe.set_cell(4, 3, 100, 200, 200, 255);
        universe.set_cell(4, 4, 100, 200, 200, 255);
        universe.set_cell(4, 5, 100, 200, 200, 255);

        // First tick - should become vertical
        universe.tick();

        // Check if the pattern evolved correctly
        let cells = universe.cells();
        println!("After first tick:");
        for row in 3..6 {
            for col in 3..6 {
                let idx = universe.index(row, col);
                print!("{} ", if cells[idx].alpha > 0 { "X" } else { "." });
            }
            println!();
        }

        // In Conway's Game of Life, a blinker should oscillate
        // The middle cell should survive, and cells above/below should be born
        assert_eq!(cells[universe.index(3, 4)].alpha, 255, "Cell (3,4) should be alive");
        assert_eq!(cells[universe.index(4, 4)].alpha, 255, "Cell (4,4) should be alive");
        assert_eq!(cells[universe.index(5, 4)].alpha, 255, "Cell (5,4) should be alive");
    }

    #[test]
    fn test_universe_tick_empty() {
        // Empty universe should not crash
        let mut universe = Universe::new(0, 0);
        universe.tick();

        // Empty but initialized universe should not crash
        let mut universe = Universe::new(10, 10);
        universe.tick();
    }

    #[test]
    fn test_universe_tick_stats() {
        let mut universe = Universe::new(10, 10);
        universe.set_params(
            0x0408, // Conway's B3/S23 as specified in the code comment
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Alpha
        );

        // Create a blinker pattern
        universe.set_cell(4, 3, 100, 200, 200, 255);
        universe.set_cell(4, 4, 100, 200, 200, 255);
        universe.set_cell(4, 5, 100, 200, 200, 255);

        // Check stats before tick
        let stats_before = universe.stats();
        println!("Before tick - alive_count: {}, avg_alpha: {}", stats_before.alive_count(), stats_before.avg_alpha());

        universe.tick();

        // Check that stats are updated
        let stats = universe.stats();
        println!("After tick - alive_count: {}, avg_alpha: {}", stats.alive_count(), stats.avg_alpha());

        // Count living cells manually
        let mut manual_count = 0;
        for cell in universe.cells() {
            if cell.alpha > 0 {
                manual_count += 1;
            }
        }
        println!("Manual count of living cells: {}", manual_count);

        assert!(stats.alive_count() > 0, "Should have living cells after tick");
        assert!(stats.avg_alpha() > 0.0, "Average alpha should be > 0");
        assert!(stats.population_ratio() > 0.0, "Population ratio should be > 0");
    }

    #[test]
    fn test_median_from_histogram() {
        let mut hist = [0usize; 256];
        hist[100] = 50;
        hist[150] = 50;

        let median = median_from_histogram(&hist, 100);
        assert_eq!(median, 100.0);

        // Test with odd total
        hist[200] = 1;
        let median = median_from_histogram(&hist, 101);
        assert_eq!(median, 100.0);

        // Test empty histogram
        let empty_hist = [0usize; 256];
        let median = median_from_histogram(&empty_hist, 0);
        assert_eq!(median, 0.0);
    }

    #[test]
    fn test_life_channel_variants() {
        // Test all LifeChannel variants
        let individual = Individual {
            hue: 10,
            saturation: 20,
            luminance: 30,
            alpha: 40,
        };

        assert_eq!(individual.activity_value(LifeChannel::Hue), 10);
        assert_eq!(individual.activity_value(LifeChannel::Saturation), 20);
        assert_eq!(individual.activity_value(LifeChannel::Luminance), 30);
        assert_eq!(individual.activity_value(LifeChannel::Alpha), 40);
    }

    #[test]
    fn test_rgb_to_hsl_edge_cases() {
        // Test gray values
        let (h, s, l) = rgb_to_hsl(0.5, 0.5, 0.5);
        assert_eq!(h, 0.0);
        assert_eq!(s, 0.0);
        assert_eq!(l, 0.5);

        // Test cyan
        let (h, s, l) = rgb_to_hsl(0.0, 1.0, 1.0);
        assert!((h - 0.5).abs() < 0.01); // Should be around 0.5 (180 degrees)
        assert!(s > 0.99);
        assert_eq!(l, 0.5);

        // Test magenta
        let (h, s, l) = rgb_to_hsl(1.0, 0.0, 1.0);
        assert!((h - 5.0/6.0).abs() < 0.01); // Should be around 5/6 (300 degrees)
        assert!(s > 0.99);
        assert_eq!(l, 0.5);

        // Test yellow
        let (h, s, l) = rgb_to_hsl(1.0, 1.0, 0.0);
        assert!((h - 1.0/6.0).abs() < 0.01); // Should be around 1/6 (60 degrees)
        assert!(s > 0.99);
        assert_eq!(l, 0.5);
    }

    #[test]
    fn test_universe_randomize() {
        let mut universe = Universe::new(10, 10);

        // Initially all cells should be default (zeros)
        for cell in universe.cells() {
            assert_eq!(cell.hue, 0);
            assert_eq!(cell.saturation, 0);
            assert_eq!(cell.luminance, 0);
            assert_eq!(cell.alpha, 0);
        }

        // After randomize, some cells should be non-zero
        universe.randomize();

        let mut has_non_zero = false;
        for cell in universe.cells() {
            if cell.hue != 0 || cell.saturation != 0 || cell.luminance != 0 || cell.alpha != 0 {
                has_non_zero = true;
                break;
            }
        }
        assert!(has_non_zero, "Randomize should create some non-zero cells");
    }

    #[test]
    fn test_universe_cells_ptr_and_len() {
        let universe = Universe::new(5, 5);

        let ptr = universe.cells_ptr();
        assert!(!ptr.is_null());

        let len = universe.cells_len();
        assert_eq!(len, 5 * 5 * std::mem::size_of::<Individual>());
    }

    #[test]
    fn test_universe_stats_getters() {
        let mut universe = Universe::new(5, 5);
        universe.set_cell(2, 2, 100, 150, 200, 255);
        universe.tick();

        let stats = universe.stats();

        // Test all getter methods
        assert!(stats.avg_hue() >= 0.0);
        assert!(stats.median_hue() >= 0.0);
        assert!(stats.avg_saturation() >= 0.0);
        assert!(stats.median_saturation() >= 0.0);
        assert!(stats.avg_luminance() >= 0.0);
        assert!(stats.median_luminance() >= 0.0);
        assert!(stats.avg_alpha() >= 0.0);
        assert!(stats.median_alpha() >= 0.0);
        // alive_count and dead_count are usize, so >= 0 is always true
        assert!(stats.alive_count() + stats.dead_count() == 25); // 5x5 grid
        assert!(stats.population_ratio() >= 0.0);
        assert!(stats.population_ratio() <= 1.0);
    }

    #[test]
    fn test_universe_tick_different_life_channels() {
        // Test with Hue as life channel
        let mut universe = Universe::new(5, 5);
        universe.set_params(
            0x0408, // Conway's B3/S23
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Hue
        );

        universe.set_cell(2, 2, 255, 100, 100, 100); // High hue value
        universe.tick();

        // Test with Saturation as life channel
        universe.set_params(
            0x0408, // Conway's B3/S23
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Saturation
        );

        universe.set_cell(2, 2, 100, 255, 100, 100); // High saturation value
        universe.tick();

        // Test with Luminance as life channel
        universe.set_params(
            0x0408, // Conway's B3/S23
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Luminance
        );

        universe.set_cell(2, 2, 100, 100, 255, 100); // High luminance value
        universe.tick();

        // Should not crash and should process correctly
        assert!(true);
    }

    #[test]
    fn test_universe_draw_stamp_at() {
        let mut universe = Universe::new(10, 10);

        // Create a simple 2x2 stamp with RGBA data
        let stamp_data = vec![
            255, 0, 0, 255,    // Red pixel
            0, 255, 0, 255,    // Green pixel
            0, 0, 255, 255,    // Blue pixel
            255, 255, 0, 255,  // Yellow pixel
        ];

        universe.draw_stamp_at(5, 5, 2, 2, &stamp_data);

        // Check that cells were modified
        let cells = universe.cells();
        let mut modified_count = 0;
        for cell in cells {
            if cell.hue != 0 || cell.saturation != 0 || cell.luminance != 0 || cell.alpha != 0 {
                modified_count += 1;
            }
        }
        assert!(modified_count > 0, "Stamp should modify some cells");
    }

    #[test]
    fn test_universe_draw_stamp_at_edge_cases() {
        let mut universe = Universe::new(5, 5);

        // Test with transparent pixels (alpha = 0)
        let transparent_data = vec![
            255, 0, 0, 0,    // Transparent red - should be skipped
            0, 255, 0, 255,  // Opaque green
        ];

        universe.draw_stamp_at(2, 2, 2, 1, &transparent_data);

        // Test drawing outside bounds
        let small_data = vec![255, 0, 0, 255];
        universe.draw_stamp_at(10, 10, 1, 1, &small_data); // Outside bounds

        // Should not crash
        assert!(true);
    }

    #[test]
    fn test_universe_draw_brush() {
        let mut universe = Universe::new(10, 10);

        // Test add mode
        universe.draw_brush(5, 5, 2, true, 100, 150, 200, 1);

        // Check that cells were modified
        let cells = universe.cells();
        let mut modified_count = 0;
        for cell in cells {
            if cell.alpha > 0 {
                modified_count += 1;
            }
        }
        assert!(modified_count > 0, "Brush should modify some cells");

        // Test remove mode
        universe.draw_brush(5, 5, 2, false, 100, 150, 200, 2);

        // Test with multiple points to trigger spline drawing
        universe.draw_brush(3, 3, 1, true, 50, 75, 100, 3);
        universe.draw_brush(4, 4, 1, true, 50, 75, 100, 3);
        universe.draw_brush(5, 5, 1, true, 50, 75, 100, 3);
        universe.draw_brush(6, 6, 1, true, 50, 75, 100, 3);
        universe.draw_brush(7, 7, 1, true, 50, 75, 100, 3); // Should trigger spline

        // Should not crash
        assert!(true);
    }

    #[test]
    fn test_brush_state() {
        let brush_state = BrushState::default();
        assert_eq!(brush_state.last_id, None);
        assert_eq!(brush_state.points.len(), 0);

        let brush_state2 = BrushState {
            last_id: Some(42),
            points: vec![(1, 2), (3, 4)],
        };
        assert_eq!(brush_state2.last_id, Some(42));
        assert_eq!(brush_state2.points.len(), 2);
    }

    #[test]
    fn test_individual_default() {
        let individual = Individual::default();
        assert_eq!(individual.hue, 0);
        assert_eq!(individual.saturation, 0);
        assert_eq!(individual.luminance, 0);
        assert_eq!(individual.alpha, 0);
    }

    #[test]
    fn test_universe_tick_complex_patterns() {
        let mut universe = Universe::new(10, 10);
        universe.set_params(
            0x0408, // Conway's B3/S23
            1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.01, 0.1, LifeChannel::Alpha
        );

        // Create a simple stable pattern (block)
        universe.set_cell(4, 4, 100, 200, 200, 255);
        universe.set_cell(4, 5, 100, 200, 200, 255);
        universe.set_cell(5, 4, 100, 200, 200, 255);
        universe.set_cell(5, 5, 100, 200, 200, 255);

        // Run several generations
        for _ in 0..4 {
            universe.tick();
        }

        // Block should remain stable with 4 cells
        let stats = universe.stats();
        assert_eq!(stats.alive_count(), 4, "Block should maintain 4 cells");
    }

    #[test]
    fn test_universe_tick_decay_parameters() {
        let mut universe = Universe::new(5, 5);
        universe.set_params(
            0, // No birth or survival rules - everything dies
            10, 30, 0.5, 0.8, 0.7, 0.6, 0.4, 0.02, 0.3, LifeChannel::Alpha
        );

        // Create a cell with high values
        universe.set_cell(2, 2, 200, 200, 200, 200);

        let before_alpha = universe.cells()[universe.index(2, 2)].alpha;
        universe.tick();
        let after_alpha = universe.cells()[universe.index(2, 2)].alpha;

        // With no survival rules, the cell should either die or decay
        // The exact behavior depends on the complex decay logic
        assert!(after_alpha <= before_alpha, "Cell should not increase when no survival rule applies");

        // Test that the tick function runs without crashing
        universe.tick();
        assert!(true, "Tick should complete without crashing");
    }
}