const PAGE_SIZE_MAP = {
  信纸: "Letter",
  Tabloid: "Tabloid",
  法律专用纸: "Legal",
  // Statement: "Invoice",
  // Executive: "Executive",
  A3: "A3",
  A4: "A4",
  A5: "A5",
  // "B4 (JIS)": "B4 (JIS)",
  // "B5 (JIS)": "B5 (JIS)",
  // "信封 #10": "Envelope #10",
  // "信封 DL": "Envelope DL",
  // "信封 C5": "C5",
  // "信封 B5": "B5",
  // "信封 Monarch": "Monarch",
  // 日式明信片: "Hagaki",
  A6: "A6",
  // 双层日式明信片旋转: "Oufuku Hagaki",
  // "B6 (JIS)": "B6 (JIS)",
  // "Oficio 8.5x13": "Executive (JIS)",
  // "16 K 184 x 260 毫米": "120",
  // "16 K 195 x 270 毫米": "121",
  // "16 K 197 x 273 毫米": "ROC 16K",
  // "Oficio 216X340 毫米": "123",
  // "4x6": "Index 4x6",
  // "5x8": "5x8",
};

Vue.prototype.$ELEMENT = { size: "small" };

const mcra = new MessageChannelRendererAdvice();

function debounce(fn, delay = 300) {
  //默认300毫秒
  let timer;
  return function () {
    let args = arguments;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args); // this 指向vue
    }, delay);
  };
}

