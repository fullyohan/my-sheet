"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ProjectContextType {
  projects: any[];
  isLoading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || data);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des projets :", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <ProjectContext.Provider value={{ projects, isLoading, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjects doit être utilisé au sein d'un ProjectProvider");
  }
  return context;
};
