import { exec } from "child_process";
import { app, BrowserWindow } from "electron";
import { writeFileSync } from "fs-extra";
import { decode } from "iconv-lite";
import { join } from "path";
import { PDFDocument } from "pdf-lib";
import { promisify } from "util";
import { MessageChannelMainAdvice } from "./MessageChannelMainAdvice";
import { resolvePrinterStdout } from "./utils";

const execPromise = promisify(exec);

/**
 * 打印
 * @param {*} BrowserWindow 
 * @param {*} option 
 */
export function print(win, option = {
    htmlDir: __static
}) {
    const { width, height } = win.getBounds();
    const printWin = new BrowserWindow({
        width: width - 100,
        height: height - 120,
        // 不可移动
        movable: false,
        // 不可最大化
        maximizable: false,
        // 不可最小化
        minimizable: false,
        // 不显示在底部标签栏中
        skipTaskbar: true,
        // 无边框
        frame: false,
        parent: win,
        // 模态窗口
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    printWin.loadFile(join(option.htmlDir, "print/index.html"));
    // printWin.webContents.openDevTools()

    printWin.once("ready-to-show", () => {
        const messageChannelMainAdvice = new MessageChannelMainAdvice(printWin);

        // 获取打印机清单
        messageChannelMainAdvice.handle("get:printer", async () => {
            return await getPrinter();
        });

        // 获取PDF预览信息
        messageChannelMainAdvice.handle("get:pdf", async (msg) => {
            const { path, data } = await savePdfToTemp(win, msg);
            const { pageCount } = await getPdfInfo(data);
            return { path, pageCount };
        });

        // 展示系统打印
        messageChannelMainAdvice.handle("show:systemPrint", () => {
            win.webContents.print();
            printWin.close();
        });

        // 关闭预览窗口
        messageChannelMainAdvice.handle("do:close", () => {
            printWin.close();
        });

        // 执行打印
        messageChannelMainAdvice.handle("do:print", async (msg) => {
            await doPrint(win, msg);
            printWin.close();
        });
    });

}

/**
   * 保存PDF到临时文件夹
   * @param {*} win
   */
async function savePdfToTemp(win, config) {
    let blob = await win.webContents.printToPDF(config);
    const pdfPath = join(app.getPath("userData"), "print.pdf");
    writeFileSync(pdfPath, blob);
    return { path: pdfPath, data: blob };
}

/**
 * 获取PDF信息
 * @param {*} blob
 */
async function getPdfInfo(blob) {
    const pdfDoc = await PDFDocument.load(blob);
    return {
        pageCount: pdfDoc.getPageCount(),
    };
}

/**
 * 获取打印机列表
 * 这里使用命令获取是因为可以获取到更多的信息用于页面选项的显示隐藏
 */
async function getPrinter() {
    const res = await execPromise("wmic printer get /value", {
        encoding: "binary",
    });

    let printers = resolvePrinterStdout(
        decode(Buffer.from(res.stdout, "binary"), "cp936")
    );

    for (var i = 0; i < printers.length; i++) {
        const res2 = await execPromise(
            `Get-PrintConfiguration "${printers[i].DeviceID}" | Format-List -Property Color`,
            {
                shell: "powershell.exe",
            }
        );
        const [key, value] = res2.stdout.split(":").map((item) => item.trim());
        printers[i][key] = value.toLocaleUpperCase();
    }

    return printers;
}

/**
 * 执行打印机打印
 */
async function doPrint(win, config) {
    await win.webContents.print({ silent: true, ...config });
}