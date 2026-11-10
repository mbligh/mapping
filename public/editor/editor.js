import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {TerraDraw, TerraDrawPointMode, TerraDrawLineStringMode, TerraDrawSelectMode} from 'https://esm.sh/terra-draw@1.24.2';
import {TerraDrawMapLibreGLAdapter} from 'https://esm.sh/terra-draw-maplibre-gl-adapter@1.1.2';
import {readLayer, writeLayer, parseProperties} from './model.mjs';
import {myMapsURL, importGeoData} from './import.mjs';

const el = id => document.getElementById(id);
const supportsFiles = !!(window.showOpenFilePicker && window.showSaveFilePicker && window.isSecureContext);
let map, draw, selected, fileHandle, fileName = 'Untitled.geojson';
let metadata = {type:'FeatureCollection'}, records = new Map();
const layers = [];
let activeLayer, nextLayerId = 0;
const overlaySources = new Set();
let savedText = JSON.stringify({type:'FeatureCollection',features:[]});
let ready = false, suspended = false, busy = false, dirty = false;
let mode = 'select', styleRequest = 0;
function report(error) { if (error?.name !== 'AbortError') el('error').textContent = error?.message || String(error); }
function snapshot() { return draw ? draw.getSnapshot() : []; }
function layer() { return writeLayer(metadata, records, snapshot()); }
function layerData(item) { return writeLayer(item.metadata, item.records, item === activeLayer ? snapshot() : item.features); }
function layerDirty(item) { return JSON.stringify(layerData(item)) !== item.savedText; }
function syncActive() {
  if (!activeLayer) return;
  Object.assign(activeLayer, {metadata, records, features:geometryFeatures(), fileHandle, fileName, savedText});
}
function renderLayers() {
  const list = el('layers');
  list.replaceChildren(...layers.map(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = (item.visible ? '● ' : '○ ') + item.fileName + (layerDirty(item) ? ' *' : '');
    option.selected = item === activeLayer;
    return option;
  }));
  el('layer-visible').checked = activeLayer?.visible ?? false;
  // An active layer must stay visible so Terra Draw can edit its features.
  el('layer-visible').disabled = !activeLayer || layers.length < 2 || busy;
  el('remove-layer').disabled = !activeLayer || busy;
  el('source').textContent = activeLayer?.sourceUrl ? 'Source: ' + activeLayer.sourceUrl + ' (save locally)' : activeLayer ? 'Source: local GeoJSON file' : 'Open a file or create a layer.';
}
function renderOtherLayers() {
  // style.load fires before all raster tiles finish. The style is usable here.
  if (!map?.getStyle()?.layers) return;
  for (const id of overlaySources) {
    if (map.getLayer(id + '-points')) map.removeLayer(id + '-points');
    if (map.getLayer(id + '-trails')) map.removeLayer(id + '-trails');
    if (map.getSource(id)) map.removeSource(id);
  }
  overlaySources.clear();
  const before = map.getStyle().layers.find(item => /terra.?draw/i.test(item.id))?.id;
  for (const item of layers) {
    if (item === activeLayer || !item.visible) continue;
    const id = 'editor-source-' + item.id;
    map.addSource(id, {type:'geojson', data:layerData(item)});
    map.addLayer({id:id+'-trails',type:'line',source:id,filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#2678ad','line-width':3,'line-opacity':0.75}},before);
    map.addLayer({id:id+'-points',type:'circle',source:id,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#2678ad','circle-radius':5,'circle-stroke-color':'#ffffff','circle-stroke-width':1}},before);
    overlaySources.add(id);
  }
}
function geometryFeatures() { return snapshot().filter(f => ['point','linestring'].includes(f.properties?.mode) && !f.properties?.currentlyDrawing); }
function refresh() {
  if (suspended || !ready) return;
  syncActive();
  dirty = layers.some(layerDirty);
  dirty ||= snapshot().some(f => f.properties?.currentlyDrawing);
  el('filename').textContent = activeLayer ? fileName + (layerDirty(activeLayer) ? ' • Unsaved changes' : '') : 'No layer selected';
  renderLayers();
  const features = geometryFeatures();
  el('features').replaceChildren(...features.map(f => {
    const option = document.createElement('option'); option.value = f.id;
    const name = records.get(f.id)?.properties?.name;
    option.textContent = (typeof name === 'string' && name) || (f.geometry.type === 'Point' ? 'Unnamed point' : 'Unnamed trail');
    option.selected = f.id === selected; return option;
  }));
  if (!features.some(f => f.id === selected)) showSelection(undefined);
}
function showSelection(id) {
  selected = id;
  const feature = geometryFeatures().find(f => f.id === id);
  const props = feature ? records.get(id)?.properties ?? {} : {};
  for (const key of ['name','description','properties','apply-properties','delete']) el(key).disabled = !feature || busy;
  el('name').value = typeof props.name === 'string' ? props.name : '';
  el('description').value = typeof props.description === 'string' ? props.description : '';
  el('properties').value = feature ? JSON.stringify(records.get(id)?.properties ?? {}, null, 2) : '';
  el('features').value = id ?? '';
}
function recordFor(id) {
  if (!records.has(id)) records.set(id, {type:'Feature', id, properties:{}});
  return records.get(id);
}
function chooseMode(next) {
  draw.setMode(next); mode = next;
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === next));
  el('status').textContent = next === 'point' ? 'Click the map to add a point.' : next === 'linestring' ? 'Click vertices; press Enter to finish. Escape cancels.' : 'Select a feature to edit it.';
  refresh();
}
function setBusy(value) {
  busy = value;
  for (const id of ['new','open','open-url','basemap']) el(id).disabled = value || !ready;
  for (const id of ['save','save-as']) el(id).disabled = value || !ready || !activeLayer;
  el('tools').disabled = value || !ready || !activeLayer;
  el('layers').disabled = value || !ready || !layers.length;
  el('layer-visible').disabled = value || !ready || layers.length < 2 || !activeLayer;
  el('remove-layer').disabled = value || !ready || !activeLayer;
}
function checkFinished() {
  if (snapshot().some(f => f.properties?.currentlyDrawing)) throw new Error('Finish the current trail or press Escape before saving.');
}
function activateLayer(item) {
  if (!item || item === activeLayer) return;
  checkFinished();
  const previous = geometryFeatures();
  syncActive();
  suspended = true;
  try {
    // Validate before removing existing features, so a failed activation is safe.
    const result = draw.addFeatures(item.features);
    if (result.some(entry => !entry.valid)) throw new Error('Could not load the selected layer.');
    draw.setMode('select'); mode = 'select';
    if (previous.length) draw.removeFeatures(previous.map(f => f.id));
    activeLayer = item;
    ({metadata, records, fileHandle, fileName, savedText} = item);
    item.visible = true;
    selected = undefined;
  } catch (error) {
    const ids = new Set(item.features.map(f => f.id));
    const inserted = snapshot().filter(f => ids.has(f.id)).map(f => f.id);
    if (inserted.length) draw.removeFeatures(inserted);
    throw error;
  } finally { suspended = false; }
  renderOtherLayers();
  chooseMode('select'); showSelection(undefined); refresh();
  setBusy(false);
}
function discardActive() {
  if (activeLayer) {
    const ids = geometryFeatures().map(f => f.id);
    if (ids.length) draw.removeFeatures(ids);
  }
  activeLayer = undefined;
  metadata = {type:'FeatureCollection'}; records = new Map();
  fileHandle = undefined; fileName = 'Untitled.geojson';
  savedText = JSON.stringify({type:'FeatureCollection',features:[]});
  selected = undefined;
}
async function installLayer(data) {
  // Imports add independently backed layers, never overwrite an existing one.
  checkFinished();
  const next = readLayer(data);
  const previous = geometryFeatures();
  syncActive();
  suspended = true;
  try {
    const result = draw.addFeatures(next.features);
    const invalid = result.filter(entry => !entry.valid);
    if (invalid.length) throw new Error('The drawing library could not load this file: ' + invalid.map(v => v.reason || 'invalid geometry').join('; '));
    draw.setMode('select'); mode = 'select';
    if (previous.length) draw.removeFeatures(previous.map(f => f.id));
    const item = {
      id: String(++nextLayerId), metadata:next.metadata, records:next.records,
      features:next.features, fileHandle:undefined, fileName:'Untitled.geojson',
      sourceUrl:undefined, visible:true,
      savedText:JSON.stringify(writeLayer(next.metadata, next.records, geometryFeatures()))
    };
    layers.push(item); activeLayer = item;
    ({metadata, records, fileHandle, fileName, savedText} = item);
    selected = undefined;
  } catch (error) {
    const candidates = new Set(next.features.map(f => f.id));
    const inserted = snapshot().filter(f => candidates.has(f.id)).map(f => f.id);
    if (inserted.length) draw.removeFeatures(inserted);
    throw error;
  } finally { suspended = false; }
  renderOtherLayers();
  chooseMode('select'); showSelection(undefined); refresh(); setBusy(false);
  const points = geometryFeatures().flatMap(f => f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates);
  if (points.length) {
    const bounds = new maplibregl.LngLatBounds();
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, {padding:45, maxZoom:17, duration:0});
  }
}
async function openFile(file, handle) {
  const data = await importGeoData(new Uint8Array(await file.arrayBuffer()), file.name);
  await installLayer(data);
  fileHandle = /\.geojson$|\.json$/i.test(file.name) ? handle : undefined; fileName = /\.(kml|kmz)$/i.test(file.name) ? file.name.replace(/\.(kml|kmz)$/i, '.geojson') : file.name;
  activeLayer.fileHandle = fileHandle;
  activeLayer.fileName = fileName;
  refresh(); el('status').textContent = 'Opened layer ' + fileName;
}
async function save(asNew = false) {
  if (busy) return;
  el('error').textContent = '';
  try {
    checkFinished();
    // File picker must be invoked directly from this click, before asynchronous work.
    const data = layer(); const text = JSON.stringify(data, null, 2) + '\n';
    let handle = fileHandle;
    setBusy(true);
    if (supportsFiles) {
      if (!handle || asNew) handle = await window.showSaveFilePicker({suggestedName:fileName});
      const writable = await handle.createWritable();
      try { await writable.write(text); await writable.close(); }
      catch (error) { await writable.abort().catch(() => {}); throw error; }
      fileHandle = handle; fileName = handle.name;
      el('status').textContent = 'Saved ' + fileName;
    } else {
      const url = URL.createObjectURL(new Blob([text], {type:'application/geo+json'}));
      const link = document.createElement('a'); link.href = url; link.download = fileName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      el('status').textContent = 'Downloaded ' + fileName + '. Replace your original file with this copy.';
    }
    savedText = JSON.stringify(data); syncActive(); refresh();
  } catch (error) { report(error); }
  finally { setBusy(false); showSelection(selected); }
}
el('open-url').onclick = async () => {
  el('error').textContent = '';
  const raw = el('open-url-input').value.trim();
  if (!raw) { report(new Error('Enter a GeoJSON URL.')); return; }
  try {
    const url = myMapsURL(raw);
    setBusy(true);
    const response = await fetch(url.href);
    if (!response.ok) throw new Error('GeoJSON HTTP ' + response.status);
    const data = await importGeoData(new Uint8Array(await response.arrayBuffer()), url.pathname);
    await installLayer(data);
    fileHandle = undefined;
    fileName = decodeURIComponent(url.pathname.split('/').pop() || 'remote.geojson').replace(/\.(kml|kmz)$/i, '.geojson');
    if (url.pathname.endsWith('/kml')) fileName = 'mymaps.geojson';
    activeLayer.sourceUrl = url.href;
    activeLayer.fileName = fileName;
    refresh();
    el('status').textContent = 'Opened ' + url.href + ' (read-only source; Save downloads or saves a local copy).';
  } catch (error) { report(error); }
  finally { setBusy(false); }
};
el('open-url-input').onkeydown = event => {
  if (event.key === 'Enter') { event.preventDefault(); el('open-url').click(); }
};
el('save').onclick = () => save();
el('save-as').onclick = () => save(true);
el('new').onclick = async () => {
  try {
    await installLayer({type:'FeatureCollection',features:[]});
    fileHandle = undefined;
    fileName = layers.length === 1 ? 'Untitled.geojson' : 'Untitled-' + layers.length + '.geojson';
    activeLayer.fileName = fileName;
    refresh();
  } catch (error) { report(error); }
};
el('open').onclick = async () => {
  el('error').textContent = '';
  if (!supportsFiles) { el('file').value = ''; el('file').click(); return; }
  try { const [handle] = await window.showOpenFilePicker({multiple:false}); setBusy(true); await openFile(await handle.getFile(), handle); }
  catch (error) { report(error); }
  finally { setBusy(false); }
};
el('file').onchange = async event => {
  if (!event.target.files[0]) return;
  setBusy(true);
  try { await openFile(event.target.files[0], undefined); }
  catch (error) { report(error); }
  finally { setBusy(false); }
};
el('layers').onchange = event => {
  try { activateLayer(layers.find(item => item.id === event.target.value)); }
  catch (error) { report(error); renderLayers(); }
};
el('layer-visible').onchange = event => {
  if (!activeLayer) return;
  if (event.target.checked) { activeLayer.visible = true; refresh(); return; }
  const previous = activeLayer;
  const next = layers.find(item => item !== previous && item.visible) || layers.find(item => item !== previous);
  if (!next) {
    report(new Error('Create or open another layer before hiding the only layer.'));
    refresh(); return;
  }
  try {
    activateLayer(next);
    previous.visible = false;
    renderOtherLayers(); refresh();
    el('status').textContent = 'Hid ' + previous.fileName + '. Select it to show and edit it again.';
  } catch (error) { report(error); refresh(); }
};
el('remove-layer').onclick = () => {
  if (!activeLayer) return;
  const removed = activeLayer;
  if (layerDirty(removed) && !window.confirm('Discard unsaved changes to ' + removed.fileName + ' and remove the layer?')) return;
  try {
    checkFinished();
    const next = layers.find(item => item !== removed);
    if (next) activateLayer(next);
    else { suspended = true; discardActive(); suspended = false; }
    layers.splice(layers.indexOf(removed), 1);
    renderOtherLayers(); refresh(); setBusy(false);
    el('status').textContent = 'Removed ' + removed.fileName;
  } catch (error) { suspended = false; report(error); }
};
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => chooseMode(button.dataset.mode);
el('features').onchange = event => {
  const id = event.target.value;
  chooseMode('select'); draw.selectFeature(id); showSelection(id);
};
for (const key of ['name','description']) el(key).oninput = event => {
  if (selected === undefined) return;
  const record = recordFor(selected); record.properties ??= {};
  record.properties[key] = event.target.value;
  el('properties').value = JSON.stringify(record.properties, null, 2); refresh();
};
el('apply-properties').onclick = () => {
  try { if (selected === undefined) return; recordFor(selected).properties = parseProperties(el('properties').value); el('error').textContent = ''; showSelection(selected); refresh(); }
  catch (error) { report(error); }
};
el('delete').onclick = () => {
  if (selected === undefined) return;
  const id = selected; draw.removeFeatures([id]); records.delete(id); showSelection(undefined); refresh();
};
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
el('file-help').textContent = 'URL imports require the remote server to allow CORS. URL sources cannot be written back directly. ' + (supportsFiles
  ? 'Open multiple files. Each layer saves to its own file; URL layers save as local copies. Files stay on your device.'
  : 'Each layer downloads its own replacement copy. Use desktop Chrome or Edge over HTTPS to save back to local files.');
if (!supportsFiles) { el('save').textContent = 'Download'; el('save-as').hidden = true; }

async function boot() {
  const response = await fetch('./basemaps.json');
  if (!response.ok) throw new Error('Basemap configuration HTTP ' + response.status);
  const config = await response.json();
  if (!Array.isArray(config.basemaps) || !config.basemaps.length) throw new Error('basemaps.json needs at least one basemap.');
  map = new maplibregl.Map({container:'map', style:{version:8,sources:{},layers:[]}, center:config.center, zoom:config.zoom});
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({unit:'imperial'}));
  map.on('error', event => report(event.error || new Error('Map resource failed to load.')));
  const makeDraw = () => {
    const lineMode = new TerraDrawLineStringMode({pointerDistance:3, keyEvents:{finish:'Enter',cancel:'Escape'}});
    draw = new TerraDraw({adapter:new TerraDrawMapLibreGLAdapter({map, coordinatePrecision:17}), modes:[
      new TerraDrawPointMode(), lineMode,
      new TerraDrawSelectMode({pointerDistance:5, flags:{point:{feature:{draggable:true}}, linestring:{feature:{draggable:false,coordinates:{draggable:true,midpoints:{draggable:true},deletable:true}}}}})
    ]});
    draw.start();
    // Terra Draw treats clicks near its last vertex as a request to finish.
    // Disable that implicit completion; Enter is the only finish action.
    lineMode.closingPoints.isLineStringClosingPoint = () => ({isClosing:false});
    draw.setMode('select');
    draw.on('change', () => refresh());
    draw.on('select', id => { if (!suspended) showSelection(id); });
    draw.on('deselect', () => { if (!suspended) showSelection(undefined); });
    draw.on('finish', () => { refresh(); });
  };
  await new Promise(resolve => map.once('load', resolve));
  makeDraw();
  for (const base of config.basemaps) { const option = document.createElement('option'); option.value = base.id; option.textContent = base.name; el('basemap').append(option); }
  let activeBasemap;
  async function changeBasemap(id) {
    // Never tear down Terra Draw while it owns an unfinished line. Its
    // in-progress coordinates are not included in geometryFeatures().
    if (snapshot().some(f => f.properties?.currentlyDrawing)) {
      el('basemap').value = activeBasemap || id;
      report(new Error('Finish the current trail with Enter (or cancel with Escape) before changing basemaps.'));
      return;
    }
    // Basemap replacement recreates Terra Draw. Do not risk unsaved edits,
    // even if all currently drawn features are complete.
    refresh();
    if (dirty) {
      el('basemap').value = activeBasemap || id;
      report(new Error('Save or download your changes before changing basemaps. The current layer has not been replaced.'));
      return;
    }
    const request = ++styleRequest;
    el('error').textContent = '';
    try {
      const base = config.basemaps.find(b => b.id === id);
      let style;
      if (base.style) { const r = await fetch(base.style); if (!r.ok) throw new Error('Basemap HTTP ' + r.status); style = await r.json(); }
      else style = {version:8,sources:{basemap:{type:'raster',tiles:base.tiles,tileSize:base.tileSize || 256,attribution:base.attribution || ''}},layers:[{id:'basemap',type:'raster',source:'basemap'}]};
      if (request !== styleRequest) return;
      checkFinished();
      const features = geometryFeatures();
      setBusy(true); suspended = true; draw.stop(); ready = false;
      map.once('style.load', () => {
        try { makeDraw(); const results = draw.addFeatures(features); if (results.some(r => !r.valid)) throw new Error('Could not restore editable features after switching basemap.'); ready = true; suspended = false; activeBasemap = id; el('basemap').dataset.active = id; renderOtherLayers(); chooseMode(mode); refresh(); }
        catch (error) { report(error); }
        finally { setBusy(false); }
      });
      map.setStyle(style);
    } catch (error) { el('basemap').value = activeBasemap || id; report(error); }
  }
  ready = true; setBusy(false); refresh();
  el('basemap').onchange = event => changeBasemap(event.target.value);
  el('basemap').value = config.defaultBasemap || config.basemaps[0].id;
  await changeBasemap(el('basemap').value);
}
boot().catch(report);
