# Web3 Contract Tool

<p align="center">
  <strong>A desktop tool for Ethereum & EVM-compatible smart contract interaction and reverse analysis</strong>
</p>

<p align="center">
  English | <a href="./README.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue" />
  <img src="https://img.shields.io/badge/Next.js-16-black" />
  <img src="https://img.shields.io/badge/Rust-1.80+-orange" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## Features

### 🔧 Contract Interaction (with ABI)
- Import ABI (paste / file) and auto-generate dynamic forms
- Read (eth_call) and Write (send transaction) modes
- Support all Solidity types: address, uint, bool, bytes, array, tuple
- Payable methods with ETH value input
- Gas estimation (optional) + confirmation dialog + receipt tracking
- One-click ERC-20 sample ABI loading

### 🔍 Bytecode Analyzer (Closed-Source Contract Reverse Engineering)
- Extract PUSH4 function selectors from contract bytecode
- 4byte.directory online reverse lookup for known function signatures
- Proxy contract detection (EIP-1967, EIP-1167, UUPS)
- Persistent analysis history — data survives page navigation
- **Direct selector invocation** — click any selector to Read/Write without ABI

### 🤖 AI-Assisted Analysis
- Multiple AI providers: Claude, OpenAI, GLM (Zhipu), DeepSeek, MiniMax, MiMo, Qwen, Ollama, and custom OpenAI-compatible endpoints
- Customizable Base URL and Model ID for all providers
- AI analysis results parsed into **interactive function cards** — click to call directly
- Auto-inferred function names, parameter types, and Read/Write attributes
- Confidence levels (HIGH / MEDIUM / LOW)

### 🛠 Raw Calldata Builder
- Manually construct raw transaction data (To / Value / Data)
- Calldata hex decode preview

### 📋 Other Features
- **6 built-in chains**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC
- **Custom chains**: Add any EVM-compatible chain
- **Wallet**: Private key import (XOR-encrypted local storage), no browser extension needed on desktop
- **Transaction history**: Persistent records with status and block explorer links
- **i18n**: Full Chinese / English support
- **Custom RPC**: Override default RPC endpoint per chain

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop | Tauri v2 (Rust) |
| Frontend | Next.js 16 + React 19 (Static Export) |
| Web3 | viem 2.x + wagmi 2.x |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | Zustand v5 (persist middleware) |
| AI | Claude / OpenAI / GLM / DeepSeek / MiniMax / MiMo / Qwen / Ollama / Custom |

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.80+ (install via [rustup](https://rustup.rs))
- System dependencies per [Tauri docs](https://v2.tauri.app/start/prerequisites/)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/contract.git
cd contract

# Install frontend dependencies
npm install

# Development mode (launch Tauri desktop app)
npm run tauri:dev

# Build for production
npm run tauri:build
```

### Frontend-Only Development

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser (some Tauri APIs will be unavailable).

## Project Structure

```
contract/
├── src/                          # Next.js frontend
│   ├── app/                      # Page routes
│   │   ├── page.tsx              # Home - Contract interaction
│   │   ├── analyzer/             # Bytecode analyzer
│   │   ├── calldata-builder/     # Calldata builder
│   │   ├── history/              # Transaction history
│   │   └── settings/             # Settings
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Sidebar, header
│   │   └── contract/             # Contract interaction components
│   ├── lib/
│   │   ├── web3/                 # Multi-chain config, chain configs
│   │   ├── abi/                  # ABI parsing, encoding, type mapping
│   │   ├── bytecode/             # Disassembler, selector extraction, proxy detection
│   │   ├── ai/                   # AI Gateway, multi-provider, prompt templates
│   │   └── i18n/                 # Internationalization
│   └── stores/                   # Zustand stores
├── src-tauri/                    # Tauri Rust backend
│   ├── src/lib.rs                # Plugin registration
│   └── tauri.conf.json
└── public/                       # Static assets
```

## Screenshots

> TODO: Add app screenshots

## Supported AI Providers

| Provider | Default Endpoint | Default Model |
|----------|-----------------|---------------|
| Claude (Anthropic) | `https://api.anthropic.com` | `claude-sonnet-4-6-20250627` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| GLM (Zhipu AI) | `https://open.bigmodel.cn/api/paas/v1` | `glm-4-flash` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| MiniMax | `https://api.minimax.chat/v1` | `MiniMax-Text-01` |
| MiMo (Xiaomi) | `https://api.minimax.chat/v1` | `MiMo-7B-RL` |
| Qwen (Tongyi) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama (Local) | `http://localhost:11434` | `llama3.1` |
| Custom | Customizable | Customizable |

## Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push the branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

This project is licensed under the [MIT License](./LICENSE).

## Security Notice

- Private keys are XOR-encrypted and stored in localStorage — suitable for single-user desktop scenarios
- **This encryption is NOT recommended for production use** — use a hardware wallet for higher security
- API keys are stored locally and never sent to any third-party service
- AI analysis results are for reference only — always verify transactions before sending
