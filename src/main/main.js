import { app, BrowserWindow, Menu } from 'electron'
import { print } from "../../lib/print"

let mainWindow

function createMainWindow() {
    const window = new BrowserWindow({ width: 1200, height: 800, webPreferences: { nodeIntegration: true } })

    window.loadURL(`https://www.electronjs.org/zh/docs/latest/`)


    window.on('closed', () => {
        mainWindow = null
    })

    window.webContents.on('devtools-opened', () => {
        window.focus()
        setImmediate(() => {
            window.focus()
        })
    })

    return window
}

const MenuItemTemplate = Menu.buildFromTemplate([
    {
        label: "打印",
        click: (e, win) => {
            print(win)
        },
    },
]);

app.on("web-contents-created", (event, webContents) => {
    webContents.on("context-menu", (e, params) => {
        MenuItemTemplate.popup(BrowserWindow.fromWebContents(webContents), params.x, params.y);
    });
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        mainWindow = createMainWindow()
    }
})

app.on('ready', () => {
    mainWindow = createMainWindow()
})