{/* SECTION STATIQUE : Qualité du Code (SonarQube) */}
<Card className="lg:col-span-3 dark:border-gray-800 dark:bg-gray-900/80">
  <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
    <div className="flex items-center gap-2">
      <RiShieldCheckLine className="size-5 shrink-0" style={{ color: "#048890" }} />
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Qualité du Code (Standard CALF)
        </h2>
        <p className="text-xs text-gray-400">Exigences minimales de l'analyse SonarQube</p>
      </div>
    </div>
    <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      SonarQube
    </span>
  </div>

  {/* Grille des métriques */}
  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    
    {/* 1. Security Hotspots Reviewed */}
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Security Hotspots Reviewed</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">OK</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400">Projet</p>
          <p className="text-2xl font-extrabold font-mono text-gray-900 dark:text-gray-50">100%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-gray-400">Cible</p>
          <p className="text-xs font-semibold font-mono text-gray-500">≥ 100%</p>
        </div>
      </div>
      <CategoryBar values={[100, 0]} colors={["emerald", "gray"]} showLabels={false} className="mt-3" />
    </div>

    {/* 2. Coverage (Garde la valeur brute 45%) */}
    <div className="flex flex-col justify-between rounded-xl border border-rose-200 bg-rose-50/20 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Coverage</span>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">Alerte</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400">Projet</p>
          <p className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">45%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-gray-400">Cible</p>
          <p className="text-xs font-semibold font-mono text-gray-500">≥ 80%</p>
        </div>
      </div>
      <CategoryBar values={[45, 55]} colors={["red", "gray"]} showLabels={false} className="mt-3" />
    </div>

    {/* 3. Duplicated Lines */}
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Duplicated Lines</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">OK</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400">Projet</p>
          <p className="text-2xl font-extrabold font-mono text-gray-900 dark:text-gray-50">0%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-gray-400">Cible</p>
          <p className="text-xs font-semibold font-mono text-gray-500">≤ 3%</p>
        </div>
      </div>
      <CategoryBar values={[100, 0]} colors={["emerald", "gray"]} showLabels={false} className="mt-3" />
    </div>

    {/* 4. Maintainability Rating (Badge A) */}
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Maintainability Rating</span>
        <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">Cible : A</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-mono text-lg font-bold text-white shadow-xs">
        A
      </div>
    </div>

    {/* 5. Reliability Rating (Badge A) */}
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Reliability Rating</span>
        <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">Cible : A</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-mono text-lg font-bold text-white shadow-xs">
        A
      </div>
    </div>

    {/* 6. Security Rating (Badge A) */}
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Security Rating</span>
        <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">Cible : A</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-mono text-lg font-bold text-white shadow-xs">
        A
      </div>
    </div>

  </div>
</Card>
