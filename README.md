# Surveillance tiles

Historical Flock Safety device locations converted from ArcGIS JSON to MapLibre-compatible PMTiles.

The [GitHub Pages site](https://mbligh.github.io/surveillance/) displays the resulting tiles. The archive is published at [flock.pmtiles](https://mbligh.github.io/surveillance/flock.pmtiles).

## Build

The GitHub Actions workflow builds and deploys on changes to source JSON or the pipeline, and can also be run manually.

**Repository setting required:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

The build searches recursively for `features_0.json`, `features_10000.json`, etc. It retains all device types and statuses, including planned and decommissioned devices. The records are historical, not live.

MapLibre integration:

```javascript
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
map.addSource('flock', {
  type: 'vector',
  url: 'pmtiles://https://mbligh.github.io/surveillance/flock.pmtiles'
});
// source-layer: 'flock'
```

See [project.md](project.md) for requirements and architecture.
