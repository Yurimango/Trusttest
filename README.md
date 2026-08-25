# 诚信核查插件工具包

## 一、项目定位

`integrity-screenshot-tool` 保留在同一个项目目录下，但拆成两个互不直接调用的子功能：

1. `extension/`：Edge 插件，只负责网站选择、打开网站、全屏截图、图片标注和保存截图。
2. `word_exporter/`：独立 Word 导出工具，用户完成全部截图后再单独运行，用项目截图生成 Word。

边界约定：

1. 不使用 Native Messaging。
2. 插件不直接调用 Python。
3. 插件不直接调用 EXE。
4. Word 导出程序只读取本地项目文件夹中的截图。

核查结果和实质判断应完全由人工完成。本工具不负责自动判断风险、自动生成结论、自动处理验证码或绕过网站访问限制。

---

## 二、项目结构

```text
integrity-screenshot-tool/
├─ extension/
│  ├─ manifest.json
│  ├─ popup.html
│  ├─ popup.js
│  ├─ background.js
│  ├─ content.js
│  └─ sites.json
│
├─ word_exporter/
│  ├─ generate_word.py
│  └─ post_process.py
│
├─ run_generate_word.bat
└─ README.md
```

---

## 三、Edge 插件功能

插件目录：

```text
extension/
```

插件只负责：

1. 读取 `sites.json` 网站清单。
2. 显示当前核查网站和进度。
3. 保存项目名称和核查主体名称。
4. 打开当前网站、上一个网站、下一个网站、跳过网站、重置进度。
5. 复制核查主体名称。
6. 选择整个屏幕后进行全屏截图。
7. 截图前临时隐藏插件弹窗，减少遮挡。
8. 给截图顶部添加核查网站、主体、时间、页面链接标注。
9. 将截图保存到项目文件夹下对应核查主体的 `screenshots/` 中。

插件不会生成 Word，也不会调用 `word_exporter/`。

---

## 四、Word 导出功能

导出工具目录：

```text
word_exporter/
```

当前入口：

```text
run_generate_word.bat
```

或直接运行：

```powershell
python word_exporter/generate_word.py
```

Word 导出工具只负责：

1. 读取用户指定项目文件夹下各核查主体的 `screenshots/`。
2. 按截图文件名前缀序号排序。
3. 优先从截图文件名读取实际网站名称，再按名称从 `extension/sites.json` 补充页面链接；自定义清单增删或重排后也不会造成标题与截图错配。
4. 生成截图清单和截图正文。
5. 分别输出 Word 到各核查主体文件夹的 `report/`。

后续封装 EXE 时，也应保持独立运行，不由插件触发。

---

## 五、插件安装

在 Edge 地址栏打开：

```text
edge://extensions/
```

开启“开发人员模式”，点击“加载解压缩的扩展”，选择：

```text
integrity-screenshot-tool/extension
```

注意：不要选择整个项目根目录，必须选择包含 `manifest.json` 的 `extension` 文件夹。

---

## 六、插件使用流程

1. 打开插件，填写项目名称和核查主体名称。
2. 点击“新建项目”，保存当前信息并将网站进度重置到第一个网站。
3. 点击“打开当前网站”。
4. 在网页中人工完成查询和判断。
5. 点击“保存当前截图”，选择“整个屏幕”。
6. 插件临时隐藏弹窗，等待 0.8 秒后截图、标注并保存图片。
7. 如误触跳过或切换，可点击“上一个网站”回退并重新打开。
8. 点击“下一个网站”继续核查。

截图默认保存到 Edge 下载目录下：

```text
Downloads\诚信核查插件工具包\项目名称\核查主体名称\screenshots\
```

---

## 七、Word 导出流程

### 方式一：直接运行 EXE

已经打包好的 EXE 位于：

```text
dist\诚信核查截图Word导出工具.exe
```

在没有安装 Python 的电脑上，直接双击该 EXE 即可运行。运行后输入或拖入项目文件夹路径，例如：

```text
C:\Users\你的用户名\Downloads\诚信核查插件工具包\测试项目
```

也可以直接拖入该项目下的 `screenshots` 文件夹，程序会自动识别上一级项目文件夹。

### 方式二：开发环境运行脚本

开发电脑首次使用前安装依赖：

```powershell
pip install python-docx pillow
```

然后运行：

```text
run_generate_word.bat
```

如果 `dist\诚信核查截图Word导出工具.exe` 存在，`run_generate_word.bat` 会优先启动 EXE；否则会回退到 Python 脚本。

### 项目文件夹要求

插件截图必须位于：

```text
项目文件夹\核查主体名称\screenshots\
```

正确结构：

```text
测试项目\
├─ 测试公司A\
│  ├─ screenshots\
│  │  └─ 01_网站名称_测试公司A_20260707_120000.png
│  └─ report\
│     └─ 测试公司A_诚信核查截图汇总.docx
└─ 测试公司B\
   ├─ screenshots\
   │  └─ 01_网站名称_测试公司B_20260707_120000.png
   └─ report\
      └─ 测试公司B_诚信核查截图汇总.docx
```

Word 输出位置：

```text
测试项目\核查主体名称\report\
```

导出程序会优先从截图文件名自动识别核查主体名称。插件保存的截图文件名格式类似：

```text
01_信用中国_测试公司_20260707_141500.png
```

如果能识别，导出程序会默认使用 `测试公司` 作为 Word 文件名中的主体名称，用户直接按回车即可。

---

## 八、构建 Word 导出 EXE

构建 EXE 只需要在开发电脑上执行，目标电脑无需安装 Python。

开发电脑准备：

```powershell
cd integrity-screenshot-tool
word_exporter\build_exe.bat
```

该脚本会安装/检查以下构建依赖：

```text
python-docx
Pillow
pyinstaller
```

构建完成后输出：

```text
dist\诚信核查截图Word导出工具.exe
```

打包配置位于：

```text
word_exporter\word_exporter.spec
```

`extension/sites.json` 已被打包进 EXE，因此目标电脑运行导出工具时不需要安装 Python，也不需要插件调用导出程序。

---

## 九、网站清单配置

网站清单位于：

```text
extension/sites.json
```

配置要点：

1. `profiles[].siteIds` 控制当前模板的网站顺序。
2. `sites[].enabled` 控制网站是否启用。
3. `sites[].order` 作为无 profile 时的备用排序。
4. `inputSelector` 和 `searchButtonSelector` 为历史预留字段，当前弹窗不提供自动填入功能。

---

## 十、常见问题

### 插件加载失败

检查是否选择了 `extension/` 文件夹，且 `manifest.json` 位于该文件夹下。

### 网站清单显示失败

检查 `extension/sites.json` 是否为合法 JSON。

### 截图无法保存

不要在 `edge://extensions/`、`edge://downloads/`、新标签页或浏览器设置页测试截图，建议使用普通网页测试。

### Word 导出找不到截图

请确认输入的是项目文件夹，而不是 `screenshots/` 文件夹本身。项目文件夹下应包含一个或多个“核查主体名称”子文件夹，每个主体文件夹下应包含 `screenshots/`。

导出程序也支持直接输入 `screenshots/` 文件夹；如果仍提示找不到，请检查截图是否确实由插件保存到了：

```text
Downloads\诚信核查插件工具包\项目名称\核查主体名称\screenshots\
```

---

## 十一、版本记录

### v0.1.0

当前版本：

1. Edge 插件负责网站选择、打开网站、全屏截图、标注和保存截图。
2. Word 导出工具独立放在 `word_exporter/`。
3. 插件与 Word 导出工具之间无 Native Messaging、无 Python 调用、无 EXE 调用。
