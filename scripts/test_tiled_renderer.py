#!/usr/bin/env python3
"""Regression tests for the shared Tiled map compositor."""

import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tiled_renderer import render_tilemap


def write_map(directory, image_name):
    map_path = directory / "map.json"
    map_path.write_text(
        json.dumps(
            {
                "width": 1,
                "height": 1,
                "tilewidth": 1,
                "tileheight": 1,
                "layers": [
                    {
                        "name": "decoration_0",
                        "type": "tilelayer",
                        "width": 1,
                        "height": 1,
                        "data": [1],
                    }
                ],
                "tilesets": [
                    {
                        "firstgid": 1,
                        "name": "test",
                        "image": image_name,
                        "columns": 1,
                        "tilecount": 1,
                    }
                ],
            }
        )
    )
    return map_path


class TiledRendererTest(unittest.TestCase):
    def test_renders_visible_tiles_from_decoration_zero(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            Image.new("RGBA", (1, 1), (255, 0, 0, 255)).save(
                directory / "tiles.png"
            )
            _, canvas = render_tilemap(write_map(directory, "tiles.png"))

            self.assertEqual(canvas.getpixel((0, 0)), (255, 0, 0, 255))

    def test_fails_when_a_used_tileset_image_is_missing(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            map_path = write_map(directory, "missing.png")

            with self.assertRaises(FileNotFoundError):
                render_tilemap(map_path)


if __name__ == "__main__":
    unittest.main()
