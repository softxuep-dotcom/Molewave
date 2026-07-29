# Molewave Prototype

Three.js + TypeScript + Vite + Rapier 制作的三关浏览器灰盒，对应 Concept Gate v1.1 的三个核心输入原语：

1. L1：低位横拖，滑推箱子进入目标区。
2. L2：向上拖动并停住，顶撑木板形成斜坡。
3. L3：向上并快速横扫，掀射轻球越过矮墙。

## 启动

```bash
npm install
npm run dev
```

默认地址为 Vite 输出的本地地址。生产构建：

```bash
npm run build
npm run preview
```

## 操作

- 在画面下部按住并横向拖动：移动地毯鼓包。
- 按住后向上拖动：提高鼓包。
- 低位慢拖为滑推；高位停住为顶撑；高位快速横扫为掀射。
- `R`：重置当前关。
- `Esc`：暂停或继续。
- `D`：显示 FPS 与输入诊断。

## 自动回归

访问 `/?autoplay=1` 会启用只用于诊断的确定性输入驾驶器，连续验证三关的固定步长物理、成功判定和关卡切换。默认游戏不会启用该模式。

## 代码边界

- `src/game/`：内容、输入意图和关卡状态。
- `src/physics/`：Rapier 世界、运动学鼓包、顶撑机构和一次性掀射接触。
- `src/render/`：Three.js 相机、场景、连续地毯网格和物理显示桥。
- `src/ui/`：DOM HUD、暂停与完成覆盖层。
- `src/diagnostics/`：FPS 与自动回归驾驶器。
