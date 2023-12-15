import { app, BrowserWindow, ipcMain, Menu, shell, globalShortcut } from 'electron'
import path from 'path'
import os, { homedir } from 'os'
import { store } from './store'
import { ApiServer } from './services/api/server'
import { createDb } from './services/db'
import { debounce } from 'lodash'
import { subscribeToChannels } from './services/ipc'
import { mainMenu } from './menu/main'
import { subscribeToDialog } from './services/ipc/dialog'
import { checkForUpdateWithInterval } from './services/update-check'
import http from 'http'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import formidable from 'formidable'


const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'

const defaultPath = isMac ? homedir() + '/massCode' : homedir() + '\\massCode'

let isQuitting = false

createDb()
const apiServer = new ApiServer()

subscribeToChannels()
subscribeToDialog()

function createWindow () {
  const bounds = store.app.get('bounds')
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    ...bounds,
    titleBarStyle: isMac ? 'hidden' : 'default',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false
    }
  })

  Menu.setApplicationMenu(mainMenu)

  if (isDev) {
    const rendererPort = process.argv[2]
    mainWindow.loadURL(`http://localhost:${rendererPort}`)
  } else {
    mainWindow.loadFile(path.resolve(app.getAppPath(), 'renderer/index.html'))
  }

  mainWindow.on('resize', () => storeBounds(mainWindow))
  mainWindow.on('move', () => storeBounds(mainWindow))

  mainWindow.on('close', function (event) {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  app.on('before-quit', function () {
    isQuitting = true
  })

  app.on('window-all-closed', function () {
    if (isQuitting) {
      app.quit()
    }
  })

  // 监听activate事件，在macos下点击dock栏会触发这个事件
  app.on('activate', function () {
    mainWindow.show()
  })

  // mainWindow.webContents.setBackgroundThrottling(true);

  // checkForUpdateWithInterval()
}

const storeBounds = debounce((mainWindow: BrowserWindow) => {
  store.app.set('bounds', mainWindow.getBounds())
}, 300)

app.whenReady().then(async () => {
  createWindow()

  globalShortcut.register('CommandOrControl+Shift+L', () => {
    const focusWin = BrowserWindow.getFocusedWindow()
    focusWin && focusWin.webContents.toggleDevTools()
  })


  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

const startImageServerV2 = () => {
  http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
      const form = formidable({
        uploadDir: defaultPath
      })
      const [_, files] = await form.parse(req)
      res.end(files.image[0].newFilename)
    } else {
      const fileName = req.url?.replace('/', '') || ''
      const filePath = defaultPath + '/' + fileName
      const extName = path.extname(fileName).substr(1) || ''

      if (fs.existsSync(filePath)) {
        const mineTypeMap = {
          html: 'text/html;charset=utf-8',
          htm: 'text/html;charset=utf-8',
          xml: 'text/xml;charset=utf-8',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          css: 'text/css;charset=utf-8',
          txt: 'text/plain;charset=utf-8',
          mp3: 'audio/mpeg',
          mp4: 'video/mp4',
          ico: 'image/x-icon',
          tif: 'image/tiff',
          svg: 'image/svg+xml',
          zip: 'application/zip',
          ttf: 'font/ttf',
          woff: 'font/woff',
          woff2: 'font/woff2'
        }
        // @ts-ignore
        if (mineTypeMap[extName]) {
          // @ts-ignore
          res.setHeader('Content-Type', mineTypeMap[extName]);
        }
        const stream = fs.createReadStream(filePath)
        stream.pipe(res)
      } else {
        res.statusCode = 404
        res.end('not found')
      }
    }
  }).listen('8091')
}

startImageServerV2()

const startImageServer = () => {
  http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
      let body = ''
      req.on('data', chunk => {
        body += chunk
      })
      req.on('end', () => {
        const imageType = req.headers['x-image-type'] || 'png'
        // 从请求中获取文件数据并保存到服务器
        const imageData = Buffer.from(body, 'binary')
        const fileName = `${uuidv4()}.${imageType}`
        fs.writeFile(defaultPath + '/' + fileName, imageData, 'binary', err => {
          if (err) {
            res.statusCode = 500
            res.end('文件上传失败')
          } else {
            res.statusCode = 200
            res.end(fileName)
          }
        })
      })
    } else {
      const fileName = req.url?.replace('/', '') || ''
      const filePath = defaultPath + '/' + fileName
      const extName = path.extname(fileName).substr(1) || ''

      if (fs.existsSync(filePath)) {
        const mineTypeMap = {
          html: 'text/html;charset=utf-8',
          htm: 'text/html;charset=utf-8',
          xml: 'text/xml;charset=utf-8',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          css: 'text/css;charset=utf-8',
          txt: 'text/plain;charset=utf-8',
          mp3: 'audio/mpeg',
          mp4: 'video/mp4',
          ico: 'image/x-icon',
          tif: 'image/tiff',
          svg: 'image/svg+xml',
          zip: 'application/zip',
          ttf: 'font/ttf',
          woff: 'font/woff',
          woff2: 'font/woff2'
        }
        // @ts-ignore
        if (mineTypeMap[extName]) {
          // @ts-ignore
          res.setHeader('Content-Type', mineTypeMap[extName]);
        }
        const stream = fs.createReadStream(filePath)
        stream.pipe(res)
      } else {
        res.statusCode = 404
        res.end('not found')
      }
    }
  }).listen('8090')
}

// startImageServer()

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('browser-window-focus', () => {
  BrowserWindow.getFocusedWindow()?.webContents.send('main:focus')
})

ipcMain.handle('main:restart-api', () => {
  apiServer.restart()
})

ipcMain.handle('main:open-url', (event, payload) => {
  shell.openExternal(payload as string)
})

ipcMain.on('request-info', event => {
  event.sender.send('request-info', {
    version: app.getVersion(),
    arch: os.arch(),
    platform: process.platform
  })
})
