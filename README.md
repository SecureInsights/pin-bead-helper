# 拼豆小助手

拼豆小助手是一个本地运行的拼豆图纸工具。它可以把图片转换成拼豆图纸，也可以导入现成图纸进行识别，并提供色号统计、分区指导、熨烫预览和 PNG 导出。

## 功能

- 本地上传图片生成拼豆图纸，图片不上传服务器。
- 支持裁剪区域，自动按裁剪比例建议格数，尽量不拉伸原图。
- 支持现成拼豆图纸识别，带水印干扰忽略选项。
- 支持 MARD / Artkal 风格色库和 96 / 120 / 144 / 168 / 221 色预设。
- 支持按色号高亮、色块数量统计、缺色提示。
- 支持拼豆指导模式，可以按分区标记已完成。
- 支持原豆、常规烫、毛巾烫、澡巾烫、闪粉烫等预览效果。
- 支持导出带坐标轴、每格色号和底部汇总的 PNG 图纸。
- 提供安卓 WebView 包装工程，可打包成 Android APK。

## 本地运行网页版

需要安装 Node.js。

```bash
npm start
```

默认地址：

```text
http://127.0.0.1:4173/
```

## 运行测试

```bash
npm test
```

## 构建 Android APK

需要安装 JDK 17 和 Android SDK。第一次构建建议在 `android` 目录使用 Gradle Wrapper：

```bash
cd android
./gradlew assembleDebug
```

Windows PowerShell：

```powershell
cd android
.\gradlew.bat assembleDebug
```

生成的调试包位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 开源说明

本项目使用 MIT License 开源。

图库和图纸内容请只使用原创、已授权或用户自己导入的素材。项目不包含第三方付费图纸抓取功能。
