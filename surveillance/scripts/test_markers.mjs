// Dependency-free style regression tests; run with Node from GitHub Actions.
import assert from 'node:assert/strict';
import {
  cameraColors, cameraColorExpression, cameraBearingExpression, cameraDisplayRotationExpression,
  directionalFlockFilter, cameraTitle, installSurveillanceMarkers,
  surveillanceLayerIds, setSurveillanceVisibility
} from '../../public/surveillance/markers.mjs';

assert.deepEqual(surveillanceLayerIds('camera'), ['camera-points', 'camera-flock-dots', 'camera-fov']);
assert.equal(cameraColors.red_light, '#e53935');
assert.equal(cameraColors.speed, '#eab308');
assert.equal(cameraColors.flock, '#2563eb');
assert.equal(cameraColors.surveillance, '#16a34a');
assert.equal(cameraTitle({highway:'speed_camera'}), 'Speed enforcement camera');
assert.equal(cameraTitle({highway:'red_light_camera'}), 'Red-light enforcement camera');
assert.equal(cameraTitle({source:'Flock'}), 'Flock Surveillance camera');

const strokes=[];
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    return {width:0, height:0, getContext(type) {
      assert.equal(type,'2d');
      return {
        scale(){}, beginPath(){}, moveTo(){}, lineTo(){}, quadraticCurveTo(){},
        closePath(){}, fill(){}, stroke(){}, arc(){},
        getImageData(x,y,w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
      };
    }};
  }
};
const map = {
  images: new Map(), layers: new Map(),
  hasImage(id){return this.images.has(id);},
  addImage(id,img,options){this.images.set(id,{img,options});},
  getLayer(id){return this.layers.get(id);},
  addLayer(layer){this.layers.set(layer.id,layer);},
  setLayoutProperty(id,key,value){
    const layer=this.layers.get(id);
    layer.layout ??= {};
    layer.layout[key]=value;
  }
};
assert.deepEqual(installSurveillanceMarkers(map,{source:'test',prefix:'camera'}),['camera-points','camera-flock-dots','camera-fov']);
assert.equal(map.images.size,1);
assert.equal(map.images.get('camera-field-of-view').options.pixelRatio,2);
assert.equal(map.layers.get('camera-fov').layout['icon-rotation-alignment'],'map');
assert.deepEqual(cameraDisplayRotationExpression, ['-', 90, cameraBearingExpression]);
assert.deepEqual(map.layers.get('camera-fov').layout['icon-rotate'],cameraDisplayRotationExpression);
assert.deepEqual(map.layers.get('camera-fov').filter,directionalFlockFilter);
assert.deepEqual(map.layers.get('camera-points').paint['circle-color'],cameraColorExpression);
assert.deepEqual(map.layers.get('camera-points').filter,['!',directionalFlockFilter]);
const dots=map.layers.get('camera-flock-dots');
const fov=map.layers.get('camera-fov');
assert.equal(dots.type,'circle');
assert.equal(dots.minzoom,8);
assert.equal(dots.maxzoom,12);
assert.deepEqual(dots.filter,directionalFlockFilter);
assert.deepEqual(dots.paint,map.layers.get('camera-points').paint);
assert.equal(fov.minzoom,12);
assert.deepEqual(fov.layout['icon-size'],
  ['interpolate',['linear'],['zoom'],12,0.45,15,0.54375,16,1.15]);
// The wedge remains half the previous zoom-based size at integer levels
// 12 through 15, and is back to full size at 16.
function iconSize(zoom) {
  const expression=fov.layout['icon-size'];
  const stops=expression.slice(3);
  for(let i=0;i<stops.length-2;i+=2) {
    const [a,va,b,vb]=stops.slice(i,i+4);
    if(zoom<=b) return va+(vb-va)*(zoom-a)/(b-a);
  }
  return stops.at(-1);
}
for(const z of [12,13,14,15]){
  const original=0.9+(z-12)*(1.15-0.9)/4;
  assert.ok(Math.abs(iconSize(z)-original/2)<1e-10);
}
assert.equal(iconSize(16),1.15);
installSurveillanceMarkers(map,{source:'test',prefix:'camera'});
assert.equal(map.images.size,1);
assert.equal(map.layers.size,3);
setSurveillanceVisibility(map,'camera',false);
for(const layer of surveillanceLayerIds('camera')) {
  assert.equal(map.layers.get(layer).layout.visibility,'none');
}
setSurveillanceVisibility(map,'camera',true);
for(const layer of surveillanceLayerIds('camera')) {
  assert.equal(map.layers.get(layer).layout.visibility,'visible');
}
console.log('Surveillance marker style tests passed');
