// Dependency-free style regression tests; run with Node from GitHub Actions.
import assert from 'node:assert/strict';
import {
  cameraColors, cameraColorExpression, cameraBearingExpression,
  directionalFlockFilter, cameraTitle, installSurveillanceMarkers,
  surveillanceLayerIds, setSurveillanceVisibility
} from '../../public/surveillance/markers.mjs';

assert.deepEqual(surveillanceLayerIds('camera'), ['camera-points', 'camera-fov']);
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
assert.deepEqual(installSurveillanceMarkers(map,{source:'test',prefix:'camera'}),['camera-points','camera-fov']);
assert.equal(map.images.size,1);
assert.equal(map.images.get('camera-field-of-view').options.pixelRatio,2);
assert.equal(map.layers.get('camera-fov').layout['icon-rotation-alignment'],'map');
assert.deepEqual(map.layers.get('camera-fov').layout['icon-rotate'],cameraBearingExpression);
assert.deepEqual(map.layers.get('camera-fov').filter,directionalFlockFilter);
assert.deepEqual(map.layers.get('camera-points').paint['circle-color'],cameraColorExpression);
assert.deepEqual(map.layers.get('camera-points').filter,['!',directionalFlockFilter]);
installSurveillanceMarkers(map,{source:'test',prefix:'camera'});
assert.equal(map.images.size,1);
assert.equal(map.layers.size,2);
setSurveillanceVisibility(map,'camera',false);
assert.equal(map.layers.get('camera-fov').layout.visibility,'none');
assert.equal(map.layers.get('camera-points').layout.visibility,'none');
setSurveillanceVisibility(map,'camera',true);
assert.equal(map.layers.get('camera-fov').layout.visibility,'visible');
console.log('Surveillance marker style tests passed');
