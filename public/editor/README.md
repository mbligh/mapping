# GeoJSON editor

Open https://mapping.mbligh.org/editor/ to edit multiple independent GeoJSON layers on one map.

## Layers and source files

- **New layer** adds a blank GeoJSON FeatureCollection. **Open layer** adds a local GeoJSON/KML/KMZ file without replacing the other layers. **Open URL** adds another layer from a CORS-enabled GeoJSON/KML/KMZ URL or Google My Maps KML export.
- Select a layer in the **Layers** list to edit it. Its features are editable; the other visible layers are overlaid in blue as read-only map references. Each layer has its own FeatureCollection, metadata, feature IDs, filename, optional file handle or source URL, and unsaved-change status (an asterisk in the list).
- **Show selected layer** can be unchecked when there are at least two layers. The editor switches to another layer and hides the former one. Selecting a hidden layer shows it again for editing.
- **Remove layer** removes only that layer, confirming first if it has unsaved changes. The other loaded layers stay intact.
- **Save layer** saves only the selected layer to its associated local file, and **Save layer as** chooses a new local file. URL imports cannot be written to their remote sources, so they save to local GeoJSON copies. Separate layers are **not** merged into a single file.
- Layer membership and visibility are session-local editor state. Reopen source files on your next visit; no server-side layer collection or browser autosave is provided.

## Editing

- **Add point** places markers. **Draw trail** creates a LineString: click vertices and press Enter to finish. Escape cancels an unfinished drawing.
- **Select / move** selects features and moves points. Select trails to move vertices, insert vertices by dragging midpoints, or delete vertices through the selection tool. The feature list selects features in the active layer.
- Edit names/descriptions or use **All properties** for arbitrary JSON properties. Individual layer styling is not yet configurable.

Direct writes require File System Access pickers (desktop Chrome/Edge over HTTPS or localhost). Other browsers use a file input and **Download** for each layer; they cannot overwrite local files automatically. The editor does not publish changes into the GitHub repository. To publish a changed overlay, commit its saved GeoJSON under `public/` separately.

The editor accepts Point and LineString features with 2D longitude/latitude positions. Unsupported geometries, 3D coordinates and malformed imports are rejected without removing existing layers. Feature IDs, arbitrary properties (including null), and collection/feature foreign members survive save round trips; stale bounding boxes are omitted. Editor IDs and temporary drawing flags are not written into user properties. Routing, undo/history and shared editing are outside this version.

## Basemap configuration

Edit `basemaps.json` to set `center`, `zoom`, `defaultBasemap`, and `basemaps`. Each entry has an `id`, `name`, and either a `style` URL to MapLibre style JSON (with CORS permitted) or raster XYZ `tiles` with optional `tileSize` and `attribution`.

Basemap changes preserve all layer contents, including unsaved edits in both active and inactive layers. Finish or cancel any unfinished trail before switching basemaps; saving first is not required.

## Checks

Run `node --test public/editor/test-model.mjs` for model validation. The Pages workflow runs `test-browser.cjs` in Chromium using pinned MapLibre/Terra Draw libraries, offline basemaps, and mocked file handles. The browser checks include independent layer saves, switching, visibility, removal, basemap restoration, drawing, and import failure isolation.
