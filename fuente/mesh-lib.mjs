// Funciones de malla compartidas (SDF + surface nets)
const L=(a,b)=>Math.hypot(a,b), sq=x=>x*x, clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const sm=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return b+(a-b)*h-k*h*(1-h)};
export const sub=(a,b,k)=>-sm(-a,b,k);
export const sph=(p,c,r)=>Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])-r;
export function ell(p,c,r){const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];const k0=Math.hypot(x,y,z);const k1=Math.hypot(x/r[0],y/r[1],z/r[2]);return k1<1e-6?-Math.min(...r):k0*(k0-1)/k1}
export function cap(p,a,b,ra,rb=ra){const ba=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],pa=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];const h=clamp((pa[0]*ba[0]+pa[1]*ba[1]+pa[2]*ba[2])/(ba[0]**2+ba[1]**2+ba[2]**2),0,1);return Math.hypot(pa[0]-ba[0]*h,pa[1]-ba[1]*h,pa[2]-ba[2]*h)-(ra+(rb-ra)*h)}
export const mz=(p)=>[p[0],p[1],Math.abs(p[2])]; // simetría

export function head(p){const q=mz(p);let d=ell(p,[-.80,.125,0],[.102,.097,.080]);
 d=sm(d,ell(p,[-.728,.150,0],[.076,.072,.060]),.03);
 d=sm(d,ell(p,[-.672,.172,0],[.024,.026,.030]),.022);
 d=sm(d,sph(q,[-.752,.180,.046],.030),.026);
 d=sm(d,cap(p,[-.83,.205,0],[-.81,.212,0],.016),.02);
 d=sm(d,cap(q,[-.808,.212,.016],[-.802,.200,.058],.0085),.012); // cejas
 d=sub(d,sph(q,[-.786,.226,.033],.0185),.012); // órbitas
 d=sm(d,cap(p,[-.795,.214,0],[-.748,.243,0],.0085,.0105),.009); // nariz
 d=sm(d,sph(p,[-.742,.246,0],.0145),.008);
 d=sm(d,sph(q,[-.738,.229,.0155],.0095),.006);
 d=sub(d,sph(q,[-.7305,.236,.0075],.0042),.003);
 // labios
 d=sm(d,ell(q,[-.7055,.2145,.009],[.0068,.0075,.019]),.005);
 d=sm(d,ell(p,[-.6935,.2125,0],[.0078,.0085,.0215]),.005);
 d=sub(d,cap(q,[-.6995,.2235,0],[-.6995,.2195,.027],.0013),.0032);
 d=sm(d,ell(q,[-.768,.118,.080],[.030,.018,.0075]),.006); // orejas
 d=sub(d,sph(q,[-.768,.122,.087],.011),.006);
 d=sm(d,cap(p,[-.70,.098,0],[-.56,.105,0],.056,.062),.03); return d}
export function torso(p){const q=mz(p);let d=ell(p,[-.38,.105,0],[.215,.108,.186]);
 d=sm(d,ell(q,[-.455,.170,.075],[.085,.040,.080]),.04);
 d=sm(d,cap(q,[-.545,.105,.05],[-.545,.105,.195],.066,.060),.05);
 d=sm(d,ell(p,[-.13,.095,0],[.19,.095,.162]),.06);
 d=sm(d,cap(p,[-.62,.10,0],[-.55,.105,0],.06,.07),.03); return d}
export const armPts=[[-.545,.105,.215],[-.285,.082,.292],[-.03,.135,.272]];
export function arm(q){return sm(cap(q,armPts[0],armPts[1],.052,.041),cap(q,armPts[1],armPts[2],.041,.029),.015)}
export function hand(q){let d=ell(q,[.035,.142,.262],[.058,.017,.044]);
 d=sm(d,arm(q),.012);
 for(const[z,l]of[[.232,.075],[.25,.092],[.27,.085],[.289,.066]]){d=sm(d,cap(q,[.08,.142,z],[.08+l,.128,z-.002],.0098,.0082),.006)}
 d=sm(d,cap(q,[.015,.146,.228],[.085,.138,.205],.0125,.0095),.012);return d}
export function surfaceNets(f,grad,min,max,h){const nx=Math.ceil((max[0]-min[0])/h),ny=Math.ceil((max[1]-min[1])/h),nz=Math.ceil((max[2]-min[2])/h);
 const I=(x,y,z)=>x+y*(nx+1)+z*(nx+1)*(ny+1);const V=new Float32Array((nx+1)*(ny+1)*(nz+1));
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)V[I(x,y,z)]=f([min[0]+x*h,min[1]+y*h,min[2]+z*h]);
 const vid=new Int32Array(nx*ny*nz).fill(-1),C=(x,y,z)=>x+y*nx+z*nx*ny,pos=[],idx=[];const corners=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const v=corners.map(c=>V[I(x+c[0],y+c[1],z+c[2])]);let s=0,c=[0,0,0],n=0;v.forEach((a,i)=>{if(a<0)s|=1<<i});if(s===0||s===255)continue;for(const[a,b]of edges){if((v[a]<0)===(v[b]<0))continue;const t=v[a]/(v[a]-v[b]);for(let k=0;k<3;k++)c[k]+=corners[a][k]+(corners[b][k]-corners[a][k])*t;n++}
  vid[C(x,y,z)]=pos.length/3;pos.push(min[0]+(x+c[0]/n)*h,min[1]+(y+c[1]/n)*h,min[2]+(z+c[2]/n)*h)}
 const quad=(a,b,c,d,f)=>{if(a<0||b<0||c<0||d<0)return;if(f)idx.push(a,b,c,a,c,d);else idx.push(a,c,b,a,d,c)};
 for(let z=1;z<nz;z++)for(let y=1;y<ny;y++)for(let x=1;x<nx;x++){const a=V[I(x,y,z)]<0;
  if(a!==(V[I(x+1,y,z)]<0))quad(vid[C(x,y-1,z-1)],vid[C(x,y,z-1)],vid[C(x,y,z)],vid[C(x,y-1,z)],a);
  if(a!==(V[I(x,y+1,z)]<0))quad(vid[C(x-1,y,z-1)],vid[C(x-1,y,z)],vid[C(x,y,z)],vid[C(x,y,z-1)],a);
  if(a!==(V[I(x,y,z+1)]<0))quad(vid[C(x-1,y-1,z)],vid[C(x,y-1,z)],vid[C(x,y,z)],vid[C(x-1,y,z)],a)}
 return{pos,idx}}
const gradOf=f=>p=>{const e=.0012;const g=[f([p[0]+e,p[1],p[2]])-f([p[0]-e,p[1],p[2]]),f([p[0],p[1]+e,p[2]])-f([p[0],p[1]-e,p[2]]),f([p[0],p[1],p[2]+e])-f([p[0],p[1],p[2]-e])];const l=Math.hypot(...g)||1;return g.map(x=>x/l)};
