import React from "react";

import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import AliasGameShell from "../alias/components/AliasGameShell";
import AliasStartMenu from "../alias/components/AliasStartMenu";
import { useAliasFullscreen } from "../alias/hooks/useAliasFullscreen";
import { useAliasSetupState } from "../alias/hooks/useAliasSetupState";

const AliasPage: React.FC = () => {
  const { gameShellRef, isFullscreen, toggleFullscreen } = useAliasFullscreen();
  const aliasSetup = useAliasSetupState();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Игры", to: "/games" }, { label: "Алиас" }]} />

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Алиас</h2>
        <div className="text-pretty text-sm text-muted">Ресторанная версия игры на объяснение слов.</div>
      </div>

      <AliasGameShell
        gameShellRef={gameShellRef}
        isFullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
      >
        <AliasStartMenu {...aliasSetup} />
      </AliasGameShell>
    </div>
  );
};

export default AliasPage;
