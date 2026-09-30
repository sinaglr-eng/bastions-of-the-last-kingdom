import {searchMazeVariants} from './maze-search.js';
self.onmessage=({data})=>{
  try{const result=searchMazeVariants(data.snapshot,data.budget,{effort:data.effort||1,initialPlans:data.initialPlans||[],onProgress:progress=>self.postMessage({id:data.id,progress})});self.postMessage({id:data.id,result});}
  catch(error){self.postMessage({id:data.id,error:error.message});}
};
