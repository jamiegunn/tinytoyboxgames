// SCRATCH PROBE. What each room's opening frame is made of, at every aspect a
// shipping device can produce, so the bounds in room-opening-framing.test.mjs
// are set from measurement rather than from the last failure message.
import { PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import gsap from 'gsap';
import { bundleEntry } from '../tests/framework/_tsload.mjs';
const M = await bundleEntry('composition-now', `
  export { resolveSceneCameraPose, SCENE_CAMERA_FOV } from './src/utils/cameraPresets';
  export { stageAspectFor } from './src/utils/scene/stageRect';
  export { buildPlayroomContents } from './src/scenes/world/places/house/subplaces/playroom/room';
  export { buildRoomContents as buildKitchenContents } from './src/scenes/world/places/house/subplaces/kitchen/room';
  export { buildRoomContents as buildLivingRoomContents } from './src/scenes/world/places/house/subplaces/living-room/room';
`);
const VIEWPORTS = [[1280,720],[1024,768],[800,800],[768,1024],[480,854],[375,667],[393,852],[412,915],[400,1000],[852,393],[915,412],[1194,834],[1920,1080],[2560,1080]];
const ASPECTS = [...new Set(VIEWPORTS.map(([w,h]) => M.stageAspectFor(w,h)))].sort((a,b)=>a-b);
const noop = () => {};
const stubCanvas = () => ({ width:1280, height:720, clientWidth:1280, clientHeight:720, getBoundingClientRect: () => ({left:0,top:0,width:1280,height:720}), addEventListener:noop, removeEventListener:noop, style:{} });
for (const [id, fn] of [['playroom',M.buildPlayroomContents],['kitchen',M.buildKitchenContents],['living-room',M.buildLivingRoomContents]]) {
  const scene = new Scene();
  const contents = fn({ scene, canvas: stubCanvas(), camera: new PerspectiveCamera(), dispatcher:{register:()=>noop,registerWithPoint:()=>noop,setMissHandler:noop,dispose:noop}, nav:{navigateTo:noop,launchMiniGame:noop,exitMiniGame:noop}, owl:{flyTo:noop,setSurfaceYAt:noop,land:noop,group:{position:new Vector3()}} });
  scene.updateMatrixWorld(true);
  console.log(`\n=== ${id}`);
  let minProps = 1, maxCeil = 0, maxVoid = 0, maxBare = 0, minPropsP = 1, maxBareP = 0;
  for (const aspect of ASPECTS) {
    const pose = M.resolveSceneCameraPose(id, aspect);
    const camera = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 400);
    camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    const caster = new Raycaster(); const t = {props:0,soft:0,wall:0,floor:0,ceiling:0,nothing:0}; const n = 32;
    for (let iy=0;iy<n;iy++) for (let ix=0;ix<n;ix++) {
      caster.setFromCamera(new Vector2((ix/(n-1))*2-1,(iy/(n-1))*2-1), camera);
      const h = caster.intersectObjects(scene.children,true)[0];
      if(!h){t.nothing++;continue;}
      let nd=h.object; while(nd&&!nd.name)nd=nd.parent; const nm=(nd?.name||'').toLowerCase();
      if(nm.includes('ceiling'))t.ceiling++;
      else if(nm.includes('rug')||nm.includes('runner')||nm.includes('carpet'))t.soft++;
      else if(nm.includes('floor')||nm.includes('ground'))t.floor++;
      else if(nm.includes('wall')||nm.includes('wainscot')||nm.includes('wallpaper'))t.wall++; else t.props++;
    }
    const tot=n*n; const c=Object.fromEntries(Object.entries(t).map(([a,b])=>[a,b/tot]));
    minProps=Math.min(minProps,c.props); maxCeil=Math.max(maxCeil,c.ceiling); maxVoid=Math.max(maxVoid,c.nothing); maxBare=Math.max(maxBare,c.floor); if(aspect<=1.0){minPropsP=Math.min(minPropsP,c.props); maxBareP=Math.max(maxBareP,c.floor);}
    console.log(`  ${aspect.toFixed(2)}  objects ${(c.props*100).toFixed(1)}%  rug ${(c.soft*100).toFixed(1)}%  bare floor ${(c.floor*100).toFixed(1)}%  wall ${(c.wall*100).toFixed(1)}%  ceiling ${(c.ceiling*100).toFixed(1)}%  void ${(c.nothing*100).toFixed(1)}%`);
  }
  console.log(`  --> ALL aspects: objects >= ${(minProps*100).toFixed(1)}%  bare floor <= ${(maxBare*100).toFixed(1)}%  ceiling <= ${(maxCeil*100).toFixed(1)}%  void <= ${(maxVoid*100).toFixed(1)}%`);
  console.log(`  --> PORTRAIT (<=1.0): objects >= ${(minPropsP*100).toFixed(1)}%  bare floor <= ${(maxBareP*100).toFixed(1)}%`);
  contents?.cleanup?.();
}
gsap.ticker.sleep();
process.exit(0);
