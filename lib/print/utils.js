/**
 * 解析 wmic printer get /value 结果
 */
export function resolvePrinterStdout(stdout) {
    let printer = [];
    try {
        const stdoutGroup = stdout
            .split("\r\r\n\r\r\n\r\r\n")
            .filter((item) => item != "\r\r\n");

        stdoutGroup.forEach((g) => {
            let p = {};
            g.split("\r\r\n").forEach((v) => {
                if (!v) return;
                const [key, value] = v.split("=");
                p[key] = value ?? "";
            });
            printer.push(p);
        });
    } catch (error) {
        console.warn("未解析到打印机信息", error, stdout);
    }

    return printer;
}
