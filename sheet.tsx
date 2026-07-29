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
import { Trash2 } from 'lucide-react';

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  onConfirmDelete: (id: string) => Promise<void> | void;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  projectId,
  projectName,
  onConfirmDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Empêche la fermeture auto de Radix pour attendre la requête HTTP
    setIsDeleting(true);

    try {
      await onConfirmDelete(projectId);
      setIsOpen(false);
    } catch (error) {
      console.error("Erreur de suppression :", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Supprimer
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Supprimer le projet ?</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6">
            Êtes-vous sûr de vouloir supprimer <strong className="font-semibold text-slate-200">{projectName}</strong> ? 
            Cette action est définitive et supprimera toutes les métadonnées et fichiers associés enregistrés dans le système.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button
              variant="secondary"
              className="mt-2 w-full sm:mt-0 sm:w-fit"
              disabled={isDeleting}
            >
              Annuler
            </Button>
          </DialogClose>

          <Button
            variant="destructive"
            className="w-full sm:w-fit"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Suppression..." : "Confirmer la suppression"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
