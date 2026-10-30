// Bound HTTP concurrency without tying accepted work to the current viewport.
export class RequestPool {
 private active=0;
 private pending:(()=>void)[]=[];
 constructor(private readonly limit=16){}
 run<T>(signal:AbortSignal,task:()=>Promise<T>):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   let started=false;
   const abort=()=>{
    if(started)return;
    const index=this.pending.indexOf(start);if(index>=0)this.pending.splice(index,1);
    reject(signal.reason??new DOMException('Aborted','AbortError'));
   };
   const start=()=>{
    signal.removeEventListener('abort',abort);
    if(signal.aborted){reject(signal.reason);return;}
    started=true;this.active++;
    Promise.resolve().then(()=>{signal.throwIfAborted();return task();}).then(resolve,reject).finally(()=>{this.active--;this.pump();});
   };
   if(signal.aborted){reject(signal.reason);return;}
   signal.addEventListener('abort',abort,{once:true});this.pending.push(start);this.pump();
  });
 }
 private pump(){while(this.active<this.limit&&this.pending.length)this.pending.shift()!();}
}
