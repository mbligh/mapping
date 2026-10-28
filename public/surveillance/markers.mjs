// Shared surveillance styling for the MapLibre demo and the standalone map.
// Flock rotationAngle is provisionally interpreted as a clockwise bearing from north.
export const cameraColors = Object.freeze({
  red_light: '#e53935',
  speed: '#eab308',
  flock: '#2563eb',
  surveillance: '#16a34a',
});

// The server supplies camera_type on newly built tiles. Test legacy tags too so
// older PMTiles archives retain the intended colours during a rolling publish.
export const cameraColorExpression = [
  'case',
  ['==', ['get', 'source'], 'Flock'], cameraColors.flock,
  ['any',
    ['==', ['get', 'camera_type'], 'red_light'],
    ['==', ['get', 'highway'], 'red_light_camera'],
    ['==', ['get', 'surveillance'], 'red_light'],
    ['==', ['get', 'enforcement'], 'traffic_signals'],
  ], cameraColors.red_light,
  ['any',
    ['==', ['get', 'camera_type'], 'speed'],
    ['==', ['get', 'highway'], 'speed_camera'],
    ['==', ['get', 'enforcement'], 'maxspeed'],
    ['==', ['get', 'enforcement'], 'average_speed'],
  ], cameraColors.speed,
  cameraColors.surveillance,
];

// camera_bearing is the original angle normalized to [0,360); old tiles use
// rotationAngle directly. For this reversible display trial, interpret source
// rotation as an Esri *arithmetic* angle (0=east, 90=north, counterclockwise).
// MapLibre icon-rotate expects a clockwise compass bearing (0=north).
// A missing/invalid angle must not become a north-facing wedge.
export const cameraBearingExpression = [
  'to-number', ['coalesce', ['get', 'camera_bearing'], ['get', 'rotationAngle']], -1
];
export const cameraDisplayRotationExpression = ['-', 90, cameraBearingExpression];
export const directionalFlockFilter = [
  'all',
  ['==', ['get', 'source'], 'Flock'],
  ['>=', cameraBearingExpression, 0],
  ['<=', cameraBearingExpression, 360],
];

// Draw at 2x so the curved wedge and camera dot remain crisp. Camera coordinate
// is the image centre (32,32); the wedge widens towards the top (north).
function fieldOfViewIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable for camera markers');
  ctx.scale(2, 2);
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(19, 8);
  ctx.quadraticCurveTo(32, 1, 45, 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(37,99,235,0.34)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(37,99,235,0.95)';
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 32, 4.4, 0, Math.PI * 2);
  ctx.fillStyle = cameraColors.flock;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  return ctx.getImageData(0, 0, 128, 128);
}

export function surveillanceLayerIds(prefix) {
  return [prefix + '-points', prefix + '-fov'];
}

export function installSurveillanceMarkers(map, {source, prefix, sourceLayer = 'surveillance'}) {
  const [points, fov] = surveillanceLayerIds(prefix);
  const iconId = prefix + '-field-of-view';
  if (!map.hasImage(iconId)) map.addImage(iconId, fieldOfViewIcon(), {pixelRatio: 2});
  if (!map.getLayer(points)) map.addLayer({
    id: points, type: 'circle', source, 'source-layer': sourceLayer,
    minzoom: 8,
    filter: ['!', directionalFlockFilter],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 5, 16, 7],
      'circle-color': cameraColorExpression,
      'circle-opacity': 0.92,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    }
  });
  if (!map.getLayer(fov)) map.addLayer({
    id: fov, type: 'symbol', source, 'source-layer': sourceLayer,
    minzoom: 8,
    filter: directionalFlockFilter,
    layout: {
      'icon-image': iconId,
      'icon-rotate': cameraDisplayRotationExpression,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.65, 12, 0.9, 16, 1.15],
    }
  });
  return [points, fov];
}

export function setSurveillanceVisibility(map, prefix, visible) {
  for (const id of surveillanceLayerIds(prefix))
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function cameraTitle(properties = {}) {
  if (properties.camera_type === 'red_light' ||
      properties.highway === 'red_light_camera' ||
      properties.surveillance === 'red_light' ||
      properties.enforcement === 'traffic_signals') return 'Red-light enforcement camera';
  if (properties.camera_type === 'speed' ||
      properties.highway === 'speed_camera' ||
      properties.enforcement === 'maxspeed' ||
      properties.enforcement === 'average_speed') return 'Speed enforcement camera';
  return properties.camera_title || (properties.source === 'Flock'
    ? 'Flock Surveillance camera' : 'OSM surveillance camera');
}
