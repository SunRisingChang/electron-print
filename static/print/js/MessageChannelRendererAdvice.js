const { ipcRenderer } = require("electron");

let uuid = 0;

const PORT_RESPONSE_STATUS = {
  SUCCESS: {
    CODE: 0,
    MESSAGE: "成功",
  },
  FAIL: {
    CODE: -1,
    MESSAGE: "失败",
  },
  TIMEOUT: {
    CODE: -2,
    MESSAGE: "请求超时",
  },
  UNKNOWN: {
    CODE: -3,
    MESSAGE: "未知错误",
  },
};

function portResponseWrap(id, api, data, code, message) {
  return {
    id,
    api,
    data,
    code: code ?? PORT_RESPONSE_STATUS.SUCCESS.CODE,
    message: message ?? PORT_RESPONSE_STATUS.SUCCESS.MESSAGE,
  };
}

class MessageChannelRendererAdvice {
  // 请求队列 <id:number,{resolve,reject,data,api,id}>
  sendQueue = new Map();

  // 处理队列 <api:string,(msg)=>Promise>
  handleQueue = new Map();

  // 发送端口
  port = null;

  // 配置项
  config = {
    // 发送请求超时时间
    timeout: 1000 * 60,
    // 向窗体发送端口的api
    getPortKey: "port",
  };

  constructor(config) {
    this.config = { ...this.config, ...config };
  }

  whenReady() {
    return new Promise((resolve) => {
      ipcRenderer.once(this.config.getPortKey, (e) => {
        this.port = e.ports[0];
        this.port.onmessage = (messageEvent) =>
          this.onProtMessage(messageEvent);
        resolve();
      });
    });
  }

  /**
   * 监听端口消息
   */
  async onProtMessage(messageEvent) {
    const { id, api, data } = messageEvent.data;
    const info = this.sendQueue.get(id);

    if (info) {
      info.resolve(messageEvent.data);
      this.sendQueue.delete(id);
    } else {
      const handle = this.handleQueue.get(api);

      if (!handle) return;

      try {
        const res = await handle(data);
        this._port.postMessage(portResponseWrap(id, api, res));
      } catch (error) {
        this._port.postMessage(
          portResponseWrap(id, api, null, error.code, error.message)
        );
      }
    }
  }

  /**
   * 发送请求
   * @param {*} api 接口名称
   * @param {*} data 数据
   * @returns Promise<{code:number,data:any,message:string,api:string}>
   */
  send(api, data = {}) {
    return new Promise((resolve, reject) => {
      const id = uuid++;

      this.sendQueue.set(id, {
        id,
        api,
        data,
        resolve,
        reject,
      });

      this.port.postMessage({
        id,
        api,
        data,
      });

      // 超时处理
      setTimeout(() => {
        const sendInfo = this.sendQueue.get(id);
        if (!sendInfo) return;
        sendInfo.reject(
          portResponseWrap(
            id,
            api,
            null,
            PORT_RESPONSE_STATUS.TIMEOUT.CODE,
            PORT_RESPONSE_STATUS.TIMEOUT.MESSAGE
          )
        );
        this.sendQueue.delete(id);
      }, this.config.timeout);
    });
  }

  /**
   * 处理请求
   * @param {*} api 接口名称
   * @param {*} cb 处理回调
   */
  handle(api, cb) {
    this.handleQueue.set(api, cb);
  }
}
