# Surveillance map data

## Requirements
- Publish a static, MapLibre-compatible PMTiles dataset combining the Flock Safety ArcGIS JSON snapshot with weekly NJ OSM surveillance camera data.
- Preserve device identifiers, names, coordinates, deployment status, device type, capabilities, and orientation.
- Retain all valid geographic records; no filtering by ALPR capability or status.
- Avoid requiring a database or live tile server.
- Rebuild automatically when source JSON or build scripts change; allow manual rebuilds.

## Implementation
- `scripts/build_geojsonseq` streams `features_*.json` files and emits newline-delimited GeoJSON features.
- GitHub Actions installs Tippecanoe, converts OSM camera geometries to points, generates one `surveillance.pmtiles` archive with source-layer `surveillance`, and publishes a checksum-verified surveillance dataset release. The shared mapping Pages publisher deploys the archive at `/surveillance.pmtiles` and the example at `/surveillance/`.
- Both converters add `source` and `camera_title` properties. Flock popups say “Flock Surveillance camera”; OSM popups say “OSM surveillance camera”. Original attributes and overlapping records are retained.
- The map uses a single Surveillance checkbox and the existing Flock red-dot style for both sources.
- MapLibre uses the PMTiles protocol to fetch only byte ranges for visible tiles.
- The workflow searches only `surveillance/flocksurveillance/`; the converter accepts any explicit source directory.
- Tile archive is a build artifact, not committed to Git.
- At zoom levels below 8 the map intentionally does not display individual devices. Higher zooms retain all features without Tippecanoe feature dropping.

## Limitations
- This is a historical snapshot, not a live inventory.
- `rotationAngle` is preserved as-is; its orientation convention has not been validated.
- GitHub Pages must be configured to use **GitHub Actions** as the publishing source.
- Verify HTTP Range support on the published PMTiles URL before production use.
