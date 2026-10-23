#!/usr/bin/env python3
"""Convert osmium-exported GeoJSON sequence to camera points for Tippecanoe."""
import json
import sys

def points(coords):
    if isinstance(coords, list):
        if len(coords) >= 2 and all(isinstance(v, (int, float)) for v in coords[:2]):
            yield coords[:2]
        else:
            for item in coords:
                yield from points(item)

count = 0
with open(sys.argv[1], encoding="utf-8") as source, open(sys.argv[2], "w", encoding="utf-8") as target:
    for line in source:
        if not line.strip():
            continue
        feature = json.loads(line.strip().lstrip("\x1e"))
        geometry = feature.get("geometry") or {}
        coords = list(points(geometry.get("coordinates", [])))
        if not coords:
            continue
        if geometry.get("type") == "Point":
            location = coords[0]
        else:
            location = [sum(c[i] for c in coords) / len(coords) for i in (0, 1)]
        props = feature.get("properties") or {}
        props["source"] = "OSM"
        props["camera_title"] = "OSM surveillance camera"
        feature["geometry"] = {"type": "Point", "coordinates": location}
        feature["properties"] = props
        target.write(json.dumps(feature, separators=(",", ":")) + "\n")
        count += 1
print(f"Exported {count} OSM camera features")
