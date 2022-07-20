import electron,{ipcMain, Menu,BrowserWindow } from 'electron'
import { getMainWindow } from '../mainwindows';
import { homedir, platform } from 'os'

const Tray = electron.Tray;
const app = electron.app;

const isWin = platform() === 'win32'

const defaultPath = isWin ? homedir() + '\\massCode' : homedir() + '/massCode'



var tray:any = null;

app.on('ready', function(){

  console.log('app ready', defaultPath);

  try {

    tray = new Tray(defaultPath+"/Icon_Template.png");

    const contextMenu = Menu.buildFromTemplate([])
    tray.setToolTip('This is my application.')
    tray.setContextMenu(contextMenu)

    tray.on('click',function(){
      const mainWindow = getMainWindow();
      mainWindow.show();
    })

  }catch (e) {
    console.log(e);
  }
})

let timer:any = null;
import timers from 'timers';

export const subscribeToMoyu = () => {


  //开启计时
  ipcMain.handle('tab:startTask', (event, payload:any) => {

    let {id, title, costTime} = payload;

    timer = timers.setInterval(()=>{
      costTime++
      tray.setTitle(title + formatSecond(costTime))

      event.sender.send('tab:updateCostTime', {
        id, costTime,
      })

    }, 1000);

  })

  //停止计时
  ipcMain.handle('tab:stopTask', (event) => {


    if (timer !== null) {
      timers.clearInterval(timer)
      timer = null
    }

  });

  ipcMain.handle('tab:startMoyu', (event, payload) => {
    return new Promise<void>(resolve => {

      tray.setTitle(payload)

      resolve()
    })
  })
}


const formatSecond = (second: number)=> {
  if (second === 0) {
    return ''
  }
  const days = Math.floor(second / 86400);
  const hours = Math.floor((second % 86400) / 3600);
  const minutes = Math.floor(((second % 86400) % 3600) / 60);
  const seconds = Math.floor(((second % 86400) % 3600) % 60);



  const hourStr = PrefixZero(hours, 2);
  const minuteStr = PrefixZero(minutes, 2);
  const secondStr = PrefixZero(seconds, 2);

  if (days) {
    return `${days}d:${hourStr}:${minuteStr}:${secondStr}`
  }
  if (hours) {
    return `${hourStr}:${minuteStr}:${secondStr}`
  }
  if (minutes) {
    return `${minuteStr}:${secondStr}`
  }
  return `0:${secondStr}`;
}


function PrefixZero(num:number, n:number) {
  return (Array(n).join('0') + num).slice(-n);
}
