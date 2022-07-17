import electron,{ipcMain, Menu,BrowserWindow } from 'electron'
const Tray = electron.Tray;
const app = electron.app;
import { getMainWindow } from 'electron-main-window';
import { NotificationRequest } from '@shared/types/main'

var tray:any = null;

app.on('ready', function(){

  console.log('app ready');
  try {
    tray = new Tray('images/Icon.png');
  }catch (e) {
    console.log(e);
  }

  const contextMenu = Menu.buildFromTemplate([])
  tray.setToolTip('This is my application.')
  tray.setContextMenu(contextMenu)

  tray.on('click',function(){
    const mainWindow = getMainWindow();
    mainWindow.show();
  })
})

export const subscribeToMoyu = () => {

  ipcMain.handle('tab:startMoyu', (event, payload) => {
    return new Promise<void>(resolve => {
      console.log('start moyu',payload);

      tray.setTitle(payload)

      resolve()
    })
  })
}
