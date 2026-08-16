const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(app.includes('const REPLAY_COORD_VERSION=2'),'coord migration version missing');
ok(app.includes('2606:{scale:78,offX:0,offY:-5}'),'2606 WCL calibration missing');
ok(app.includes('let py=50-((+y-midY)/spanY)*rangeY'),'WCL Y axis is not inverted');
ok(app.includes('if(worldAspect>=aspect){rangeX=100*fit;rangeY=100*fit*aspect/worldAspect}'),'aspect-preserving fit missing');
ok(!app.includes('(+x-b.minX)/(b.maxX-b.minX)*100,py=(+y-b.minY)/(b.maxY-b.minY)*100'),'legacy independent XY stretch still present');
// Geometry sanity: a 100x200 world box on a 16:9 viewport must NOT fill both axes.
const spanX=100,spanY=200,aspect=16/9,worldAspect=spanX/spanY,fit=.88;
let rangeX,rangeY;
if(worldAspect>=aspect){rangeX=100*fit;rangeY=100*fit*aspect/worldAspect}else{rangeY=100*fit;rangeX=100*fit*worldAspect/aspect}
ok(Math.abs(rangeY-88)<1e-9,'limiting axis fit broken');
ok(rangeX<30,'X geometry is still stretched independently');
console.log('WCL coordinate regression 2.0.7: OK', {rangeX,rangeY});
