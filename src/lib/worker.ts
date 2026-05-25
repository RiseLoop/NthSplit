export type SolveRequest = {
  N: string;
  kMin: string | null;
  kMax: string | null;
  nMin: string | null;
  nMax: string | null;
  aMin: string | null;
  aMax: string | null;
};

export type SeqPart = { base: string, count: string };

export type EquationResultStr = {
  k: string;
  n: string;
  seq: SeqPart[];
};

export type SolveResponse = {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  results?: EquationResultStr[];
  error?: string;
  timeTakenMs?: number;
};

function nthRoot(val: bigint, k: bigint): bigint {
  if (val < 0n) throw new Error("Negative root");
  if (val === 0n) return 0n;
  if (k === 1n) return val;
  let bound = 1n;
  let power = 1n;
  while(power <= val) {
      bound *= 2n;
      power = bound ** k;
  }
  let low = bound / 2n;
  let high = bound;
  let ans = 1n;
  while (low <= high) {
    const mid = (low + high) / 2n;
    if (mid ** k <= val) {
      ans = mid;
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }
  return ans;
}

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const req = e.data;
  
  try {
    const N = BigInt(req.N);
    const kMin = req.kMin !== null ? BigInt(req.kMin) : 1n;
    
    let maxK = 1n;
    let temp = 1n;
    while(temp <= N) {
        temp *= 2n;
        maxK++;
    }
    const kMax = req.kMax !== null ? BigInt(req.kMax) : (maxK > 100n ? 100n : maxK);

    const nMin = req.nMin !== null ? BigInt(req.nMin) : 1n;
    const nMax = req.nMax !== null ? BigInt(req.nMax) : N;

    const aMin = req.aMin !== null ? BigInt(req.aMin) : 1n;
    const aMax = req.aMax !== null ? BigInt(req.aMax) : N;

    const results: EquationResultStr[] = [];
    
    let iterations = 0;
    const startTime = Date.now();
    let lastPost = startTime;
    
    const totalOuterLoops = Number(kMax - kMin + 1n) * Number(nMax - nMin + 1n);
    let loopsDone = 0;

    for (let k = kMin; k <= kMax; k++) {
      for (let n = nMin; n <= nMax; n++) {
        const currentSeq: { base: bigint, count: bigint }[] = [];

        const backtrack = (remN: bigint, remSum: bigint, minVa: bigint) => {
          iterations++;
          
          if (iterations % 1000 === 0) {
              const now = Date.now();
              if (now - lastPost > 150) {
                  let ratio = loopsDone / totalOuterLoops;
                  ratio = Math.max(0, Math.min(1, ratio));
                  self.postMessage({
                      type: 'progress',
                      progress: ratio * 100,
                      results: results.splice(0, results.length),
                  } as SolveResponse);
                  lastPost = now;
              }
          }
          
          if (remN === 0n) {
            if (remSum === 0n) {
              results.push({
                k: k.toString(),
                n: n.toString(),
                seq: currentSeq.map(item => ({ base: item.base.toString(), count: item.count.toString() }))
              });
            }
            return;
          }
          
          if (remN * (minVa ** k) > remSum) return;

          let currentMaxVa = nthRoot(remSum, k);
          if (currentMaxVa > aMax) currentMaxVa = aMax;
          if (minVa > currentMaxVa) return;

          if (remN * (currentMaxVa ** k) < remSum) return;

          for (let a = minVa; a <= currentMaxVa; a++) {
            let ak = a ** k;
            let M = (a + 1n) ** k;
            let B = ak;
            let R = remN;
            let A = remSum;

            let maxC = A / B;
            if (maxC > R) maxC = R;

            let minC = 1n;
            
            if (a + 1n <= aMax) {
                let numLower = R * M - A;
                let denLower = M - B;
                if (numLower > 0n) {
                    let mcLower = (numLower + denLower - 1n) / denLower;
                    if (mcLower > minC) minC = mcLower;
                }
                
                if (aMax > a) {
                    let maxVaK = aMax ** k;
                    let numUpper = R * maxVaK - A;
                    let denUpper = maxVaK - B;
                    if (numUpper >= 0n && denUpper > 0n) {
                        let mcUpper = numUpper / denUpper;
                        if (mcUpper < maxC) maxC = mcUpper;
                    } else if (numUpper < 0n) {
                        maxC = -1n;
                    }
                }
            } else {
                minC = R;
                maxC = R;
            }

            if (minC > maxC) continue;

            // Iterate downward so lexical ordering matches (larger counts of current 'a' means more small elements)
            for (let count = maxC; count >= minC; count--) {
                currentSeq.push({ base: a, count: count });
                backtrack(R - count, A - count * B, a + 1n);
                currentSeq.pop();
            }
          }
        };

        backtrack(n, N, aMin);
        loopsDone++;
      }
    }
    
    self.postMessage({
        type: 'result',
        results: results,
        timeTakenMs: Date.now() - startTime
    } as SolveResponse);
    
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      error: err.message
    } as SolveResponse);
  }
};
