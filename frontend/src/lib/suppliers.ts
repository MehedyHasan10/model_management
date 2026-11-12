export type SupplierStatus = "ACTIVE" | "INACTIVE";
export type Supplier = {id:string;code:string;name:string;contactPerson:string|null;phone:string|null;email:string|null;address:string|null;notes:string|null;status:SupplierStatus;createdAt:string;updatedAt:string};
export type SupplierInput = {code:string;name:string;contactPerson:string;phone:string;email:string;address:string;notes:string;status:SupplierStatus};
export type SupplierListResponse = {items:Supplier[];pagination:{page:number;limit:number;total:number;totalPages:number};stats:{total:number;active:number}};
export class SupplierApiError extends Error { constructor(message:string,public fieldErrors:Record<string,string[]> = {}) {super(message)} }
async function request<T>(path:string,options?:RequestInit):Promise<T> {
  const response=await fetch(`/api/suppliers${path}`,{...options,credentials:"same-origin",headers:{...(options?.body?{"Content-Type":"application/json"}:{}),...options?.headers},cache:"no-store"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new SupplierApiError(body.error||`Request failed (${response.status})`,body.details?.fieldErrors||{});
  return body as T;
}
export const suppliersApi={
 list:(params:URLSearchParams)=>request<SupplierListResponse>(`?${params.toString()}`),
 get:(id:string)=>request<Supplier>(`/${encodeURIComponent(id)}`),
 create:(value:SupplierInput)=>request<Supplier>("",{method:"POST",body:JSON.stringify(value)}),
 update:(id:string,value:SupplierInput)=>request<Supplier>(`/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(value)}),
 remove:(id:string)=>request<{ok:boolean}>(`/${encodeURIComponent(id)}`,{method:"DELETE"}),
};
