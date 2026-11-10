export const isWindows = /Windows/i.test(navigator.userAgent);
export const settingsShortcut = isWindows ? "Ctrl+," : "?,";
