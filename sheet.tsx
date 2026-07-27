import React, { useState } from 'react';
import { Button } from '@/components/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog";

// Interface pour gérer les fichiers déposés dans chaque zone
interface TabUploadState {
  zone1: File | null;
  zone2: File | null;
  zone3: File | null;
}

export const DialogHero = () => {
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [hasModules, setHasModules] = useState<'no' | 'yes'>('no');
  const [moduleCount, setModuleCount] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Stocke les fichiers uploadés par onglet
  const [uploads, setUploads] = useState<Record<number, TabUploadState>>({});

  // Génération de la liste des onglets (1 seul si pas de module, sinon selon moduleCount)
  const tabsCount = hasModules === 'yes' ? Math.max(2, moduleCount) : 1;
  const tabsList = Array.from({ length: tabsCount }, (_, i) => 
    hasModules === 'yes' ? `Module ${i + 1}` : 'Projet Global'
  );

  const handleFileDrop = (tabIndex: number, zone: keyof TabUploadState, file: File) => {
    setUploads((prev) => ({
      ...prev,
      [tabIndex]: {
        ...(prev[tabIndex] || { zone1: null, zone2: null, zone3: null }),
        [zone]: file,
      },
    }));
  };

  return (
    <div className="flex justify-center">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Créer un Projet</Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet JIRA</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              Renseigne les informations du projet et dépose les fichiers d'extraction requis.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5 mt-4" onSubmit={(e) => e.preventDefault()}>
            
            {/* 1. Nom & Clé JIRA */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Nom du projet *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="ex: Projet CCC"
                  className="w-full border border-gray-300 px-3 py-2 rounded-md text-sm outline-none focus:border-[#048890] focus:ring-1 focus:ring-[#048890]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Clé JIRA *</label>
                <input
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="ex: CCC"
                  className="w-full border border-gray-300 px-3 py-2 rounded-md text-sm uppercase outline-none focus:border-[#048890] focus:ring-1 focus:ring-[#048890]"
                  required
                />
              </div>
            </div>

            {/* 2. Subdivisé en modules ? */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Le projet est-il subdivisé en modules ? *
              </label>
              <div className="flex gap-6 items-center">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="hasModules"
                    value="no"
                    checked={hasModules === 'no'}
                    onChange={() => {
                      setHasModules('no');
                      setActiveTab(0);
                    }}
                    className="accent-[#048890]"
                  />
                  Non
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="hasModules"
                    value="yes"
                    checked={hasModules === 'yes'}
                    onChange={() => setHasModules('yes')}
                    className="accent-[#048890]"
                  />
                  Oui
                </label>
              </div>
            </div>

            {/* 3. Champ conditionnel : Nombre de modules */}
            {hasModules === 'yes' && (
              <div className="p-3 border border-dashed border-[#048890] bg-slate-50 rounded-md flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Nombre de modules *</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={moduleCount}
                  onChange={(e) => {
                    const count = Math.max(2, parseInt(e.target.value) || 2);
                    setModuleCount(count);
                    if (activeTab >= count) setActiveTab(0);
                  }}
                  className="w-32 border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white"
                />
                <p className="text-xs text-gray-500">
                  Minimum 2 modules. Chaque module aura son propre onglet d'upload.
                </p>
              </div>
            )}

            {/* Format de fichier attendu */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Format de fichier attendu</label>
              <input
                type="text"
                disabled
                value={projectKey ? `JIRA_${projectKey}_YYYYMMDD.csv` : 'JIRA_[CLE]_YYYYMMDD.csv'}
                className="w-full border border-gray-200 px-3 py-1.5 rounded-md text-xs bg-gray-100 text-gray-600 font-mono"
              />
            </div>

            {/* 4. Onglets de dépôt de fichiers */}
            <div className="mt-4 border-t pt-4">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Dépôt des fichiers d'extraction
              </label>

              {/* Barre d'onglets */}
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabsList.map((tabLabel, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === idx
                        ? 'border-[#048890] text-[#048890]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>

              {/* Contenu de l'onglet actif : 3 Drag Zones */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                {(['zone1', 'zone2', 'zone3'] as const).map((zone, zIdx) => {
                  const currentFile = uploads[activeTab]?.[zone];
                  return (
                    <div
                      key={zone}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) {
                          handleFileDrop(activeTab, zone, e.dataTransfer.files[0]);
                        }
                      }}
                      className="border-2 border-dashed border-gray-300 hover:border-[#048890] rounded-lg p-3 text-center bg-gray-50 flex flex-col items-center justify-center min-h-[110px] transition-colors relative cursor-pointer"
                    >
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileDrop(activeTab, zone, e.target.files[0]);
                          }
                        }}
                      />
                      <span className="text-xs font-semibold text-gray-600 mb-1">
                        Zone {zIdx + 1}
                      </span>
                      {currentFile ? (
                        <p className="text-xs text-[#048890] font-medium truncate max-w-[130px]">
                          📄 {currentFile.name}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400">
                          Glissez un fichier ou <span className="text-[#048890] underline">parcourez</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button className="mt-2 w-full sm:mt-0 sm:w-fit" variant="secondary">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" className="w-full sm:w-fit bg-[#048890] hover:bg-[#036c73]">
                Créer le projet
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
