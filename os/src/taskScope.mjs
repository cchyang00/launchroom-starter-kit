// A saved task's explicit workspace scope must never inherit a different draft.
export function taskScope(job,draft){
 return job
  ? {productId:job.productId||null,marketId:job.marketId||null}
  : {productId:draft.productId||null,marketId:draft.marketId||null};
}
