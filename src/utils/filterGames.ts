export function isGameVisible(
  game: { is_installed: boolean; appid: number },
  hiddenGameIds: Set<number>,
  showUninstalled: boolean,
  showHidden: boolean
): boolean {
  const isHidden = hiddenGameIds.has(game.appid);
  const isUninstalled = !game.is_installed;

  if (isUninstalled && isHidden) {
    return showUninstalled || showHidden;
  }
  if (isUninstalled) {
    return showUninstalled;
  }
  if (isHidden) {
    return showHidden;
  }
  return true;
}