new Vue({
  el: "#app",
  data: {
    // 打印按钮是否可以点击
    isPrint: false,
    // 加载pdf loading
    isLoading: true,
    // 预览PDF地址
    url: "",
    // PDF总页数
    total: 0,
    // 是否显示更多设置
    isMore: false,
    // 颜色配置项
    colorOption: [
      {
        value: true,
        label: "颜色",
      },
      {
        value: false,
        label: "黑白",
      },
    ],
    // 双面打印配置项
    duplexModeOption: [
      {
        value: "simplex",
        label: "单面打印（仅单面打印）",
      },
      {
        value: "longEdge",
        label: "双面打印（长边翻转）",
      },
      {
        value: "shortEdge",
        label: "双面打印（短边翻转）",
      },
    ],
    // 每页纸要打印的页数配置项
    pagesPerSheetOption: [1, 2, 4, 6, 9, 16],
    // 边距配置项
    marginsOption: [
      {
        value: "default",
        label: "默认",
      },
      {
        value: "none",
        label: "无",
      },
      {
        value: "printableArea",
        label: "最小",
      },
      {
        value: "custom",
        label: "自定义",
      },
    ],
    pagesStringError: false,
    // 打印机配置项
    printers: [],
    // 当前选中打印设备信息
    device: {},
    // ------------------- 表单 开始 -------------------
    // 打印机设备名称
    deviceID: "",
    // 要打印的网页副本数
    copies: 1,
    // 是否为横向
    landscape: false,
    // 页面类型  1：全部 2：自定义
    pageRangesType: "1",
    // 页面
    pagesString: "",
    // 双面打印
    duplexMode: "",
    // 打印的网页是彩色还是灰度
    color: true,
    // 页面大小
    pageSize: "A4",
    // 网页的缩放比例类型 1：实际大小 2：自定义
    scaleFactorType: "1",
    // 网页的缩放比例
    scaleFactor: 100,
    // 每页纸要打印的页数
    pagesPerSheet: 1,
    // 边距类型 default、none、printableArea、 或custom
    marginType: "default",
    // 上边距
    marginTop: 1,
    // 下边距
    marginBottom: 1,
    // 左边距
    marginLeft: 1,
    // 右边距
    marginRigth: 1,
    // 是否显示页眉和页脚
    displayHeaderFooter: true,
    // 是否打印背景图形
    printBackground: false,
    // ------------------- 表单 结束 -------------------
  },
  watch: {
    deviceName: {
      handler: function () {
        this.device = this.printers.find(
          (item) => item.DeviceID == this.deviceID
        );
      },
    },
  },
  computed: {
    isDuplex: function () {
      return (this.device?.CapabilityDescriptions ?? "").includes("Duplex");
    },
    isColor: function () {
      return this.device?.Color == "TRUE";
    },
    pageSizes: function () {
      let result = [];
      if (this.device?.PrinterPaperNames) {
        let printerPaperNamesArr = this.device?.PrinterPaperNames.replace(
          /"/g,
          ""
        )
          .replace("{", "")
          .replace("}", "")
          .split(",")
          .filter((item) => !!item);

        printerPaperNamesArr.forEach((item) => {
          if (!PAGE_SIZE_MAP[item]) return;
          result.push({
            value: PAGE_SIZE_MAP[item],
            label: item,
          });
        });
      }
      return result;
    },
    okButtonText: function () {
      if (!this.device?.DeviceID) return "打印";
      return this.device.DeviceID.toLocaleLowerCase().includes("pdf")
        ? "保存"
        : "打印";
    },
    pdfUrl: function () {
      return this.url ? this.url + "#toolbar=0&statusbar=0" : "";
    },
    isDisabledPrint: function () {
      return !(this.isPrint && !this.pagesStringError);
    },
  },
  created() {
    mcra.whenReady().then(() => {
      this.doUpdatePdf();
      mcra.send("get:printer").then((res) => {
        console.log(res);
        if (Array.isArray(res.data)) {
          this.printers = res.data;
          const defaultPrinter = this.printers.find(
            (item) => item.Default == "TRUE"
          );
          this.deviceID = defaultPrinter.DeviceID;
          this.onDeviceIDChange(this.deviceID);
        }
        this.isPrint = true;
      });
    });
  },
  methods: {
    doUpdatePdf: debounce(function () {
      mcra.send("get:pdf", this.createPdfFormData()).then((res) => {
        console.log(res);
        if (res.code != 0) return;
        this.total = res.data.pageCount;
        this.url = res.data.path;
        this.isLoading = false;
      });
    }, 400),
    onDeviceIDChange(event) {
      this.device = this.printers.find((item) => item.DeviceID == event);
    },
    createPdfFormData() {
      let result = {
        landscape: this.landscape,
        displayHeaderFooter: this.displayHeaderFooter,
        printBackground: this.printBackground,
        scale: this.scaleFactorType == "1" ? 1 : this.scaleFactor / 100,
        pageSize: this.pageSize,
        copies: this.copies,
        pagesPerSheet: this.pagesPerSheet,
        margins: {
          top: 1,
          bottom: 1,
          left: 1,
          right: 1,
        },
        pageRanges: undefined,
      };

      if (this.marginType == "none") {
        result.margins = {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        };
      } else if (this.marginType == "printableArea") {
        result.margins = {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5,
        };
      } else if (this.marginType == "custom") {
        result.margins = {
          top: this.marginTop,
          bottom: this.marginBottom,
          left: this.marginLeft,
          right: this.marginRigth,
        };
      }

      if (this.pageRangesType == "2") {
        result.pageRanges = this.pagesString;
      }

      return result;
    },
    createPrintFormData() {
      let result = {
        printBackground: this.printBackground,
        deviceName: this.deviceID,
        color: this.color,
        margins: {
          marginType: this.marginType,
          top: this.marginTop,
          bottom: this.marginBottom,
          left: this.marginLeft,
          right: this.marginRigth,
        },
        landscape: this.landscape,
        scaleFactor: this.scaleFactorType == "1" ? 1 : this.scaleFactor / 100,
        pagesPerSheet: this.pagesPerSheet,
        copies: this.copies,
        pageRanges: undefined,
        duplexMode: this.duplexMode,
        pageSize: this.pageSize,
      };

      if (this.pageRangesType == "2") {
        let _pageRanges = {};
        this.pagesString.split("、").forEach((item) => {
          if (/^[0-9]*-[0-9]*$/.test(item)) {
            const [from, to] = item.split("-");
            _pageRanges.push({
              from,
              to,
            });
          }
          if (/^[0-9]*$/.test(item)) {
            _pageRanges = {
              from: item,
              to: item,
            };
          }
        });
        result.pageRanges = _pageRanges;
      }

      return result;
    },
    onPagesStringChange(event) {
      if (!event) {
        this.pagesStringError = false;
        return;
      }
      if (/^[0-9]*-[0-9]*$/.test(event)) {
        const [v1, v2] = event.split("-");
        if (+v2 > +v1 && v1 > 0) {
          this.onFormChange();
          this.pagesStringError = false;
          return;
        }
      }
      if (/^[0-9]*$/.test(event)) {
        if (+event > 0) {
          this.onFormChange();
          this.pagesStringError = false;
          return;
        }
      }
      this.pagesStringError = true;
    },
    handleCancel() {
      mcra.send("do:close");
    },
    handleOk() {
      mcra.send("do:print", this.createPrintFormData());
    },
    onFormChange() {
      this.isLoading = true;
      this.doUpdatePdf();
    },
    handleCallSystemPrint() {
      mcra.send("show:systemPrint");
    },
  },
});
