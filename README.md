# Web3 Contract Tool

<p align="center">
  <strong>一个用于以太坊及 EVM 兼容链的智能合约交互与逆向分析桌面工具</strong>
</p>

<p align="center">
  <a href="./README_en.md">English</a> | 中文
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue" />
  <img src="https://img.shields.io/badge/Next.js-16-black" />
  <img src="https://img.shields.io/badge/Rust-1.80+-orange" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 功能特性

### 🔧 合约交互（有 ABI）
- 导入 ABI（粘贴 / 文件），自动解析生成动态表单
- 支持 Read（eth_call）和 Write（发送交易）两种模式
- 支持所有 Solidity 类型：address、uint、bool、bytes、array、tuple
- Payable 方法支持输入 ETH 数额
- Gas 估算（可选）+ 确认对话框 + 交易回执追踪
- ERC-20 样例 ABI 一键加载

### 🔍 字节码分析器（闭源合约逆向）
- 从合约字节码提取 PUSH4 函数选择器
- 4byte.directory 在线反查已知函数签名
- 代理合约检测（EIP-1967、EIP-1167、UUPS）
- 分析历史持久化，切换页面不丢失数据
- **选择器直接调用** — 点击任意选择器即可 Read/Write，无需 ABI

### 🤖 AI 辅助分析
- 支持多个 AI 提供商：Claude、OpenAI、GLM（智谱）、DeepSeek、MiniMax、MiMo、Qwen（通义千问）、Ollama、自定义 OpenAI 兼容端点
- 所有提供商的 Base URL 和 Model ID 均可自定义
- AI 分析结果解析为**可交互函数卡片**，直接点击调用
- 自动推断函数名、参数类型、Read/Write 属性
- 置信度标注（HIGH / MEDIUM / LOW）

### 🛠 原始 Calldata 构造器
- 手动构造原始交易数据（To / Value / Data）
- Calldata hex 解码预览

### 📋 其他功能
- **6 条内置链**：Ethereum、Arbitrum、Optimism、Base、Polygon、BSC
- **自定义链**：可添加任意 EVM 兼容链
- **钱包**：私钥导入（XOR 加密本地存储），桌面端无需浏览器插件
- **交易历史**：所有交易持久化记录，包含状态和区块浏览器链接
- **中英文切换**：完整 i18n 支持
- **自定义 RPC**：每条链均可覆盖默认 RPC 端点

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | Next.js 16 + React 19 (静态导出) |
| Web3 | viem 2.x + wagmi 2.x |
| UI | shadcn/ui + Tailwind CSS v4 |
| 状态管理 | Zustand v5 (persist middleware) |
| AI | Claude / OpenAI / GLM / DeepSeek / MiniMax / MiMo / Qwen / Ollama / 自定义 |

## 快速开始

### 环境要求

- Node.js 18+
- Rust 1.80+（通过 [rustup](https://rustup.rs) 安装）
- 系统依赖参考 [Tauri 官方文档](https://v2.tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/contract.git
cd contract

# 安装前端依赖
npm install

# 开发模式（启动 Tauri 桌面应用）
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

### 仅前端开发

```bash
npm run dev
```

浏览器访问 `http://localhost:3000`（部分 Tauri API 不可用）。

## 项目结构

```
contract/
├── src/                          # Next.js 前端
│   ├── app/                      # 页面路由
│   │   ├── page.tsx              # 首页 - 合约交互
│   │   ├── analyzer/             # 字节码分析器
│   │   ├── calldata-builder/     # Calldata 构造器
│   │   ├── history/              # 交易历史
│   │   └── settings/             # 设置页
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 组件
│   │   ├── layout/               # 侧栏、标题栏
│   │   └── contract/             # 合约交互组件
│   ├── lib/
│   │   ├── web3/                 # 多链配置、链配置
│   │   ├── abi/                  # ABI 解析、编码、类型映射
│   │   ├── bytecode/             # 反汇编、选择器提取、代理检测
│   │   ├── ai/                   # AI Gateway、多 Provider、Prompt 模板
│   │   └── i18n/                 # 国际化翻译
│   └── stores/                   # Zustand stores
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/lib.rs                # 插件注册
│   └── tauri.conf.json
└── public/                       # 静态资源
```

## 截图

> TODO: 添加应用截图

## 支持 AI 提供商

| 提供商 | 默认端点 | 默认模型 |
|--------|----------|----------|
| Claude (Anthropic) | `https://api.anthropic.com` | `claude-sonnet-4-6-20250627` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| GLM (智谱 AI) | `https://open.bigmodel.cn/api/paas/v1` | `glm-4-flash` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| MiniMax | `https://api.minimax.chat/v1` | `MiniMax-Text-01` |
| MiMo (小米) | `https://api.minimax.chat/v1` | `MiMo-7B-RL` |
| Qwen (通义千问) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama (本地) | `http://localhost:11434` | `llama3.1` |
| Custom | 自定义 | 自定义 |

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'Add my feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 提交 Pull Request

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。

## 安全提示

- 私钥使用 XOR 加密存储在本地 localStorage 中，适用于桌面端单用户场景
- **不建议在生产环境中使用此加密方式**，如需更高安全性请使用硬件钱包
- API Key 仅存储在本地，不会发送到任何第三方服务
- AI 分析结果仅供参考，请务必在发送交易前仔细核对
