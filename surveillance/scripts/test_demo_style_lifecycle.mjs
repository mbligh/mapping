// Regression test for MapLibre style.load / isStyleLoaded readiness disagreement.
// Execute the real installSurveillance function with a small mock MapLibre map.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../public/maplibre-demo/index.html',import.meta.url),'utf8');
const match=html.match(/  async function installSurveillance\(\)\{([\s\S]*?)\n  \}\n  function updateSurveillanceStatus/);
assert.ok(match, 'Could not extract actual surveillance installer from demo');
const makeInstaller=new Function(
  'styleState','surveillanceCheck','surveillanceStatus','map',
  'resolveSurveillanceArchive','surveillanceArchiveUrl','installSurveillanceMarkers',
  'setSurveillanceVisibility','surveillanceMetadata','surveillanceArchive',
  'updateSurveillanceStatus','error','SURVEILLANCE_LAYER',
  'return async function installSurveillance(){'+match[1]+'\n};'
);
assert.match(html,/map\.on\('style\.load',\(\)=>\{\s*styleState\.ready=true;\s*styleState\.generation\+\+;/);
assert.match(html,/styleState\.ready=false;\s*styleState\.generation\+\+;\s*map\.setStyle\(style\);/);

function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  return {promise,resolve};
}
function fixture(pending){
  const styleState={ready:false,generation:0};
  const surveillanceCheck={checked:true};
  const surveillanceStatus={textContent:''};
  const error={textContent:''};
  const sources=new Map();
  let installed=0, visible=0, updates=0, resolved=0;
  const map={
    // The reported regression: this remains false even after 'style.load'.
    isStyleLoaded:()=>false,
    getSource:id=>sources.get(id),
    addSource(id,source){sources.set(id,source);}
  };
  const resolveSurveillanceArchive=async()=>{resolved++;if(pending)await pending.promise};
  const installSurveillanceMarkers=()=>{installed++};
  const setSurveillanceVisibility=()=>{visible++};
  const surveillanceArchive={getMetadata:async()=>({vector_layers:[{id:'surveillance'}]})};
  const updateSurveillanceStatus=()=>{updates++};
  const install=makeInstaller(styleState,surveillanceCheck,surveillanceStatus,map,
    resolveSurveillanceArchive,'https://example.org/surveillance.pmtiles',
    installSurveillanceMarkers,setSurveillanceVisibility,null,surveillanceArchive,
    updateSurveillanceStatus,error,'surveillance');
  return {styleState,surveillanceCheck,surveillanceStatus,error,sources,install,
    counts:()=>({installed,visible,updates,resolved})};
}
// Toggling on before style.load shows a waiting message.
let f=fixture();
await f.install();
assert.equal(f.surveillanceStatus.textContent,'Waiting for basemap style…');
assert.equal(f.counts().resolved,0);
// style.load is sufficient to install the overlay, even if isStyleLoaded=false.
f.styleState.ready=true;
f.styleState.generation++;
await f.install();
assert.equal(f.counts().installed,1);
assert.equal(f.counts().updates,1);
assert.ok(f.sources.has('surveillance-tiles'));
assert.equal(f.error.textContent,'');
// An in-flight archive resolution must not install onto a replaced basemap.
let pending=deferred();
f=fixture(pending);
f.styleState.ready=true;
f.styleState.generation=1;
const old=f.install();
f.styleState.ready=false;
f.styleState.generation=2;
pending.resolve();
await old;
assert.equal(f.counts().installed,0);
assert.ok(!f.sources.has('surveillance-tiles'));
// Checkbox may be turned off while the archive request is pending.
pending=deferred();
f=fixture(pending);
f.styleState.ready=true;
const off=f.install();
f.surveillanceCheck.checked=false;
pending.resolve();
await off;
assert.equal(f.counts().installed,0);
assert.equal(f.counts().updates,0);
console.log('MapLibre surveillance style lifecycle tests passed');
