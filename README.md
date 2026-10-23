# Surveillance tiles

Historical Flock Safety device locations and weekly New Jersey OpenStreetMap surveillance cameras combined into one MapLibre-compatible PMTiles archive.

The [GitHub Pages site](https://mbligh.github.io/surveillance/) displays the resulting tiles. The archive is published at [surveillance.pmtiles](https://mbligh.github.io/surveillance/surveillance.pmtiles).

## Build

The GitHub Actions workflow builds and deploys on changes to source JSON or the pipeline, and can also be run manually.

**Repository setting required:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

The build searches recursively for `features_0.json`, `features_10000.json`, etc. It retains all device types and statuses, including planned and decommissioned devices. Flock records are historical, not live. OSM data is refreshed weekly from Geofabrik. Each point preserves its original attributes plus `source` and `camera_title`; overlapping records are retained.

MapLibre integration:

```javascript
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
map.addSource('surveillance', {
  type: 'vector',
  url: 'pmtiles://https://mbligh.github.io/surveillance/surveillance.pmtiles'
});
// source-layer: 'surveillance'
```

See [project.md](project.md) for requirements and architecture.
