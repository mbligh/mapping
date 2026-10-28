#!/usr/bin/env python3
"""Unit and integration checks for NJ Flock filtering."""
import importlib.machinery
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('build_geojsonseq')
loader = importlib.machinery.SourceFileLoader('build_geojsonseq', str(SCRIPT))
spec = importlib.util.spec_from_loader(loader.name, loader)
extractor = importlib.util.module_from_spec(spec)
loader.exec_module(extractor)


class NJFilteringTest(unittest.TestCase):
    def test_polygons_and_holes(self):
        boundary = [[
            [[-75, 40], [-74, 40], [-74, 41], [-75, 41], [-75, 40]],
            [[-74.8, 40.2], [-74.7, 40.2], [-74.7, 40.3], [-74.8, 40.3], [-74.8, 40.2]],
        ]]
        self.assertTrue(extractor.in_nj(-74.5, 40.5, boundary))
        self.assertFalse(extractor.in_nj(-73.5, 40.5, boundary))
        self.assertFalse(extractor.in_nj(-74.75, 40.25, boundary))

    def test_pipeline(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            ring = [[-75, 40], [-74, 40], [-74, 41], [-75, 41], [-75, 40]]
            (base / 'boundary.geojson').write_text(json.dumps({
                'type': 'FeatureCollection', 'features': [
                    {'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring]}, 'properties': {}}
                ]
            }))
            records = [
                (-74.5, 40.5, 'inService'),
                (-74.6, 40.6, 'inPlanning'),
                (-74.7, 40.7, 'decommissioned'),
                (-73.5, 40.5, 'inService'),
            ]
            (base / 'features_0.json').write_text(json.dumps({'features': [
                {'geometry': {'x': lon, 'y': lat},
                 'attributes': {'id': i, 'status': status,
                                'rotationAngle': [0, 90, 180, 270][i]}}
                for i, (lon, lat, status) in enumerate(records)
            ]}))
            output = base / 'out.geojsonseq'
            proc = subprocess.run([sys.executable, str(SCRIPT), str(base),
                                   '--nj-boundary', str(base / 'boundary.geojson'),
                                   '-o', str(output)],
                                  capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            actual = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual({x['properties']['status'] for x in actual},
                             {'inService', 'inPlanning'})
            self.assertEqual(len(actual), 2)
            self.assertEqual([x["properties"]["camera_type"] for x in actual], ["flock", "flock"])
            self.assertEqual([x["properties"]["camera_bearing"] for x in actual], [0.0, 90.0])
            self.assertIn('min=0.0, max=90.0, negative=0, above_360=0', proc.stderr)
            self.assertIn('1 outside NJ', proc.stderr)
            self.assertIn('1 decommissioned excluded', proc.stderr)

    def test_missing_boundary_fails(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            (base / 'features_0.json').write_text(json.dumps({'features': []}))
            (base / 'boundary.geojson').write_text('{"type":"FeatureCollection","features":[]}')
            proc = subprocess.run([sys.executable, str(SCRIPT), str(base),
                                   '--nj-boundary', str(base / 'boundary.geojson'),
                                   '-o', str(base / 'out')],
                                  capture_output=True, text=True)
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn('Missing NJ state-boundary polygon', proc.stderr)


if __name__ == '__main__':
    unittest.main()
