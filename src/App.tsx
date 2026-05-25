import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Activity, Play, Settings2, Cpu, X, Copy, Download, Check, StopCircle } from 'lucide-react';
import { EquationResultStr, SolveResponse, SeqPart } from './lib/worker';

export default function App() {
  const [N, setN] = useState<string>('100');
  const [kMin, setKMin] = useState<string>('');
  const [kMax, setKMax] = useState<string>('');
  const [nMin, setNMin] = useState<string>('');
  const [nMax, setNMax] = useState<string>('');
  const [aMin, setAMin] = useState<string>('');
  const [aMax, setAMax] = useState<string>('');
  
  const [isComputing, setIsComputing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<EquationResultStr[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computeTime, setComputeTime] = useState<number | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  const [copied, setCopied] = useState(false);

  const formatTextSeq = (seq: SeqPart[], k: string) => {
    let parts: string[] = [];
    for (const item of seq) {
      if (BigInt(item.count) <= 5n) {
        for (let i = 0; i < Number(item.count); i++) {
          parts.push(`${item.base}^${k}`);
        }
      } else {
        parts.push(`${item.base}^${k} (x${item.count})`);
      }
    }
    return parts.join(' + ');
  };

  const formatResults = (res: EquationResultStr[]) => {
    return res.map(r => `k=${r.k}, n=${r.n}: ${formatTextSeq(r.seq, r.k)} = ${N}`).join('\n');
  };

  const handleCopy = async () => {
    if (!results || results.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatResults(results));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleDownload = () => {
    if (!results || results.length === 0) return;
    const blob = new Blob([formatResults(results)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equation_results_N${N}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStop = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsComputing(false);
      setError('Computation stopped by user.');
    }
  };

  const handleCompute = () => {
    // Validation
    const isNum = (s: string) => /^\d+$/.test(s);
    
    if (!N || !isNum(N) || BigInt(N) <= 0n) {
      setError('N must be a positive integer.');
      return;
    }
    if (kMin && kMax && BigInt(kMin) > BigInt(kMax)) {
      setError('Invalid range for k. k(min) must be <= k(max).');
      return;
    }
    if (nMin && nMax && BigInt(nMin) > BigInt(nMax)) {
      setError('Invalid range for n. n(min) must be <= n(max).');
      return;
    }
    if (aMin && aMax && BigInt(aMin) > BigInt(aMax)) {
      setError('Invalid range for a. a(min) must be <= a(max).');
      return;
    }

    setError(null);
    setIsComputing(true);
    setResults([]);
    setProgress(0);
    setCopied(false);
    setComputeTime(null);

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker(new URL('./lib/worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<SolveResponse>) => {
      const res = e.data;
      if (res.type === 'progress') {
        setProgress(res.progress || 0);
        if (res.results && res.results.length > 0) {
          setResults(prev => [...(prev || []), ...res.results!]);
        }
      } else if (res.type === 'result') {
        if (res.results && res.results.length > 0) {
          setResults(prev => [...(prev || []), ...res.results!]);
        }
        setIsComputing(false);
        setProgress(100);
        setComputeTime(res.timeTakenMs || null);
        worker.terminate();
        workerRef.current = null;
      } else if (res.type === 'error') {
        setError(res.error || 'Unknown error');
        setIsComputing(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({
      N,
      kMin: kMin || null,
      kMax: kMax || null,
      nMin: nMin || null,
      nMax: nMax || null,
      aMin: aMin || null,
      aMax: aMax || null
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden flex flex-col md:flex-row">
      {/* Background Decorators */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-[10%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

      {/* Side Panel (Controls) */}
      <motion.div 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-cyan-900/40 bg-slate-950/50 backdrop-blur-xl z-10 flex flex-col h-auto md:h-screen sticky top-0"
      >
        <div className="p-6 border-b border-cyan-900/40 flex items-center gap-3">
          <div className="p-2 bg-cyan-950 rounded-lg border border-cyan-800 text-cyan-400">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">QuantumSolver</h1>
            <p className="text-xs text-cyan-500/80 font-mono">v1.2.0-STABLE</p>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
              <Settings2 size={16} />
              <span>PARAMETERS</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">TARGET VALUE (N, Large Integrals Supported)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={N}
                  onChange={e => setN(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-cyan-500 rounded-lg px-4 py-3 text-white font-mono text-lg transition-all focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:outline-none"
                  placeholder="e.g. 100"
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-4 text-cyan-500/30">N</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MIN POWER (k)</label>
                <input 
                  type="text" 
                  value={kMin}
                  onChange={e => setKMin(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-purple-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(168,85,247,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MAX POWER (k)</label>
                <input 
                  type="text" 
                  value={kMax}
                  onChange={e => setKMax(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-purple-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(168,85,247,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MIN TERMS (n)</label>
                <input 
                  type="text" 
                  value={nMin}
                  onChange={e => setNMin(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-emerald-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MAX TERMS (n)</label>
                <input 
                  type="text" 
                  value={nMax}
                  onChange={e => setNMax(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-emerald-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MIN BASE (a)</label>
                <input 
                  type="text" 
                  value={aMin}
                  onChange={e => setAMin(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-amber-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(245,158,11,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono tracking-wider ml-1">MAX BASE (a)</label>
                <input 
                  type="text" 
                  value={aMax}
                  onChange={e => setAMax(e.target.value.replace(/\D/g, ''))}
                  placeholder="∞"
                  className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-amber-500 rounded-lg px-4 py-2.5 text-white font-mono text-md transition-all focus:shadow-[0_0_15px_rgba(245,158,11,0.2)] focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-cyan-900/40 bg-slate-950/80">
          {isComputing ? (
            <button
              onClick={handleStop}
              className="w-full relative group overflow-hidden rounded-lg bg-red-600/20 border border-red-500/50 hover:bg-red-600 hover:border-red-500 text-red-500 hover:text-white font-semibold py-3 px-6 transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
            >
              <div className="flex items-center justify-center gap-2 relative z-10">
                <StopCircle size={20} />
                <span>STOP MATRIX COMPUTE</span>
              </div>
            </button>
          ) : (
            <button
              onClick={handleCompute}
              className="w-full relative group overflow-hidden rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 px-6 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <div className="flex items-center justify-center gap-2 relative z-10">
                <Play size={20} className="fill-current" />
                <span>INITIALIZE SEARCH</span>
              </div>
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Panel (Results) */}
      <div className="flex-1 flex flex-col min-h-screen h-screen overflow-hidden relative z-10 p-4 md:p-8">
        
        {/* Header summary of equation format */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-start md:items-center gap-4">
            <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
              <Terminal size={24} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-slate-200">Constraint Equation</h2>
              <div className="text-cyan-400 font-mono text-xl mt-1 tracking-wider overflow-x-auto whitespace-nowrap pb-1">
                a₁<sup className="text-xs">k</sup> + a₂<sup className="text-xs">k</sup> + ... + aₙ<sup className="text-xs">k</sup> = N
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Where 1 &le; a<sub>i</sub> &le; a<sub>i+1</sub>, and integer N, k, n boundaries defined.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Results Area */}
        <div className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl relative">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="font-mono text-sm text-cyan-500 tracking-wider">OUTPUT_TERMINAL</span>
              {results && (
                <span className="font-mono text-xs px-2 py-0.5 ml-2 bg-cyan-950/50 text-cyan-400 border border-cyan-900/50 rounded">
                  {results.length} results
                </span>
              )}
            </div>
            {results && results.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors border border-slate-700 hover:border-slate-600"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'COPIED' : 'COPY'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-400 font-mono text-xs transition-colors border border-cyan-800/50 hover:border-cyan-700"
                >
                  <Download size={14} />
                  <span>EXPORT</span>
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start gap-3 text-red-400"
              >
                <X size={20} className="mt-0.5 shrink-0" />
                <p className="font-mono text-sm">{error}</p>
              </motion.div>
            )}

            {!error && !results && !isComputing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <Terminal size={48} className="opacity-20" />
                <p className="font-mono text-sm tracking-widest uppercase">System Ready // Awaiting Input</p>
              </div>
            )}

            {isComputing && (
              <div className="h-full flex flex-col items-center justify-center space-y-6 max-w-sm mx-auto">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-t-2 border-cyan-500 rounded-full animate-spin" />
                  <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-reverse" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  <div className="absolute inset-4 border-b-2 border-emerald-500 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
                </div>
                
                <div className="w-full">
                  <div className="flex justify-between w-full text-xs font-mono mb-2 text-cyan-400">
                    <span className="uppercase tracking-widest animate-pulse">Processing...</span>
                    <span>{progress?.toFixed(1) || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden relative">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-300 relative shadow-[0_0_15px_rgba(34,211,238,0.5)]" 
                      style={{ width: `${progress || 0}%` }}
                    >
                       <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] animate-shimmer" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!error && results && results.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4"
              >
                <div className="p-4 rounded-full bg-slate-800/50">
                  <Activity size={32} className="opacity-50" />
                </div>
                <p className="font-mono text-sm tracking-widest text-center">No structural matches found.<br/>Adjust coordinate boundaries.</p>
              </motion.div>
            )}

            <AnimatePresence>
              {!error && results && results.length > 0 && (
                <div className="space-y-3 pb-8">
                  {computeTime !== null && (
                     <div className="text-right text-xs text-slate-500 font-mono pb-2">
                       Computation completed in {(computeTime / 1000).toFixed(2)}s
                     </div>
                  )}
                  {results.map((res, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group flex flex-col sm:flex-row sm:items-start gap-4 py-3 px-4 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-900/50 transition-colors"
                    >
                      <div className="flex gap-3 mt-0.5 whitespace-nowrap">
                        <span className="font-mono text-xs px-2 py-1 rounded bg-purple-950/50 text-purple-400 border border-purple-900/30">
                          k={res.k}
                        </span>
                        <span className="font-mono text-xs px-2 py-1 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">
                          n={res.n}
                        </span>
                      </div>
                      <div className="font-mono text-amber-100 flex-1 overflow-x-auto whitespace-normal break-words py-0.5 leading-relaxed">
                        <span className="text-slate-500 mr-2 opacity-50 text-xs">[{idx+1}]</span>
                        {res.seq.map((item, i) => {
                          const baseStr = item.base;
                          const count = BigInt(item.count);
                          
                          if (count <= 5n) {
                             // Render individually
                             const items = [];
                             for(let c=0; c < Number(count); c++) {
                                items.push(
                                  <React.Fragment key={`${i}-${c}`}>
                                    <span className="inline-block relative top-0.5 mr-0.5">
                                      {baseStr}<sup className="text-cyan-600 text-[0.65rem] -ml-0.5">{res.k}</sup>
                                    </span>
                                  </React.Fragment>
                                );
                             }
                             return (
                               <React.Fragment key={i}>
                                  {items.map((node, subI) => (
                                    <React.Fragment key={`${i}-${subI}`}>
                                      {node}
                                      {(i < res.seq.length - 1 || subI < Number(count) - 1) && (
                                        <span className="mx-1 text-slate-600 inline-block align-middle">+</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                               </React.Fragment>
                             );
                          } else {
                             // Render aggregated
                             return (
                               <React.Fragment key={i}>
                                 <span className="inline-block">
                                   <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-500/90 border border-amber-900/30 text-xs mx-1 align-baseline">
                                     x{item.count}
                                   </span>
                                   <span className="relative top-0.5 mr-0.5">
                                     {baseStr}<sup className="text-cyan-600 text-[0.65rem] -ml-0.5">{res.k}</sup>
                                   </span>
                                 </span>
                                 {i < res.seq.length - 1 && (
                                   <span className="mx-1 text-slate-600 inline-block align-middle">+</span>
                                 )}
                               </React.Fragment>
                             );
                          }
                        })}
                        <span className="mx-2 text-slate-600 inline-block align-middle">=</span>
                        <span className="text-cyan-400 font-bold inline-block align-middle">{N}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
          
          {/* subtle scanline effect overlay over the terminal content area */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-10 opacity-20 mix-blend-overlay"></div>
        </div>
      </div>
    </div>
  );
}
