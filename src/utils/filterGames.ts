export function isGameVisible(
  game: { is_installed: boolean; appid: number },
  hiddenGameIds: Set<number>,
  showUninstalled: boolean,
  showHidden: boolean
): boolean {
  const isHidden = hiddenGameIds.has(game.appid);
  const isUninstalled = !game.is_installed;

  // Hidden games never show unless "showHidden" is explicitly turned on,
  // including when browsing uninstalled games.
  if (isHidden && !showHidden) {
    return false;
  }

  // Uninstalled games never show unless "showUninstalled" is explicitly turned on.
  if (isUninstalled && !showUninstalled) {
    return false;
  }

  return true;
}

