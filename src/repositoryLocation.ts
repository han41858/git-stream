import {normalizeMonitorRepositories} from './MonitorRepositories';

export type RepositoryLocation={mode:'single'|'monitor';repositories:readonly string[]};
export function readRepositoryLocation(value:string):RepositoryLocation{
 const url=new URL(value),input=url.searchParams.getAll('repo'),repositories=normalizeMonitorRepositories(input);
 return {mode:repositories.length&&(input.length>1||url.searchParams.get('mode')==='monitor')?'monitor':'single',repositories};
}
export const repositoryLocationKey=({mode,repositories}:RepositoryLocation)=>`${mode}:${repositories.join('|')}`;
export function repositoryLocationURL(value:string,configuration:RepositoryLocation,share=false){
 const url=new URL(value),repositories=normalizeMonitorRepositories(configuration.repositories).slice(0,configuration.mode==='single'?1:undefined);
 if(share&&!['http:','https:'].includes(url.protocol))throw new Error('Unsupported app URL.');
 if(share){url.username='';url.password='';url.search='';url.hash='';}
 else{url.searchParams.delete('repo');url.searchParams.delete('mode');}
 for(const repository of repositories)url.searchParams.append('repo',repository);
 if(configuration.mode==='monitor'&&repositories.length===1)url.searchParams.set('mode','monitor');
 return url;
}
export function monitorShareURL(value:string,repositories:readonly string[]){
 const names=normalizeMonitorRepositories(repositories);if(!names.length)throw new Error('Select a repository to share.');
 return repositoryLocationURL(value,{mode:'monitor',repositories:names},true).href;
}
