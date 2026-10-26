# Surveillance tiles

Historical Flock Safety device locations and weekly New Jersey OpenStreetMap surveillance cameras combined into one MapLibre-compatible PMTiles archive.

The [GitHub Pages site](https://mapping.mbligh.org/surveillance/) displays the resulting tiles. The archive is published at [surveillance.pmtiles](https://mapping.mbligh.org/surveillance.pmtiles).

## Build

The GitHub Actions workflow builds a versioned release on changes to source JSON or the pipeline, and can also be run manually.

The workflow lives at `../.github/workflows/surveillance.yml`. The shared **Publish mapping pages** workflow deploys the release and `../public/surveillance/index.html`. Optional R2 uploads use mapping repository variables `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL` and secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; GitHub does not transfer repository settings or secrets during a Git merge.

The build searches recursively for `features_0.json`, `features_10000.json`, etc. It retains all device types and statuses, including planned and decommissioned devices. Flock records are historical, not live. OSM data is refreshed weekly from Geofabrik. Each point preserves its original attributes plus `source` and `camera_title`; overlapping records are retained.

MapLibre integration:

```javascript
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
map.addSource('surveillance', {
  type: 'vector',
  url: 'pmtiles://https://mapping.mbligh.org/surveillance.pmtiles'
});
// source-layer: 'surveillance'
```

See [project.md](project.md) for requirements and architecture.

Set `R2_PUBLIC_URL` to the public bucket base URL to serve surveillance tiles from R2 in both maps. Otherwise both use the mapping Pages archive.
