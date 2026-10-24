"use client";

import React,{useCallback,useEffect,useRef,useState} from "react";

type Estado={escala:number;x:number;y:number};
type Ponteiro={x:number;y:number};
type Inicio={x:number;y:number;estado:Estado;largura:number;altura:number};
const MIN=1,MAX=8;
const limitar=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));

export function MapaZoomArea({children,rotulo,className=""}:{
 children:React.ReactNode;rotulo:string;className?:string
}){
 const container=useRef<HTMLDivElement|null>(null);
 const posicoes=useRef(new Map<number,Ponteiro>());
 const inicio=useRef<Inicio|null>(null);
 const gesto=useRef<{distancia:number;centro:Ponteiro;estado:Estado}|null>(null);
 const arrastou=useRef(false);
 const [zoom,setZoom]=useState<Estado>({escala:1,x:0,y:0});
 const zoomRef=useRef(zoom);
 zoomRef.current=zoom;

 const normalizar=useCallback((estado:Estado)=>{
  const box=container.current?.getBoundingClientRect();
  if(!box)return estado;
  const maxX=(box.width*(estado.escala-1))/2;
  const maxY=(box.height*(estado.escala-1))/2;
  return {escala:estado.escala,x:limitar(estado.x,-maxX,maxX),y:limitar(estado.y,-maxY,maxY)};
 },[]);
 const alterar=useCallback((proximo:Estado)=>{
  const novo=normalizar(proximo);zoomRef.current=novo;setZoom(novo);
 },[normalizar]);

 const ampliar=useCallback((fator:number)=>{
  const atual=zoomRef.current;
  const escala=limitar(atual.escala*fator,MIN,MAX);
  if(escala===MIN){alterar({escala:1,x:0,y:0});return;}
  const relacao=escala/atual.escala;
  alterar({escala,x:atual.x*relacao,y:atual.y*relacao});
 },[alterar]);
 const restaurar=useCallback(()=>alterar({escala:1,x:0,y:0}),[alterar]);

 useEffect(()=>{
  const element=container.current;
  if(!element)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey&&Math.abs(event.deltaY)>0){
    event.preventDefault();
    const rect=element.getBoundingClientRect();
    const atual=zoomRef.current;
    const fator=Math.exp(-event.deltaY*.0012);
    const escala=limitar(atual.escala*fator,MIN,MAX);
    if(escala===MIN){alterar({escala:1,x:0,y:0});return;}
    const rx=event.clientX-(rect.left+rect.width/2);
    const ry=event.clientY-(rect.top+rect.height/2);
    const relacao=escala/atual.escala;
    alterar({escala,x:rx-(rx-atual.x)*relacao,y:ry-(ry-atual.y)*relacao});
   }
  };
  element.addEventListener("wheel",wheel,{passive:false});
  return ()=>element.removeEventListener("wheel",wheel);
 },[alterar]);

 const pointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  posicoes.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(posicoes.current.size===1){
   inicio.current={x:event.clientX,y:event.clientY,estado:zoomRef.current,
    largura:container.current?.clientWidth??1,altura:container.current?.clientHeight??1};
   gesto.current=null;arrastou.current=false;
  }else if(posicoes.current.size===2){
   const [a,b]=[...posicoes.current.values()];
   gesto.current={distancia:Math.hypot(a.x-b.x,a.y-b.y)||1,
    centro:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},estado:zoomRef.current};
   arrastou.current=true;
  }
 };
 const pointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(!posicoes.current.has(event.pointerId))return;
  posicoes.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(posicoes.current.size===2&&gesto.current){
   const [a,b]=[...posicoes.current.values()];
   const g=gesto.current;
   const escala=limitar(g.estado.escala*Math.hypot(a.x-b.x,a.y-b.y)/g.distancia,MIN,MAX);
   const relacao=escala/g.estado.escala;
   const rect=container.current?.getBoundingClientRect();
   const cx=rect?g.centro.x-(rect.left+rect.width/2):0;
   const cy=rect?g.centro.y-(rect.top+rect.height/2):0;
   alterar({escala,x:cx-(cx-g.estado.x)*relacao+((a.x+b.x)/2-g.centro.x),
    y:cy-(cy-g.estado.y)*relacao+((a.y+b.y)/2-g.centro.y)});
   arrastou.current=true;
  }else if(posicoes.current.size===1&&inicio.current){
   const start=inicio.current;
   const dx=event.clientX-start.x,dy=event.clientY-start.y;
   if(Math.abs(dx)+Math.abs(dy)>6)arrastou.current=true;
   if(arrastou.current&&zoomRef.current.escala>MIN)
    alterar({escala:start.estado.escala,x:start.estado.x+dx,y:start.estado.y+dy});
  }
 };
 const pointerEnd=(event:React.PointerEvent<HTMLDivElement>)=>{
  posicoes.current.delete(event.pointerId);
  if(posicoes.current.size===1){
   const p=[...posicoes.current.values()][0];
   inicio.current={x:p.x,y:p.y,estado:zoomRef.current,largura:1,altura:1};
  }else if(posicoes.current.size===0){
   inicio.current=null;
   gesto.current=null;
  }
 };
 const clickCapture=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(arrastou.current){event.preventDefault();event.stopPropagation();arrastou.current=false;}
 };
 return <div className={"ruido-map-zoom "+className} data-zoom={zoom.escala.toFixed(2)}>
  <div className="ruido-map-zoom__surface" ref={container} aria-label={rotulo}
   onPointerDown={pointerDown} onPointerMove={pointerMove}
   onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
   onClickCapture={clickCapture}>
   <div className="ruido-map-zoom__content" style={{
    transform:"translate3d("+zoom.x+"px,"+zoom.y+"px,0) scale("+zoom.escala+")",
    transformOrigin:"center center"
   }}>{children}</div>
  </div>
  <div className="ruido-map-zoom__tools" role="group" aria-label={"Controles de zoom: "+rotulo}>
   <button type="button" onClick={()=>ampliar(1.6)} disabled={zoom.escala>=MAX-.02} aria-label="Ampliar mapa" title="Ampliar mapa">+</button>
   <span className="ruido-map-zoom__percent" aria-live="off">{Math.round(zoom.escala*100)}%</span>
   <button type="button" onClick={()=>ampliar(1/1.6)} disabled={zoom.escala<=MIN+.02} aria-label="Reduzir mapa" title="Reduzir mapa">−</button>
   <button type="button" className="ruido-map-zoom__reset" onClick={restaurar} aria-label="Restaurar enquadramento do mapa" title="Restaurar zoom">⟲</button>
  </div>
 </div>;
}
