import { useParams } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import KnowledgePageBase from "./KnowledgePageBase";

export default function KnowledgeFolderPage() {
  const { folderId } = useParams();
  const parsedFolderId = Number(folderId);

  if (!folderId || Number.isNaN(parsedFolderId)) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <ErrorState message="Папка не найдена" />
      </div>
    );
  }

  return <KnowledgePageBase currentFolderId={parsedFolderId} />;
}
