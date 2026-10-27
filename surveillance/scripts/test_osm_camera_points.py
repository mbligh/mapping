#!/usr/bin/env python3
"""Ensure OSM surveillance markers are classified without confusing traffic lights."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("osm_camera_points")

class CameraClassificationTest(unittest.TestCase):
    def test_camera_types_and_preserved_tags(self):
        cases = [
            ({"highway": "red_light_camera"}, "red_light"),
            ({"man_made": "surveillance", "surveillance": "red_light"}, "red_light"),
            ({"enforcement": "traffic_signals"}, "red_light"),
            ({"highway": "speed_camera"}, "speed"),
            ({"enforcement": "maxspeed"}, "speed"),
            ({"highway": "traffic_signals"}, "surveillance"),
            ({"man_made": "surveillance"}, "surveillance"),
            ({"highway": "speed_camera", "surveillance": "red_light"}, "red_light"),
        ]
        features = [
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-74.5, 40.5]},
             "properties": tags}
            for tags, _ in cases
        ]
        with tempfile.TemporaryDirectory() as td:
            src, dst = Path(td)/"src.geojsonseq", Path(td)/"dst.geojsonseq"
            src.write_text("\n".join(json.dumps(x) for x in features)+"\n")
            p = subprocess.run([sys.executable, str(SCRIPT), str(src), str(dst)],
                               capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            actual = [json.loads(x) for x in dst.read_text().splitlines()]
        self.assertEqual(len(actual), len(cases))
        for point, (original, expected) in zip(actual, cases):
            props = point["properties"]
            self.assertEqual(props["camera_type"], expected)
            self.assertEqual(props["source"], "OSM")
            for k, v in original.items():
                self.assertEqual(props[k], v)
            self.assertIn("camera_title", props)

if __name__ == "__main__":
    unittest.main()
