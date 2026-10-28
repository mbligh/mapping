# Surveillance tiles

Historical Flock Safety device locations and weekly New Jersey OpenStreetMap surveillance cameras combined into one MapLibre-compatible PMTiles archive.

The [GitHub Pages site](https://mapping.mbligh.org/surveillance/) displays the resulting tiles. The archive is published at [surveillance.pmtiles](https://mapping.mbligh.org/surveillance.pmtiles).

## Build

The GitHub Actions workflow builds a versioned release on changes to source JSON or the pipeline, and can also be run manually.

The workflow lives at `../.github/workflows/surveillance.yml`. The shared **Publish mapping pages** workflow deploys the release and `../public/surveillance/index.html`. Optional R2 uploads use mapping repository variables `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL` and secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; GitHub does not transfer repository settings or secrets during a Git merge.

The build searches recursively for `features_0.json`, `features_10000.json`, etc. It retains planned and active NJ devices, but excludes decommissioned devices and locations outside NJ. Flock records are historical, not live. OSM data is refreshed weekly from the retained Geofabrik NJ extract. Each point preserves relevant original attributes plus `source`, `camera_type`, and `camera_title`; overlapping records are retained.

## Map markers

- **Blue:** Flock cameras. For the reversible orientation trial, `rotationAngle` is interpreted as an ArcGIS arithmetic angle (0° east, increasing counterclockwise), and the displayed clockwise compass bearing is `(90 - angle) mod 360`. The source's exact angle convention is unverified. A translucent curved viewing cone has its dot at the actual camera location. When no valid angle exists, display a dot only. This orientation convention has not been validated on site.
- **Yellow:** OSM speed cameras (`highway=speed_camera` or explicitly speed-related `enforcement=*`).
- **Red:** OSM red-light cameras (`highway=red_light_camera`, `surveillance=red_light`, or explicit `enforcement=traffic_signals`). Ordinary traffic signals alone are never treated as red-light cameras.
- **Green:** Other OSM surveillance locations.

The MapLibre demo and standalone surveillance map share `public/surveillance/markers.mjs`, one PMTiles source, and click popups for both dots and wedges. The build normalizes valid Flock rotations into `camera_bearing` without overwriting the original `rotationAngle`. Missing/non-numeric rotations remain directionless. The Flock extraction step logs raw source angle minimum, maximum, missing/invalid count, and values outside 0–360 for diagnostic review. OSM enforcement *relations* without an exported device geometry may not appear; relation-member extraction would be a separate improvement.

The map marker tests run with `node surveillance/scripts/test_markers.mjs`. Camera classification tests run in the surveillance GitHub workflow.

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
