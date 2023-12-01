const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");

function createWindow() {
  // 创建浏览器窗口
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
    maximizable: false,
    transparent: false,
    frame: true,
    icon: __dirname + "/assets/favicon.ico",
  });

  win.setBackgroundColor("#000000");

  win.setMenu(null);

  process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

  process.env["ELECTRON_NO_ATTACH_CONSOLE"] = "true";

  process.noDeprecation = true;

  ipcMain.on("getCommandLineArgs", (event, arg) => {
    event.returnValue = process.argv; //收到消息后将命令行参数返回给渲染进程
  });

  //将信息发送的控制台
  ipcMain.on("debug", (event, arg) => {
    process.stdout.write(arg);
  });

  var outputDir = "";

  if (app.isPackaged) {
    outputDir = process.argv[2];
  } else {
    outputDir = process.argv[3];
  }

  //退出程序
  ipcMain.on("quit", (event, arg) => {
    //console.log(arg);
    setTimeout(function () {
      app.quit();
    }, 500); //收到退出消息后等待500毫秒再退出
  });

  ipcMain.on("downloadJSON", (event, arg) => {
    let result = JSON.parse(arg);
    let dataBuffer = result.data;
    let name = result.name;
    fs.writeFile(outputDir + "/" + name, dataBuffer, function (err) {
      if (err) {
        console.log(err);
      } else {
        //console.log("save success");
      }
    });
  });

  ipcMain.handle("exportGltf", async (event, arg) => {
    let pro = () => {
      return new Promise((resolve, reject) => {
        let result = JSON.parse(arg);
        let dataBuffer = result.data;
        let name = result.name;
        fs.writeFileSync(outputDir + "/" + name, dataBuffer);
        resolve(name);
      });
    };
    const result = await pro();
    return result;
  });

  // 并且为你的应用加载index.html
  win.loadFile("./index.html");

  // 打开开发者工具
  win.webContents.openDevTools();
}

// Electron会在初始化完成并且准备好创建浏览器窗口时调用这个方法
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(createWindow);

//当所有窗口都被关闭后退出
app.on("window-all-closed", () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 您可以把应用程序其他的流程写在在此文件中
// 代码 也可以拆分成几个文件，然后用 require 导入。
