# 3D Skill Arena

> 本项目由 Seed 2.1 Pro 模型支持开发，特此鸣谢。

一款可以直接在浏览器中游玩的 3D 法术对战游戏。玩家需要在敌方弓手的追击下移动、瞄准和施法，利用五种属性不同的技能击败对手。

[在线试玩](https://studiousxiaoyu.github.io/seed-2.1-pro-3d-skill-arena/)

![战斗画面](evidence/final-polish/02-battle.png)

## 五种法术

- 火球：按住左键蓄力，松开发射。
- 天雷：落点预警与连锁雷击。
- 冰刺：范围伤害并冻结敌人。
- 陨星：高空坠落、爆炸与焦痕。
- 水弹：抛物线飞行与落点水花。

敌方弓手会自主游走、转向、瞄准和射击。双方都有独立生命值，战斗结束后可以立即重新开局。

## 操作

| 操作 | 按键 |
| --- | --- |
| 移动 | `W A S D` |
| 奔跑 | `Shift` |
| 瞄准 | 鼠标移动 |
| 施法 | 鼠标左键；火球需要按住蓄力 |
| 切换技能 | 数字键 `1`—`5` 或点击技能图标 |
| 旋转视角 | `空格 + 鼠标左键拖动` |
| 缩放 | 鼠标滚轮 |
| 重新开始 | 结算界面按钮或 `R` |

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm start
```

打开 `http://127.0.0.1:8123`。

## 项目结构

```text
css/                     HUD 与结算界面样式
js/                      场景、技能、角色与敌人逻辑
models/Soldier.glb       Three.js 官方示例角色
textures/                粒子纹理
```

## 许可与致谢

项目代码使用 [MIT License](LICENSE)。Three.js、three.quarks、Soldier.glb 与粒子资源的来源和许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
