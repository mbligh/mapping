# Overture NJ buildings experiment

The [official Overture Maps Python CLI](https://docs.overturemaps.org/getting-data/overturemaps-py/) downloads the `building` feature type from Overture's current STAC release for a rectangle covering New Jersey (`-75.57,38.90,-73.88,41.37`).

`scripts/build_overture_nj_buildings` creates:

- `nj_overture_buildings.geojsonseq.gz`: the native, unmodified features, including Overture IDs and provenance fields where present.
- `nj_overture_buildings.pmtiles`: an independent vector-tile layer called `buildings`, with zoom levels 0–13 to match the T.REX feature archive's requested maxzoom.
- `nj_overture_buildings.manifest.json`: source version at extraction start, bounding box, record count, checksums.

The **Build Overture NJ buildings** workflow builds and retains versioned GitHub releases. The source release asset and T.REX extraction remain completely independent. A rectangle is intentionally used for efficient extraction; it includes parts of neighboring states. No geometry is altered, deduplicated, or clipped to the state line.

To build locally, install `overturemaps`, `tippecanoe` and `jq`, then run `bash scripts/build_overture_nj_buildings dist`.

**Comparison caveats:** the T.REX dataset is decoded from z13 MVT tiles and can have clipped, duplicated or simplified polygons. Overture GeoJSONSeq retains the full geometry and source fields. A raw count comparison is not a one-to-one building count. Identify matches geometrically and track T.REX's uncertainty about its original sources.

**Distribution:** Overture publishes data under its [data licenses](https://docs.overturemaps.org/attribution/); preserve attribution and underlying source requirements. Release assets are experiments, not yet published as part of the mapping web map. GitHub Release download URLs may not provide suitable HTTP range behavior for live PMTiles; host the tiles on an R2/public HTTP range endpoint before connecting them to MapLibre.
