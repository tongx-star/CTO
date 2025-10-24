# 像素坦克大战 Pixel Tank Battles

使用 Next.js 构建的像素风格坦克大战游戏。玩家可以自定义用户名、挑战多种关卡、操控坦克击败敌军，并通过道具系统升级武器或回复生命。

## 功能特性
- 🎮 **核心玩法**：坦克移动、穿墙射击、碰撞检测与敌方 AI。
- 🗺️ **关卡系统**：6 个精心设计的像素地图，难度循序渐进。
- 🧑‍✈️ **用户自定义**：开局前设置用户名，记录在 HUD 中。
- ❤️ **生命值系统**：初始三滴血，可通过道具恢复或因陷阱损失。
- ⚙️ **道具机制**：黄色升级道具延长穿墙炮弹持续时间并增强穿透力，绿色维修包回复生命，红色地雷造成伤害。
- ⏯️ **游戏控制**：开始、暂停、重置、下一关按钮，以及键盘操作提示。

## 技术栈
- [Next.js 14](https://nextjs.org/)
- React 18（客户端组件与自定义 hooks）
- TypeScript
- HTML5 Canvas 渲染像素艺术风格战场

## 本地运行
```bash
npm install
npm run dev
```

访问 `http://localhost:3000` 即可体验游戏。

## 资源与文档
- 🎨 [游戏界面设计图](public/design/pixel-tank-ui.svg)
- 📄 [关卡设计文档](docs/level-design.md)
- 📘 [用户手册](docs/user-manual.md)

## 项目结构
```
├── app
│   ├── components
│   │   ├── GameCanvas.tsx
│   │   ├── GameHud.tsx
│   │   └── useGameEngine.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib
│   └── game
│       ├── levels.ts
│       └── types.ts
├── docs
│   ├── level-design.md
│   └── user-manual.md
├── public
│   └── design
│       └── pixel-tank-ui.svg
├── package.json
└── tsconfig.json
```

## 许可
本项目用于演示与学习目的，可自由拓展与二次开发。
