import type {Workspace} from './workspace';
export function materialIdsForEntry(workspace:Workspace,entryId:string):string[]{
 return workspace.materials.filter(material=>material.links.includes(entryId)).map(material=>material.id);
}
export function linkEntryToMaterials(workspace:Workspace,entryId:string,materialIds:string[]):Workspace{
 const selected=new Set(materialIds);
 return {...workspace,materials:workspace.materials.map(material=>{
  const linked=material.links.includes(entryId),wanted=selected.has(material.id);if(linked===wanted)return material;
  return {...material,links:wanted?[...new Set([...material.links,entryId])]:material.links.filter(id=>id!==entryId),updated:Date.now()};
 })};
}
