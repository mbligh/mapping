# T.REX NJ building experiment

The existing [trex-extracts](https://github.com/mbligh/mapping/releases/tag/trex-extracts) release contains `nj_features.pmtiles`, a geographic subset of T.REX's North America feature archive. The published map style names its building footprint source-layer `buildings`.

Run the manually dispatched **Extract T.REX NJ buildings** GitHub Actions workflow to download that existing archive, decode only the z13 `buildings` layer, and publish `nj_buildings.geojson.gz` and a count summary to the `trex-buildings-nj` experimental release.

Locally:

```sh
sudo apt install tippecanoe
sh scripts/extract_trex_buildings nj_features.pmtiles nj_buildings.geojson.gz
```

The `pmtiles` CLI alone cannot selectively decode a named MVT layer. The decoder is `tippecanoe-decode`, provided by Tippecanoe.

This is a **raw extraction**, not a canonical building dataset. MVT tiles can clip polygons at boundaries, repeat features, omit source attributes, and simplify geometry. Duplicate and fragmented geometries must be resolved before conflating with OSM/Overture footprints. Data reuse and redistribution terms should be checked before public publication.
