/** Configured point overlays. File URLs are relative to the configuration file. */
export async function initGeoSources(map, maplibregl, container, configUrl) {
  const groups = [];
  let styleReady = map.isStyleLoaded();
  const document = container.ownerDocument;
  const message = text => {
    const node = document.createElement('div');
    node.className = 'hint';
    node.setAttribute('role', 'status');
    node.textContent = text;
    container.append(node);
    return node;
  };
  // Image registration belongs to the current map style; reload after setStyle().
  let styleGeneration = 0;
  async function loadIcon(group, item) {
    if (item.iconLoading) return;
    const generation = styleGeneration;
    item.iconLoading = true;
    try {
      const image = await map.loadImage(item.icon.url);
      if (generation !== styleGeneration || !group.check.checked) return;
      const width = image.data.width;
      if (!width) throw new Error('Icon has no image width');
      if (!map.hasImage(item.iconId)) map.addImage(item.iconId, image.data);
      item.iconScale = item.icon.size / width;
      install(group);
    } catch (error) {
      if (generation === styleGeneration) {
        group.status.textContent = `${group.name}: icon load failed: ${error.message}`;
      }
    } finally {
      item.iconLoading = false;
    }
  }
  function install(group) {
    if (!styleReady) return;
    group.status.textContent = '';
    for (const item of group.items) {
      try {
        if (group.check.checked && !map.getSource(item.id)) {
          map.addSource(item.id, {type: 'geojson', data: item.url});
        }
        if (group.check.checked && item.icon && !map.hasImage(item.iconId)) {
          loadIcon(group, item);
          continue;
        }
        if (group.check.checked && !map.getLayer(item.id)) {
          map.addLayer({...item.style, id: item.id, source: item.id,
            layout: {...item.style.layout,
              ...(item.icon ? {
                'icon-image': item.iconId,
                'icon-size': item.iconScale,
                'icon-allow-overlap': true
              } : {}),
              visibility: 'visible'}});
        }
        if (group.check.checked && item.label && !map.getLayer(item.id + '-label')) {
          map.addLayer({
            id: item.id + '-label',
            type: 'symbol',
            source: item.id,
            minzoom: item.label.minzoom ?? 13,
            layout: {
              'text-field': ['to-string', ['coalesce', ['get', item.label.field], '']],
              'text-size': item.label.size ?? 12,
              'text-anchor': 'bottom',
              'text-offset': [0, -0.8],
              'text-allow-overlap': false,
              'text-optional': true
            },
            paint: {
              'text-color': '#222222',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
            }
          });
        }
        for (const layerId of [item.id, item.id + '-label']) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', group.check.checked ? 'visible' : 'none');
          }
        }
      } catch (error) {
        group.status.textContent = `${group.name}: ${error.message}`;
      }
    }
  }
  map.on('style.load', () => {
    styleGeneration++;
    styleReady = true;
    groups.forEach(install);
  });
  map.on('error', event => {
    for (const group of groups) {
      if (group.items.some(item => item.id === event.sourceId)) {
        group.status.textContent = `${group.name}: ${event.error?.message || 'Unable to load GeoJSON'}`;
      }
    }
  });
  try {
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    if (!Array.isArray(config)) throw new Error('Expected a list of layers');
    config.forEach((entry, groupIndex) => {
      try {
        const name = entry?.name ?? entry?.layer;
        if (typeof name !== 'string' || !name.trim()) throw new Error('Layer needs a name');
        if (!Array.isArray(entry.data) || !entry.data.length) throw new Error(`${name}: data must be a non-empty list`);
        const items = entry.data.map((data, dataIndex) => {
          if (typeof data?.file !== 'string' || !data.file.trim()) throw new Error(`${name}: each dataset needs a file`);
          const url = new URL(data.file, configUrl);
          if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`${name}: unsupported file URL`);
          const type = data.type ?? 'circle';
          if (!['circle', 'symbol'].includes(type)) throw new Error(`${name}: point type must be circle or symbol`);
          const icon = data.icon;
          if (icon !== undefined) {
            if (!icon || typeof icon !== 'object' || Array.isArray(icon) ||
                typeof icon.url !== 'string' || !icon.url.trim()) {
              throw new Error(`${name}: icon.url must be a non-empty URL`);
            }
            if (icon.size !== undefined && (!Number.isFinite(icon.size) || icon.size <= 0)) {
              throw new Error(`${name}: icon.size must be positive`);
            }
            if (type !== 'symbol') throw new Error(`${name}: icon requires type "symbol"`);
          }
          const style = {type};
          for (const key of ['paint', 'layout', 'filter', 'minzoom', 'maxzoom']) {
            if (data[key] !== undefined) style[key] = data[key];
          }
          const label = data.label;
          if (label !== undefined) {
            if (!label || typeof label !== 'object' || Array.isArray(label) ||
                typeof label.field !== 'string' || !label.field.trim()) {
              throw new Error(`${name}: label.field must be a non-empty property name`);
            }
            if (label.minzoom !== undefined && (!Number.isFinite(label.minzoom) || label.minzoom < 0 || label.minzoom > 24)) {
              throw new Error(`${name}: label.minzoom must be between 0 and 24`);
            }
            if (label.size !== undefined && (!Number.isFinite(label.size) || label.size <= 0)) {
              throw new Error(`${name}: label.size must be positive`);
            }
          }
          const id = `geosources-${groupIndex}-${dataIndex}`;
          const iconUrl = icon ? new URL(icon.url, configUrl) : null;
          if (iconUrl && !['https:', 'http:'].includes(iconUrl.protocol)) {
            throw new Error(`${name}: unsupported icon URL`);
          }
          return {id, url: url.href, style, label,
            icon: iconUrl ? {url: iconUrl.href, size: icon.size ?? 20} : null,
            iconId: id + '-icon'};
        });
        const label = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.id = `geosources-toggle-${groupIndex}`;
        label.append(check, document.createTextNode(` ${name}`));
        container.append(label);
        const group = {name, items, check, status: message('')};
        groups.push(group);
        check.addEventListener('change', () => install(group));
        for (const item of items) {
          map.on('click', item.id, event => {
            if (!check.checked || !event.features?.length) return;
            const content = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = name;
            content.append(title);
            for (const [key, value] of Object.entries(event.features[0].properties || {})) {
              if (value == null) continue;
              const row = document.createElement('div');
              row.textContent = `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
              content.append(row);
            }
            new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(content).addTo(map);
          });
          map.on('mouseenter', item.id, () => { if (check.checked) map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', item.id, () => { map.getCanvas().style.cursor = ''; });
        }
        install(group);
      } catch (error) {
        message(`Configured layer ${groupIndex + 1}: ${error.message}`);
      }
    });
  } catch (error) {
    message(`Unable to load layer configuration: ${error.message}`);
  }
}
