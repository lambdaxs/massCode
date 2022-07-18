'use strict';

import electron from  'electron';

let IS_RENDERER:boolean = process.type === 'renderer'

const BrowserWindow = electron.BrowserWindow;

// @ts-ignore
const remote = electron.remote;

const undefinedOrNull = (_var:any) => {
  return typeof _var === 'undefined' || _var === null;
};


export const getMainWindow = () => {
  // renderer process
  if (IS_RENDERER) {
    const mainWindow = remote.BrowserWindow.getAllWindows();

    if (
      undefinedOrNull(mainWindow) ||
      undefinedOrNull(mainWindow[mainWindow.length - 1])
    ) {
      return null;
    }

    return mainWindow[mainWindow.length - 1];
  }

  // main process
  const mainWindow = BrowserWindow.getAllWindows();
  if (
    undefinedOrNull(mainWindow) ||
    undefinedOrNull(mainWindow[mainWindow.length - 1])
  ) {
    return null;
  }

  return mainWindow[mainWindow.length - 1];
};

