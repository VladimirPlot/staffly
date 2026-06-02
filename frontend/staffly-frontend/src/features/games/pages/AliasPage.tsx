import React from "react";

import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import AliasGameView from "../alias/components/AliasGameView";
import AliasGameShell from "../alias/components/AliasGameShell";
import AliasStartMenu from "../alias/components/AliasStartMenu";
import { useAliasFullscreen } from "../alias/hooks/useAliasFullscreen";
import { useAliasGame } from "../alias/hooks/useAliasGame";

const AliasPage: React.FC = () => {
  const aliasFullscreen = useAliasFullscreen();
  const aliasGame = useAliasGame();
  const { state, actions } = aliasGame;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Игры", to: "/games" }, { label: "Алиас" }]} />

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Алиас</h2>
        <div className="text-pretty text-sm text-muted">Ресторанная версия игры на объяснение слов.</div>
      </div>

      <AliasGameShell
        gameShellRef={aliasFullscreen.gameShellRef}
        fullscreenMode={aliasFullscreen.fullscreenMode}
        fullscreenSupport={aliasFullscreen.fullscreenSupport}
        fullscreenViewport={aliasFullscreen.fullscreenViewport}
        isFullscreenLayout={aliasFullscreen.isFullscreenLayout}
        orientationLockState={aliasFullscreen.orientationLockState}
        showPortraitPrompt={aliasFullscreen.showPortraitPrompt}
        installHintVisible={aliasFullscreen.installHintVisible}
        fullscreenError={aliasFullscreen.fullscreenError}
        onFullscreenToggle={aliasFullscreen.toggleFullscreen}
        onInstallHintDismiss={aliasFullscreen.dismissInstallHint}
      >
        {state.phase === "setup" ? (
          <AliasStartMenu
            difficulty={state.settings.difficulty}
            wordPack={state.settings.wordPack}
            targetScore={state.settings.targetScore}
            roundDurationSeconds={state.settings.roundDurationSeconds}
            penalizeSkippedWords={state.settings.penalizeSkippedWords}
            teams={state.teams}
            isFullscreenLayout={aliasFullscreen.isFullscreenLayout}
            onDifficultyChange={actions.setDifficulty}
            onWordPackChange={actions.setWordPack}
            onTargetScoreChange={actions.setTargetScore}
            onPenalizeSkippedWordsChange={actions.setPenalizeSkippedWords}
            onTeamNameChange={actions.renameTeam}
            onTeamAdd={actions.addTeam}
            onTeamRemove={actions.removeTeam}
            onStartGame={actions.startGame}
          />
        ) : (
          <AliasGameView {...aliasGame} isFullscreenLayout={aliasFullscreen.isFullscreenLayout} />
        )}
      </AliasGameShell>
    </div>
  );
};

export default AliasPage;
