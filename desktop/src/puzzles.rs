use serde_json::{json, Value};

#[tauri::command]
pub fn new_board(game: String) -> Result<Value, String> {
    let mut rng = fastrand::Rng::new();
    match game.as_str() {
        "Minesweeper" => {
            let mut order: Vec<_> = (0..64).collect();
            rng.shuffle(&mut order);
            Ok(json!({"order":order,"mines":null,"flags":[],"revealed":[],"ended":""}))
        }
        "Word Search" => {
            let themes = [
                ("Woodland", "FERN MOSS ACORN BIRCH MAPLE CEDAR WREN TRAIL GLEN BROOK LARCH GROVE FAWN BADGER BARK"),
                ("After dark", "COMET ORBIT LUNAR VENUS MARS STAR NOVA PLUTO DUSK MOON HALO AURORA ECLIPSE ZENITH"),
                ("By the sea", "TIDE COVE REEF PIER SHELL CORAL WAVE BEACH SURF GULL KELP FOAM DUNE ORCA SHORE"),
                ("In the kitchen", "BASIL SAGE THYME CLOVE LEMON OLIVE FENNEL PESTO WHISK LADLE SPICE PEPPER MINT ZEST"),
                ("Record store", "VINYL GROOVE PIANO TEMPO DRUM BEAT CHORD BASS JAZZ TRACK ALBUM TUNER FLUTE SOLO"),
                ("Art studio", "INK WASH CHALK EASEL BRUSH PAINT PAPER PASTEL SKETCH HUE CANVAS CLAY GLAZE OCHRE"),
                ("On the trail", "RIDGE CAIRN PEAK PASS CREEK BLUFF SLOPE CAMP SUMMIT BOOTS ROPE FLINT ROCK LEDGE"),
                ("Rainy afternoon", "RAIN MIST CLOUD PUDDLE COCOA TEAPOT BOOK SOFA THROW STORM DRIP MUG STEAM TOAST"),
            ];
            let (theme, vocabulary) = rng.choice(themes.iter()).unwrap();
            let mut pool: Vec<_> = vocabulary.split_whitespace().collect();
            rng.shuffle(&mut pool);
            let words = &pool[..6];
            // Place longer words first, leaving more options for the short ones.
            let mut to_place = words.to_vec();
            to_place.sort_by_key(|w| std::cmp::Reverse(w.len()));
            for _ in 0..32 {
                let mut cells = [' '; 64];
                let mut placed = 0;
                for word in &to_place {
                    let mut places = vec![];
                    for start in 0..64 {
                        for (dy, dx) in [
                            (0, 1),
                            (1, 0),
                            (1, 1),
                            (1, -1),
                            (0, -1),
                            (-1, 0),
                            (-1, -1),
                            (-1, 1),
                        ] {
                            let mut path = vec![];
                            for (k, ch) in word.chars().enumerate() {
                                let y = start / 8 + dy * k as i32;
                                let x = start % 8 + dx * k as i32;
                                if !(0..8).contains(&y) || !(0..8).contains(&x) {
                                    break;
                                }
                                let cell = (8 * y + x) as usize;
                                if cells[cell] != ' ' && cells[cell] != ch {
                                    break;
                                }
                                path.push(cell);
                            }
                            if path.len() == word.len() {
                                places.push(path)
                            }
                        }
                    }
                    let Some(path) = rng.choice(places.iter()) else {
                        break;
                    };
                    for (cell, ch) in path.iter().zip(word.chars()) {
                        cells[*cell] = ch;
                    }
                    placed += 1;
                }
                if placed != words.len() {
                    continue;
                }
                for ch in &mut cells {
                    if *ch == ' ' {
                        *ch = (b'A' + rng.u8(0..26)) as char;
                    }
                }
                return Ok(
                    json!({"theme":theme, "words":words,"cells":cells.to_vec(),"found":{},"ended":""}),
                );
            }
            Err("Could not generate a board. Try again.".into())
        }
        _ => Err("Unknown activity.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generated_word_boards_contain_every_requested_word() {
        let mut boards = std::collections::BTreeSet::new();
        for _ in 0..32 {
            let board = new_board("Word Search".into()).unwrap();
            let cells = board["cells"].as_array().unwrap();
            assert_eq!(cells.len(), 64);
            for value in board["words"].as_array().unwrap() {
                let word = value.as_str().unwrap();
                assert!((0..64).any(|start| [
                    (0, 1),
                    (0, -1),
                    (1, 0),
                    (-1, 0),
                    (1, 1),
                    (-1, -1),
                    (1, -1),
                    (-1, 1)
                ]
                .iter()
                .any(|(dy, dx)| {
                    word.bytes().enumerate().all(|(j, c)| {
                        let x = start % 8 + dx * j as i32;
                        let y = start / 8 + dy * j as i32;
                        (0..8).contains(&x)
                            && (0..8).contains(&y)
                            && cells[(y * 8 + x) as usize].as_str().unwrap().as_bytes()[0] == c
                    })
                })));
            }
            boards.insert(board["cells"].to_string());
        }
        assert_eq!(boards.len(), 32);
    }
}
